import { useEffect, useRef, useState } from 'react';
import { useAudioReady } from '../../hooks/useAudioReady';
import { useIsActiveTopic } from '../../hooks/useIsActiveTopic';
import { useMicReady } from '../../hooks/useMicReady';
import { useStopOnDeactivate } from '../../hooks/useStopOnDeactivate';
import { audio } from '../../lib/audio/engine';
import { mic, MIC_BUFFER_SIZE } from '../../lib/audio/mic';
import { createPlaybackChannel, scheduleSamplerTrigger, stopChannel } from '../../lib/audio/playback';
import {
  advanceTracker,
  calibrateRmsThreshold,
  centsBetween,
  DEFAULT_TRACKER_OPTIONS,
  f0FromMidi,
  initialTrackerState,
  type TrackerState,
} from '../../lib/pitch/analysis';
import { gradeSungInterval } from '../../lib/pitch/grading';
import { buildSingingPool, buildSingingQuestion, ROOT_RANGE_PRESETS, type SingingQuestion } from '../../lib/pitch/question';
import { TOLERANCE_CENTS, type IntervalSingingSettings } from '../../lib/pitch/settings';
import { RECOGNITION_AUTO_ADVANCE_MS, RECOGNITION_MAX_GUESSES } from '../../lib/recognition/intervals';
import { midiToNoteName } from '../../lib/theory';
import { EMPTY_SCORE, useScoresStore } from '../../state/scores';
import type { StatusKind } from '../../components/StatusLine';

const TOPIC_ID = 'interval-singing';
const ROOT_NOTE_LEN_SEC = 1.2;
/** How much ambient audio to sample for RMS-gate calibration after the mic opens (docs/10 §17.3). */
const CALIBRATION_SEC = 2;

export type RoundPhase = 'idle' | 'playingRoot' | 'listening' | 'revealing' | 'done';

/** Real-world duration of one mic analysis frame at the live context's sample rate. */
function frameSec(): number {
  const ctx = audio.status === 'ready' ? audio.rawContext() : null;
  return ctx ? MIC_BUFFER_SIZE / ctx.sampleRate : MIC_BUFFER_SIZE / 44100;
}

