import { useEffect, useRef, useState } from 'react';
import { useAudioReady } from '../../hooks/useAudioReady';
import { useMicReady } from '../../hooks/useMicReady';
import { useStopOnDeactivate } from '../../hooks/useStopOnDeactivate';
import { audio } from '../../lib/audio/engine';
import { mic, MIC_BUFFER_SIZE } from '../../lib/audio/mic';
import { createPlaybackChannel, scheduleSamplerTrigger, stopChannel } from '../../lib/audio/playback';
import {
  advanceTracker,
  centsBetween,
  DEFAULT_TRACKER_OPTIONS,
  f0FromMidi,
  initialTrackerState,
  type TrackerState,
} from '../../lib/pitch/analysis';
import { gradeSungInterval } from '../../lib/pitch/grading';
import { buildSingingPool, buildSingingQuestion, ROOT_RANGE_PRESETS, type SingingQuestion } from '../../lib/pitch/question';
import { TOLERANCE_CENTS, type IntervalSingingSettings } from '../../lib/pitch/settings';
import { RECOGNITION_MAX_GUESSES } from '../../lib/recognition/intervals';
import { midiToNoteName } from '../../lib/theory';
import { EMPTY_SCORE, useScoresStore } from '../../state/scores';
import type { StatusKind } from '../../components/StatusLine';

const TOPIC_ID = 'interval-singing';
const ROOT_NOTE_LEN_SEC = 1.2;

export type RoundPhase = 'idle' | 'playingRoot' | 'listening' | 'revealing' | 'done';

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

  const pool = buildSingingPool(settings.direction, settings.enabledIntervals);
  const rootRange = ROOT_RANGE_PRESETS[settings.rootRange];

  function disarm() {
    armedRef.current = false;
    trackerRef.current = initialTrackerState();
    setLiveCentsOffset(null);
  }

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
    const q = buildSingingQuestion(pool, rootRange);
    questionRef.current = q;
    setQuestion(q);
    attemptsUsedRef.current = 0;
    setAttemptsUsed(0);
    setFeedbackMsg('');
    setFeedbackKind('');
    playRoot(() => armListening());
  }

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
      const ctx = audio.status === 'ready' ? audio.rawContext() : null;
      const frameSec = ctx ? MIC_BUFFER_SIZE / ctx.sampleRate : MIC_BUFFER_SIZE / 44100;
      trackerRef.current = advanceTracker(trackerRef.current, frame, frameSec, {
        ...DEFAULT_TRACKER_OPTIONS,
        requiredHoldSec: settings.holdTimeSec,
      });
      if (trackerRef.current.phase === 'captured' && trackerRef.current.capturedMidi !== null) {
        const captured = trackerRef.current.capturedMidi;
        armedRef.current = false; // pause capturing while this attempt is graded
        handleCapture(captured);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.tolerance, settings.octaveEquivalence, settings.holdTimeSec]);

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
      setStatusText('Ready. Press New question to begin.');
      setStatusKind('');
    }
  }, [micStatus, audioStatus]);

  function stop() {
    disarm();
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
