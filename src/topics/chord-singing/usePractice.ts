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
import {
  buildChordSingingQuestion,
  type ChordSingingQuestion,
  type ChordSingingSettings,
} from '../../lib/pitch/chordSinging';
import { gradeSungInterval, type SungGradeResult } from '../../lib/pitch/grading';
import { ROOT_RANGE_PRESETS } from '../../lib/pitch/question';
import { TOLERANCE_CENTS } from '../../lib/pitch/settings';
import { RECOGNITION_AUTO_ADVANCE_MS, RECOGNITION_MAX_GUESSES } from '../../lib/recognition/intervals';
import { midiToNoteName } from '../../lib/theory';
import { EMPTY_SCORE, useScoresStore } from '../../state/scores';
import type { StatusKind } from '../../components/StatusLine';

const TOPIC_ID = 'chord-singing';

const ROOT_NOTE_LEN_SEC = 1.2;
const BLOCK_CHORD_LEN_SEC = 1.4;
const BLOCK_TO_ARP_GAP_SEC = 0.3;
const ARP_TONE_LEN_SEC = 0.6;
const ARP_TO_ROOT_GAP_SEC = 0.25;
const REVEAL_ARP_TONE_LEN_SEC = 0.5;
const REVEAL_ARP_TO_BLOCK_GAP_SEC = 0.3;
/** Mirrors interval-singing's ambient RMS calibration window (docs/10 §17.3). */
const CALIBRATION_SEC = 2;

export type ChordRoundPhase = 'idle' | 'presenting' | 'listening' | 'revealing' | 'done';

/** Conventional chord-tone role names for feedback text (§4's "Root / 3rd / 5th / 7th" example) — a display concern, not part of the Tier-1 pitch math. */
const TONE_ROLE_LABELS: Record<number, string> = {
  0: 'Root',
  2: '9th',
  3: '3rd',
  4: '3rd',
  5: '4th',
  6: '5th',
  7: '5th',
  8: '5th',
  9: '6th',
  10: '7th',
  11: '7th',
  14: '9th',
};

function toneRoleLabel(offset: number): string {
  return TONE_ROLE_LABELS[offset] ?? `${offset}st above root`;
}

/** Real-world duration of one mic analysis frame at the live context's sample rate (same as interval-singing/usePractice.ts). */
function frameSec(): number {
  const ctx = audio.status === 'ready' ? audio.rawContext() : null;
  return ctx ? MIC_BUFFER_SIZE / ctx.sampleRate : MIC_BUFFER_SIZE / 44100;
}

