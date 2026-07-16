import { useEffect, useRef, useState } from 'react';
import type { StatusKind } from '../../components/StatusLine';
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
import { gradeSungInterval, type SungGradeResult } from '../../lib/pitch/grading';
import { ROOT_RANGE_PRESETS } from '../../lib/pitch/question';
import { buildSightSingingQuestion, type SightSingingQuestion, type SightSingingSettings } from '../../lib/pitch/sightSinging';
import { TOLERANCE_CENTS } from '../../lib/pitch/settings';
import { RECOGNITION_AUTO_ADVANCE_MS, RECOGNITION_MAX_GUESSES } from '../../lib/recognition/intervals';
import { midiToNoteName } from '../../lib/theory';
import { EMPTY_SCORE, useScoresStore } from '../../state/scores';

const TOPIC_ID = 'sight-singing';

const TONIC_CHORD_LEN_SEC = 1.4;
const TONIC_TO_START_GAP_SEC = 0.3;
const START_NOTE_LEN_SEC = 1.2;
const REVEAL_NOTE_LEN_SEC = 0.5;
/** Mirrors interval-singing's/chord-singing's ambient RMS calibration window (docs/10 §17.3). */
const CALIBRATION_SEC = 2;

export type SightSingingRoundPhase = 'idle' | 'presenting' | 'listening' | 'revealing' | 'done';

/** Real-world duration of one mic analysis frame at the live context's sample rate (same as the other singing topics). */
function frameSec(): number {
  const ctx = audio.status === 'ready' ? audio.rawContext() : null;
  return ctx ? MIC_BUFFER_SIZE / ctx.sampleRate : MIC_BUFFER_SIZE / 44100;
}

/** Root-position triad from the key-orientation tonic (§4.1's "tonic chord"). */
function tonicTriadMidis(tonicMidi: number, mode: 'major' | 'minor'): number[] {
  const thirdOffset = mode === 'major' ? 4 : 3;
  return [tonicMidi, tonicMidi + thirdOffset, tonicMidi + 7];
}

/** 0..1 position of `noteIndex` across the whole melody, for the staff's active-note cursor (reuses playbackFraction's existing convention). */
function noteGlobalFraction(question: SightSingingQuestion, noteIndex: number): number | null {
  const measureBeats = question.melody.timeSig.measureBeats;
  const numMeasures = question.melody.measures.length;
  let counted = 0;
  for (let mi = 0; mi < question.melody.measures.length; mi++) {
    const onsets = question.melody.measures[mi]!.filter((n) => !n.rest);
    for (const n of onsets) {
      if (counted === noteIndex) {
        const globalBeat = mi * measureBeats + n.beat;
        return globalBeat / (numMeasures * measureBeats);
      }
      counted++;
    }
  }
  return null;
}