export function useIntervalSingingPractice(settings: IntervalSingingSettings) {
  const audioStatus = useAudioReady();
  const micStatus = useMicReady();
  const channelRef = useRef(createPlaybackChannel());
  useStopOnDeactivate(TOPIC_ID, channelRef.current);

  const recordAttempt = useScoresStore((s) => s.recordAttempt);
  const resetScoreInStore = useScoresStore((s) => s.resetScore);
  const score = useScoresStore((s) => s.scores[TOPIC_ID] ?? EMPTY_SCORE);

  const [question, setQuestion] = useState<SingingQuestion | null>(null);
  const [phase, setPhase] = useState<RoundPhase>('idle');
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [liveCentsOffset, setLiveCentsOffset] = useState<number | null>(null);
  const [statusText, setStatusText] = useState('Press Initialize Audio, then Enable microphone, to begin.');
  const [statusKind, setStatusKind] = useState<StatusKind>('');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackKind, setFeedbackKind] = useState<'' | 'ok' | 'bad'>('');

  // Refs mirror the reactive state the mic-frame callback (a closure that
  // outlives any single render) needs to read without going stale — same
  // "ref twin" convention used by exam/useExamMachine.ts and
  // topics/progression/usePractice.ts.
  const questionRef = useRef<SingingQuestion | null>(null);
  const attemptsUsedRef = useRef(0);
  const trackerRef = useRef<TrackerState>(initialTrackerState());
  const armedRef = useRef(false);
  const roundTokenRef = useRef(0);
  const advanceTimerRef = useRef<number | null>(null);
  // Auto-advance calls the freshest newQuestion (same ref pattern as
  // interval recognition's startRoundRef) so a settings change mid-delay
  // isn't read through a stale closure.
  const newQuestionRef = useRef<() => void>(() => {});
  // Room-noise-adapted RMS gate; stays at the fixed default until the
  // post-mic-open calibration window completes (docs/10 §17.3).
  const rmsThresholdRef = useRef(DEFAULT_TRACKER_OPTIONS.rmsThreshold);
  const [calibrating, setCalibrating] = useState(false);

  function clearAdvanceTimer() {
    if (advanceTimerRef.current !== null) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }

  const pool = buildSingingPool(settings.direction, settings.enabledIntervals);
  const rootRange = ROOT_RANGE_PRESETS[settings.rootRange];

  function disarm() {
    armedRef.current = false;
    trackerRef.current = initialTrackerState();
    setLiveCentsOffset(null);
  }

  // Release the microphone when the user leaves the topic (docs/10 §17.1).
  // useStopOnDeactivate above only stops the playback channel; without this,
  // the mic stream stays open and the browser's recording indicator stays
  // lit indefinitely — at odds with the topic's own "audio never leaves the
  // device" promise. Returning to the topic goes through the Enable-
  // microphone gesture again (permission is remembered, so it's one click).
  const isActive = useIsActiveTopic(TOPIC_ID);
  const wasActiveRef = useRef(isActive);
  useEffect(() => {
    if (wasActiveRef.current && !isActive) {
      disarm();
      clearAdvanceTimer();
      setPhase('idle');
      mic.stopMic();
    }
    wasActiveRef.current = isActive;
  }, [isActive]);

  // Unmount safety net — under D9a active topics stay mounted, so this
  // mostly matters for tests and any future unmount path.
  useEffect(() => () => mic.stopMic(), []);

  // Ambient-noise calibration (docs/10 §17.3): sample the first ~2s of
  // frames each time the mic opens and adapt the RMS voicing gate to the
  // room (laptop fans / hiss vary by an order of magnitude). Passive — a
  // round started mid-window just uses the fixed default until calibration
  // lands; the threshold resets whenever the mic closes.
  useEffect(() => {
    if (micStatus !== 'ready') {
      rmsThresholdRef.current = DEFAULT_TRACKER_OPTIONS.rmsThreshold;
      setCalibrating(false);
      return;
    }
    setCalibrating(true);
    const samples: number[] = [];
    let elapsedSec = 0;
    const unsubscribe = mic.onFrame((frame) => {
      samples.push(frame.rms);
      elapsedSec += frameSec();
      if (elapsedSec >= CALIBRATION_SEC) {
        rmsThresholdRef.current = calibrateRmsThreshold(samples);
        setCalibrating(false);
        // Verification read-out (docs/10 Phase 17 gate) — debug level so it
        // never surfaces in a default console.
        console.debug(
          `[interval-singing] mic RMS gate calibrated: ${rmsThresholdRef.current.toFixed(4)} (${samples.length} ambient frames)`,
        );
        unsubscribe();
      }
    });
    return () => {
      unsubscribe();
    };
  }, [micStatus]);

  async function initMic() {
    if (audio.status !== 'ready') return;
    await mic.requestMic(audio.rawContext());
  }

  function playNotes(midis: number[], durationSec: number): number {
    if (audio.status !== 'ready' || !audio.sampler) return 0;
    stopChannel(channelRef.current, audio.sampler);
    const playGen = channelRef.current.playbackGen;
    const startAt = audio.now() + 0.05;
    midis.forEach((midi) => {
      scheduleSamplerTrigger(audio.sampler, channelRef.current, playGen, startAt, midiToNoteName(midi), durationSec, 0.85);
    });
    return durationSec;
  }

  function armListening() {
    disarm();
    armedRef.current = true;
    setPhase('listening');
    setStatusText('Listening — sing the target interval.');
    setStatusKind('');
  }

  function playRoot(onDone?: () => void) {
    if (!questionRef.current) return;
    disarm();
    setPhase('playingRoot');
    setFeedbackMsg('');
    setFeedbackKind('');
    // Guards against a double-click race: if a second New question/Replay
    // click starts a fresh playRoot before this one's timer fires, the
    // stale timer's token no longer matches and it becomes a no-op instead
    // of wrongly arming listening for the wrong question.
    const token = ++roundTokenRef.current;
    const dur = playNotes([questionRef.current.rootMidi], ROOT_NOTE_LEN_SEC);
    window.setTimeout(() => {
      if (roundTokenRef.current !== token) return;
      onDone?.();
    }, dur * 1000 + 150);
  }

  function newQuestion() {
    if (!pool.length) {
      setStatusText('Enable at least one interval for the selected direction.');
      setStatusKind('warn');
      return;
    }
    clearAdvanceTimer();
    const q = buildSingingQuestion(pool, rootRange);
    questionRef.current = q;
    setQuestion(q);
    attemptsUsedRef.current = 0;
    setAttemptsUsed(0);
    setFeedbackMsg('');
    setFeedbackKind('');
    playRoot(() => armListening());
  }
  newQuestionRef.current = newQuestion;

  function replayRoot() {
    playRoot(() => armListening());
  }

  function handleCapture(capturedMidi: number) {
    const q = questionRef.current;
    if (!q) return;
    const result = gradeSungInterval(q.rootMidi, q.targetSemitones, capturedMidi, {
      toleranceCents: TOLERANCE_CENTS[settings.tolerance],
      octaveEquivalence: settings.octaveEquivalence,
    });
    attemptsUsedRef.current += 1;
    setAttemptsUsed(attemptsUsedRef.current);
    const firstAttempt = attemptsUsedRef.current === 1;

    if (result.correct) {
      disarm();
      recordAttempt(TOPIC_ID, firstAttempt);
      setFeedbackKind('ok');
      setFeedbackMsg(firstAttempt ? 'Correct on your first try! +1' : 'Correct — but not your first attempt, no point added.');
      setPhase('done');
      // Auto-advance only follows a correct capture (docs/10 §17.2) — after
      // a failed round the user should be free to sit with the reveal.
      if (settings.autoAdvance) {
        clearAdvanceTimer();
        advanceTimerRef.current = window.setTimeout(() => {
          advanceTimerRef.current = null;
          newQuestionRef.current();
        }, RECOGNITION_AUTO_ADVANCE_MS);
      }
      return;
    }

    if (attemptsUsedRef.current >= RECOGNITION_MAX_GUESSES) {
      disarm();
      recordAttempt(TOPIC_ID, false);
      const targetMidi = q.rootMidi + q.targetSemitones;
      setFeedbackKind('bad');
      setFeedbackMsg(`Out of attempts — the target was ${midiToNoteName(targetMidi)}. Reveal: root + target together.`);
      setPhase('revealing');
      playNotes([q.rootMidi, targetMidi], ROOT_NOTE_LEN_SEC);
      window.setTimeout(() => setPhase('done'), ROOT_NOTE_LEN_SEC * 1000 + 200);
      return;
    }

    // Wrong, but attempts remain — keep listening for another try without
    // replaying the root (avoids the played note bleeding into the mic
    // again mid-round). Must re-arm explicitly: the frame handler cleared
    // armedRef before calling handleCapture, so frames would otherwise be
    // silently dropped for the rest of the round.
    disarm();
    armedRef.current = true;
    const left = RECOGNITION_MAX_GUESSES - attemptsUsedRef.current;
    setFeedbackKind('bad');
    setFeedbackMsg(`Not quite (${Math.round(result.centsOff)}¢ off) — ${left} attempt${left === 1 ? '' : 's'} left.`);
  }

  useEffect(() => {
    return mic.onFrame((frame) => {
      if (!armedRef.current) return;
      const q = questionRef.current;
      if (q && frame.frequency !== null) {
        const targetMidi = q.rootMidi + q.targetSemitones;
        setLiveCentsOffset(centsBetween(frame.frequency, f0FromMidi(targetMidi)));
      }
      trackerRef.current = advanceTracker(trackerRef.current, frame, frameSec(), {
        ...DEFAULT_TRACKER_OPTIONS,
        requiredHoldSec: settings.holdTimeSec,
        rmsThreshold: rmsThresholdRef.current,
      });
      if (trackerRef.current.phase === 'captured' && trackerRef.current.capturedMidi !== null) {
        const captured = trackerRef.current.capturedMidi;
        armedRef.current = false; // pause capturing while this attempt is graded
        handleCapture(captured);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.tolerance, settings.octaveEquivalence, settings.holdTimeSec, settings.autoAdvance]);

  useEffect(() => {
    if (audioStatus === 'ready') {
      setStatusText(micStatus === 'ready' ? 'Ready. Press New question to begin.' : 'Audio ready — press Enable microphone.');
      setStatusKind('');
    } else if (audioStatus === 'error') {
      setStatusText(`Audio init failed: ${audio.lastError ?? 'unknown error'}`);
      setStatusKind('error');
    }
  }, [audioStatus, micStatus]);

  useEffect(() => {
    if (micStatus === 'denied') {
      setStatusText('Microphone access was denied — allow it in your browser\'s site settings to sing along.');
      setStatusKind('error');
    } else if (micStatus === 'error') {
      setStatusText(`Microphone error: ${mic.lastError ?? 'no microphone found'}.`);
      setStatusKind('error');
    } else if (micStatus === 'ready' && audioStatus === 'ready') {
      setStatusText(calibrating ? 'Calibrating microphone to room noise…' : 'Ready. Press New question to begin.');
      setStatusKind('');
    }
  }, [micStatus, audioStatus, calibrating]);

  function stop() {
    disarm();
    clearAdvanceTimer();
    stopChannel(channelRef.current, audio.sampler);
    setPhase('idle');
  }

  return {
    audioStatus,
    micStatus,
    micLastError: mic.lastError,
    question,
    phase,
    attemptsUsed,
    maxAttempts: RECOGNITION_MAX_GUESSES,
    liveCentsOffset,
    toleranceCents: TOLERANCE_CENTS[settings.tolerance],
    statusText,
    statusKind,
    feedbackMsg,
    feedbackKind,
    score,
    initMic,
    newQuestion,
    replayRoot,
    stop,
    resetScore: () => resetScoreInStore(TOPIC_ID),
  };
}
