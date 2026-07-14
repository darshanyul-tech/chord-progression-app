import { useEffect, useRef, useState } from 'react';
import { useAudioReady } from '../../hooks/useAudioReady';
import { useStopOnDeactivate } from '../../hooks/useStopOnDeactivate';
import { audio } from '../../lib/audio/engine';
import { createPlaybackChannel, scheduleSamplerTrigger, stopChannel } from '../../lib/audio/playback';
import {
  INTERVAL_TYPES,
  RECOGNITION_AUTO_ADVANCE_MS,
  RECOGNITION_MAX_GUESSES,
  buildIntervalPracticePool,
  getIntervalChoiceDefsForPractice,
  intervalPlaybackNotes,
  pickIntervalQuestion,
  type IntervalQuestion,
  type IntervalRecognitionSettings,
} from '../../lib/recognition/intervals';
import { midiToNoteName } from '../../lib/theory';
import { EMPTY_SCORE, useScoresStore } from '../../state/scores';
import type { StatusKind } from '../../components/StatusLine';

const TOPIC_ID = 'interval-recognition';

// Ported state machine for legacy startIntervalRound / playIntervalQuestion /
// submitIntervalGuess / finalizeIntervalQuestion (docs/05-topics/01 §§4-5).
export function useIntervalPractice(settings: IntervalRecognitionSettings) {
  const audioStatus = useAudioReady();
  const channelRef = useRef(createPlaybackChannel());
  useStopOnDeactivate(TOPIC_ID, channelRef.current);

  const recordAttempt = useScoresStore((s) => s.recordAttempt);
  const resetScoreInStore = useScoresStore((s) => s.resetScore);
  const score = useScoresStore((s) => s.scores[TOPIC_ID] ?? EMPTY_SCORE);

  const [question, setQuestion] = useState<IntervalQuestion | null>(null);
  const [answered, setAnswered] = useState(false);
  const [guessesUsed, setGuessesUsed] = useState(0);
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [statusText, setStatusText] = useState('Press Initialize Audio to begin.');
  const [statusKind, setStatusKind] = useState<StatusKind>('');
  const [promptText, setPromptText] = useState(
    'Enable at least one interval, then play to hear a random interval.',
  );
  const advanceTimerRef = useRef<number | null>(null);
  const skipSettingsResetRef = useRef(true);

  const pool = buildIntervalPracticePool(settings);
  const choiceDefs = getIntervalChoiceDefsForPractice(pool).map((d) => ({ id: d.id, label: d.label }));

  function clearAdvanceTimer() {
    if (advanceTimerRef.current !== null) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }

  function playQuestion(q: IntervalQuestion) {
    if (audio.status !== 'ready' || !audio.sampler) {
      setStatusText('Press Initialize Audio first.');
      setStatusKind('warn');
      return;
    }
    stopChannel(channelRef.current, audio.sampler);
    const notes = intervalPlaybackNotes(q);
    const playGen = channelRef.current.playbackGen;
    let cursor = audio.now() + 0.12;
    notes.forEach((midi) => {
      const note = midiToNoteName(midi);
      scheduleSamplerTrigger(audio.sampler, channelRef.current, playGen, cursor, note, q.playback.noteLen, 0.88);
      cursor += q.playback.noteLen + q.playback.gap;
    });
    setStatusText('Listen…');
    setStatusKind('');
  }

  function startRound() {
    if (!pool.pool.length) {
      setStatusText('Enable at least one interval for the selected direction.');
      setStatusKind('warn');
      return;
    }
    clearAdvanceTimer();
    const q = pickIntervalQuestion(pool);
    setQuestion(q);
    setAnswered(false);
    setGuessesUsed(0);
    setWrongIds([]);
    setPromptText('Which interval did you hear? (3 guesses; first guess counts for score)');
    if (q) playQuestion(q);
  }

  const startRoundRef = useRef(startRound);
  startRoundRef.current = startRound;

  function finalize(solved: boolean, firstGuessCorrect: boolean) {
    if (!question) return;
    setAnswered(true);
    recordAttempt(TOPIC_ID, firstGuessCorrect);
    const dirLabel = question.direction === 'asc' ? 'Ascending' : 'Descending';
    const actualType = INTERVAL_TYPES.find((t) => t.id === question.id);
    const actualLabel = actualType ? actualType.label : question.label;
    const answerText = `${dirLabel} ${actualLabel}`;
    if (solved && firstGuessCorrect) {
      setPromptText(`✓ Correct on your first guess — ${answerText}.`);
      setStatusText('Correct! Point added.');
      setStatusKind('');
    } else if (solved) {
      setPromptText(`✓ Correct — ${answerText}. (No score point; only the first guess counts.)`);
      setStatusText('Correct, but not on your first try — no point added.');
      setStatusKind('');
    } else {
      setPromptText(`✗ Out of guesses — it was ${answerText}.`);
      setStatusText('Incorrect — see highlighted answer.');
      setStatusKind('');
    }
    if (settings.autoAdvance) {
      advanceTimerRef.current = window.setTimeout(() => {
        advanceTimerRef.current = null;
        startRoundRef.current();
      }, RECOGNITION_AUTO_ADVANCE_MS);
    }
  }

  function submitGuess(intervalId: string) {
    if (!question || answered || wrongIds.includes(intervalId)) return;
    const nextGuessesUsed = guessesUsed + 1;
    setGuessesUsed(nextGuessesUsed);
    const correct = intervalId === question.id;
    const firstGuess = nextGuessesUsed === 1;
    if (correct) {
      finalize(true, firstGuess);
      return;
    }
    setWrongIds((prev) => [...prev, intervalId]);
    if (nextGuessesUsed >= RECOGNITION_MAX_GUESSES) {
      finalize(false, false);
      return;
    }
    const left = RECOGNITION_MAX_GUESSES - nextGuessesUsed;
    setPromptText(`Not quite — ${left} guess${left === 1 ? '' : 'es'} left.`);
    setStatusText('Try again.');
    setStatusKind('warn');
  }

  function replay() {
    if (!question) return;
    playQuestion(question);
  }

  function stop() {
    stopChannel(channelRef.current, audio.sampler);
    setStatusText('Stopped.');
    setStatusKind('');
  }

  async function init() {
    if (audio.status === 'ready' || audio.status === 'loading') return;
    setStatusText('Loading piano samples...');
    setStatusKind('');
    await audio.initAudio();
  }

  useEffect(() => {
    if (audioStatus === 'ready') {
      setStatusText('Audio ready. Press Play interval.');
      setStatusKind('');
    } else if (audioStatus === 'error') {
      setStatusText(`Audio init failed: ${audio.lastError ?? 'unknown error'}`);
      setStatusKind('error');
    }
  }, [audioStatus]);

  // Changing direction/enabled-intervals clears the in-progress question
  // (legacy onIntervalSettingsChange) — but not on the initial mount.
  useEffect(() => {
    if (skipSettingsResetRef.current) {
      skipSettingsResetRef.current = false;
      return;
    }
    clearAdvanceTimer();
    setQuestion(null);
    setAnswered(false);
    setGuessesUsed(0);
    setWrongIds([]);
    setPromptText('Settings updated. Press Play interval for a new question.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.direction, JSON.stringify(settings.enabledIntervals)]);

  return {
    audioStatus,
    question,
    answered,
    choiceDefs,
    wrongIds,
    correctId: answered && question ? question.id : null,
    statusText,
    statusKind,
    promptText,
    score,
    init,
    play: startRound,
    replay,
    stop,
    submitGuess,
    next: startRound,
    resetScore: () => resetScoreInStore(TOPIC_ID),
  };
}