export function useSightSingingPractice(settings: SightSingingSettings) {
  const audioStatus = useAudioReady();
  const micStatus = useMicReady();
  const channelRef = useRef(createPlaybackChannel());
  useStopOnDeactivate(TOPIC_ID, channelRef.current);

  const recordAttempt = useScoresStore((s) => s.recordAttempt);
  const resetScoreInStore = useScoresStore((s) => s.resetScore);
  const score = useScoresStore((s) => s.scores[TOPIC_ID] ?? EMPTY_SCORE);

  const [question, setQuestion] = useState<SightSingingQuestion | null>(null);
  const [phase, setPhase] = useState<SightSingingRoundPhase>('idle');
  const [noteIndex, setNoteIndex] = useState(0);
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [noteResults, setNoteResults] = useState<SungGradeResult[]>([]);
  const [liveCentsOffset, setLiveCentsOffset] = useState<number | null>(null);
  const [statusText, setStatusText] = useState('Press Initialize Audio, then Enable microphone, to begin.');
  const [statusKind, setStatusKind] = useState<StatusKind>('');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackKind, setFeedbackKind] = useState<'' | 'ok' | 'bad'>('');

  // Ref twins for the mic-frame closure (same convention as the other singing topics).
  const questionRef = useRef<SightSingingQuestion | null>(null);
  const noteIndexRef = useRef(0);
  const attemptsUsedRef = useRef(0);
  const noteResultsRef = useRef<SungGradeResult[]>([]);
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

  const vocalRange = ROOT_RANGE_PRESETS[settings.vocalRange];

  function disarm() {
    armedRef.current = false;
    trackerRef.current = initialTrackerState();
    setLiveCentsOffset(null);
  }

  // Mic release on topic deactivate/unmount (docs/10 §17.1 convention).
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

  // Ambient-noise RMS calibration (same convention as the other singing topics).
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

  function armNote(index: number) {
    disarm();
    noteIndexRef.current = index;
    setNoteIndex(index);
    armedRef.current = true;
    setPhase('listening');
  }

  /** Schedules audio, then arms the given note once it finishes — guarded by roundTokenRef against a double-click race (same pattern as the other singing topics). */
  function playThenArm(segments: { midis: number[]; durSec: number; gapAfterSec?: number }[], armIndex: number) {
    disarm();
    setPhase('presenting');
    const token = ++roundTokenRef.current;
    const dur = playSequence(segments);
    window.setTimeout(() => {
      if (roundTokenRef.current !== token) return;
      armNote(armIndex);
    }, dur * 1000 + 150);
  }

  function presentQuestion(q: SightSingingQuestion) {
    const tonicChord = tonicTriadMidis(q.tonicMidi, q.melody.key.mode);
    playThenArm(
      [
        { midis: tonicChord, durSec: TONIC_CHORD_LEN_SEC, gapAfterSec: TONIC_TO_START_GAP_SEC },
        { midis: [q.targetMidis[0]!], durSec: START_NOTE_LEN_SEC },
      ],
      0,
    );
  }

  function retryAttempt() {
    const q = questionRef.current;
    if (!q) return;
    noteResultsRef.current = [];
    setNoteResults([]);
    playThenArm([{ midis: [q.targetMidis[0]!], durSec: START_NOTE_LEN_SEC }], 0);
  }

  function newQuestion() {
    clearAdvanceTimer();
    const q = buildSightSingingQuestion(settings, vocalRange);
    questionRef.current = q;
    setQuestion(q);
    attemptsUsedRef.current = 0;
    setAttemptsUsed(0);
    noteResultsRef.current = [];
    setNoteResults([]);
    setFeedbackMsg('');
    setFeedbackKind('');
    presentQuestion(q);
  }
  newQuestionRef.current = newQuestion;

  function replayStartNote() {
    const q = questionRef.current;
    if (!q) return;
    const heldNoteIndex = noteIndexRef.current;
    disarm();
    setPhase('presenting');
    const token = ++roundTokenRef.current;
    const dur = playSequence([{ midis: [q.targetMidis[0]!], durSec: START_NOTE_LEN_SEC }]);
    window.setTimeout(() => {
      if (roundTokenRef.current !== token) return;
      armNote(heldNoteIndex);
    }, dur * 1000 + 150);
  }

  function reveal() {
    const q = questionRef.current;
    if (!q) return;
    disarm();
    setPhase('revealing');
    playSequence(q.targetMidis.map((midi) => ({ midis: [midi], durSec: REVEAL_NOTE_LEN_SEC })));
    const totalDur = q.targetMidis.length * REVEAL_NOTE_LEN_SEC;
    window.setTimeout(() => setPhase('done'), totalDur * 1000 + 200);
  }

  function handleCapture(capturedMidi: number) {
    const q = questionRef.current;
    if (!q) return;
    const index = noteIndexRef.current;
    const target = q.targetMidis[index]!;
    const result = gradeSungInterval(0, target, capturedMidi, {
      toleranceCents: TOLERANCE_CENTS[settings.tolerance],
      octaveEquivalence: settings.octaveEquivalence,
    });
    const nextResults = [...noteResultsRef.current, result];
    noteResultsRef.current = nextResults;
    setNoteResults(nextResults);

    setFeedbackKind(result.correct ? 'ok' : 'bad');
    setFeedbackMsg(
      result.correct
        ? `Note ${index + 1} ✓`
        : `Note ${index + 1} ✗ ${Math.abs(Math.round(result.centsOff))}¢ ${result.centsOff < 0 ? 'flat' : 'sharp'}`,
    );

    // No early abort (§4 point 3) — the round always completes every note, even after a miss.
    if (index + 1 < q.targetMidis.length) {
      armNote(index + 1);
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
      setFeedbackMsg('Out of attempts — revealing the melody.');
      reveal();
      return;
    }

    disarm();
    const left = RECOGNITION_MAX_GUESSES - attemptsUsedRef.current;
    setFeedbackKind('bad');
    setFeedbackMsg((prev) => `${prev} — ${left} attempt${left === 1 ? '' : 's'} left. Replaying the starting note…`);
    retryAttempt();
  }

  useEffect(() => {
    return mic.onFrame((frame) => {
      if (!armedRef.current) return;
      const q = questionRef.current;
      if (q && frame.frequency !== null) {
        const targetMidi = q.targetMidis[noteIndexRef.current]!;
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
    noteIndex,
    noteResults,
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
    replayStartNote,
    stop,
    resetScore: () => resetScoreInStore(TOPIC_ID),
    activeFraction: question && phase === 'listening' ? noteGlobalFraction(question, noteIndex) : null,
  };
}