export function useChordSingingPractice(settings: ChordSingingSettings) {
  const audioStatus = useAudioReady();
  const micStatus = useMicReady();
  const channelRef = useRef(createPlaybackChannel());
  useStopOnDeactivate(TOPIC_ID, channelRef.current);

  const recordAttempt = useScoresStore((s) => s.recordAttempt);
  const resetScoreInStore = useScoresStore((s) => s.resetScore);
  const score = useScoresStore((s) => s.scores[TOPIC_ID] ?? EMPTY_SCORE);

  const [question, setQuestion] = useState<ChordSingingQuestion | null>(null);
  const [phase, setPhase] = useState<ChordRoundPhase>('idle');
  const [toneIndex, setToneIndex] = useState(0);
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [toneResults, setToneResults] = useState<SungGradeResult[]>([]);
  const [liveCentsOffset, setLiveCentsOffset] = useState<number | null>(null);
  const [statusText, setStatusText] = useState('Press Initialize Audio, then Enable microphone, to begin.');
  const [statusKind, setStatusKind] = useState<StatusKind>('');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackKind, setFeedbackKind] = useState<'' | 'ok' | 'bad'>('');

  // Ref twins for the mic-frame closure (same convention as interval-singing).
  const questionRef = useRef<ChordSingingQuestion | null>(null);
  const toneIndexRef = useRef(0);
  const attemptsUsedRef = useRef(0);
  const toneResultsRef = useRef<SungGradeResult[]>([]);
  const trackerRef = useRef<TrackerState>(initialTrackerState());
  const armedRef = useRef(false);
  const roundTokenRef = useRef(0);
  const advanceTimerRef = useRef<number | null>(null);
  const newQuestionRef = useRef<() => void>(() => {});
  const rmsThresholdRef = useRef(DEFAULT_TRACKER_OPTIONS.rmsThreshold);
  const [calibrating, setCalibrating] = useState(false);

  function clearAdvanceTimer() {
    if (advanceTimerRef.current !== null) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }

  const rootRange = ROOT_RANGE_PRESETS[settings.rootRange];

  function disarm() {
    armedRef.current = false;
    trackerRef.current = initialTrackerState();
    setLiveCentsOffset(null);
  }

  // Mic release on topic deactivate/unmount (docs/10 §17.1 convention, same as interval-singing).
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

  useEffect(() => () => mic.stopMic(), []);

  // Ambient-noise RMS calibration (same convention as interval-singing).
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

  function playSequence(segments: { midis: number[]; durSec: number; gapAfterSec?: number }[]): number {
    if (audio.status !== 'ready' || !audio.sampler) return 0;
    stopChannel(channelRef.current, audio.sampler);
    const playGen = channelRef.current.playbackGen;
    let cursor = audio.now() + 0.08;
    segments.forEach((seg) => {
      const note = seg.midis.length === 1 ? midiToNoteName(seg.midis[0]!) : seg.midis.map(midiToNoteName);
      scheduleSamplerTrigger(audio.sampler, channelRef.current, playGen, cursor, note, seg.durSec, 0.85);
      cursor += seg.durSec + (seg.gapAfterSec ?? 0);
    });
    return cursor - audio.now();
  }

  function armTone(index: number) {
    disarm();
    toneIndexRef.current = index;
    setToneIndex(index);
    armedRef.current = true;
    setPhase('listening');
  }

  /** Schedules audio, then arms the given tone once it finishes — guarded by roundTokenRef against a double-click race (same pattern as interval-singing's playRoot). */
  function playThenArm(segments: { midis: number[]; durSec: number; gapAfterSec?: number }[], armIndex: number) {
    disarm();
    setPhase('presenting');
    const token = ++roundTokenRef.current;
    const dur = playSequence(segments);
    window.setTimeout(() => {
      if (roundTokenRef.current !== token) return;
      armTone(armIndex);
    }, dur * 1000 + 150);
  }

  function presentQuestion(q: ChordSingingQuestion) {
    const chordMidis = q.toneOffsets.map((o) => q.rootMidi + o);
    if (q.promptMode === 'echo') {
      playThenArm(
        [
          { midis: chordMidis, durSec: BLOCK_CHORD_LEN_SEC, gapAfterSec: BLOCK_TO_ARP_GAP_SEC },
          ...chordMidis.map((midi) => ({ midis: [midi], durSec: ARP_TONE_LEN_SEC })),
          { midis: [q.rootMidi], durSec: ROOT_NOTE_LEN_SEC, gapAfterSec: ARP_TO_ROOT_GAP_SEC },
        ],
        0,
      );
    } else {
      playThenArm([{ midis: [q.rootMidi], durSec: ROOT_NOTE_LEN_SEC }], 0);
    }
  }

  function retryAttempt() {
    if (!questionRef.current) return;
    toneResultsRef.current = [];
    setToneResults([]);
    playThenArm([{ midis: [questionRef.current.rootMidi], durSec: ROOT_NOTE_LEN_SEC }], 0);
  }

  function newQuestion() {
    if (settings.enabledTypes.length === 0) {
      setStatusText('Enable at least one chord quality.');
      setStatusKind('warn');
      return;
    }
    clearAdvanceTimer();
    const q = buildChordSingingQuestion(settings, rootRange);
    if (!q) {
      setStatusText('Enable at least one singable chord quality (extended/altered qualities are out of scope for singing).');
      setStatusKind('warn');
      return;
    }
    questionRef.current = q;
    setQuestion(q);
    attemptsUsedRef.current = 0;
    setAttemptsUsed(0);
    toneResultsRef.current = [];
    setToneResults([]);
    setFeedbackMsg('');
    setFeedbackKind('');
    presentQuestion(q);
  }
  newQuestionRef.current = newQuestion;

  function replayRoot() {
    if (!questionRef.current) return;
    const heldToneIndex = toneIndexRef.current;
    disarm();
    setPhase('presenting');
    const token = ++roundTokenRef.current;
    const dur = playSequence([{ midis: [questionRef.current.rootMidi], durSec: ROOT_NOTE_LEN_SEC }]);
    window.setTimeout(() => {
      if (roundTokenRef.current !== token) return;
      armTone(heldToneIndex);
    }, dur * 1000 + 150);
  }

  function reveal() {
    const q = questionRef.current;
    if (!q) return;
    disarm();
    setPhase('revealing');
    const chordMidis = q.toneOffsets.map((o) => q.rootMidi + o);
    playSequence([
      ...chordMidis.map((midi) => ({ midis: [midi], durSec: REVEAL_ARP_TONE_LEN_SEC })),
      { midis: chordMidis, durSec: BLOCK_CHORD_LEN_SEC, gapAfterSec: REVEAL_ARP_TO_BLOCK_GAP_SEC },
    ]);
    const totalDur =
      chordMidis.length * REVEAL_ARP_TONE_LEN_SEC + REVEAL_ARP_TO_BLOCK_GAP_SEC + BLOCK_CHORD_LEN_SEC;
    window.setTimeout(() => setPhase('done'), totalDur * 1000 + 200);
  }

  function handleCapture(capturedMidi: number) {
    const q = questionRef.current;
    if (!q) return;
    const index = toneIndexRef.current;
    const offset = q.toneOffsets[index]!;
    const result = gradeSungInterval(q.rootMidi, offset, capturedMidi, {
      toleranceCents: TOLERANCE_CENTS[settings.tolerance],
      octaveEquivalence: settings.octaveEquivalence,
    });
    const nextResults = [...toneResultsRef.current, result];
    toneResultsRef.current = nextResults;
    setToneResults(nextResults);

    const label = toneRoleLabel(offset);
    setFeedbackKind(result.correct ? 'ok' : 'bad');
    setFeedbackMsg(
      result.correct
        ? `${label} ✓`
        : `${label} ✗ ${Math.abs(Math.round(result.centsOff))}¢ ${result.centsOff < 0 ? 'flat' : 'sharp'}`,
    );

    // No early abort (§4.3) — the round always completes all tones, even after a miss.
    if (index + 1 < q.toneOffsets.length) {
      armTone(index + 1);
      return;
    }

    const allCorrect = nextResults.every((t) => t.correct);
    attemptsUsedRef.current += 1;
    setAttemptsUsed(attemptsUsedRef.current);
    const firstAttempt = attemptsUsedRef.current === 1;

    if (allCorrect) {
      disarm();
      recordAttempt(TOPIC_ID, firstAttempt);
      setFeedbackKind('ok');
      setFeedbackMsg(
        firstAttempt ? 'Correct on your first try! +1' : 'Correct — but not your first attempt, no point added.',
      );
      setPhase('done');
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
      setFeedbackKind('bad');
      setFeedbackMsg('Out of attempts — revealing the chord.');
      reveal();
      return;
    }

    disarm();
    const left = RECOGNITION_MAX_GUESSES - attemptsUsedRef.current;
    setFeedbackKind('bad');
    setFeedbackMsg((prev) => `${prev} — ${left} attempt${left === 1 ? '' : 's'} left. Replaying the root…`);
    retryAttempt();
  }

  useEffect(() => {
    return mic.onFrame((frame) => {
      if (!armedRef.current) return;
      const q = questionRef.current;
      if (q && frame.frequency !== null) {
        const targetMidi = q.rootMidi + q.toneOffsets[toneIndexRef.current]!;
        setLiveCentsOffset(centsBetween(frame.frequency, f0FromMidi(targetMidi)));
      }
      trackerRef.current = advanceTracker(trackerRef.current, frame, frameSec(), {
        ...DEFAULT_TRACKER_OPTIONS,
        requiredHoldSec: settings.holdTimeSec,
        rmsThreshold: rmsThresholdRef.current,
      });
      if (trackerRef.current.phase === 'captured' && trackerRef.current.capturedMidi !== null) {
        const captured = trackerRef.current.capturedMidi;
        armedRef.current = false;
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
    } else if (micStatus === 'ready' && audioStatus === 'ready' && phase === 'idle') {
      setStatusText(calibrating ? 'Calibrating microphone to room noise…' : 'Ready. Press New question to begin.');
      setStatusKind('');
    }
  }, [micStatus, audioStatus, calibrating, phase]);

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
    toneIndex,
    toneResults,
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
    toneRoleLabel,
  };
}
