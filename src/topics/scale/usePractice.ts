import { useEffect, useRef, useState } from 'react';
import { useAudioReady } from '../../hooks/useAudioReady';
import { useStopOnDeactivate } from '../../hooks/useStopOnDeactivate';
import { audio } from '../../lib/audio/engine';
import { createPlaybackChannel, scheduleChannelDone, scheduleSamplerTrigger, stopChannel } from '../../lib/audio/playback';
import {
  RECOGNITION_AUTO_ADVANCE_MS,
  RECOGNITION_MAX_GUESSES,
  buildScaleExamChoiceGrouped,
  buildScalePlaybackMidis,
  pickScaleQuestion,
  type ScaleQuestion,
  type ScaleRecognitionSettings,
} from '../../lib/recognition/scales';
import { midiToNoteName } from '../../lib/theory';
import { EMPTY_SCORE, useScoresStore } from '../../state/scores';
import type { StatusKind } from '../../components/StatusLine';

const TOPIC_ID = 'scales';

// Ported state machine for legacy startScaleRound / playScaleQuestion /
// submitScaleGuess / finalizeScaleQuestion (docs/05-topics/02 §§4-6).
export function useScalePractice(settings: ScaleRecognitionSettings) {
  const audioStatus = useAudioReady();
  const channelRef = useRef(createPlaybackChannel());
  useStopOnDeactivate(TOPIC_ID, channelRef.current);

  const recordAttempt = useScoresStore((s) => s.recordAttempt);
  const resetScoreInStore = useScoresStore((s) => s.resetScore);
  const score = useScoresStore((s) => s.scores[TOPIC_ID] ?? EMPTY_SCORE);

  const [question, setQuestion] = useState<ScaleQuestion | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [guessesUsed, setGuessesUsed] = useState(0);
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [statusText, setStatusText] = useState('Press Initialize Audio to begin.');
  const [statusKind, setStatusKind] = useState<StatusKind>('');
  const [promptText, setPromptText] = useState('Enable at least one scale, then play to hear a random scale.');
  const advanceTimerRef = useRef<number | null>(null);
  const skipSettingsResetRef = useRef(true);

  const choiceGroups = buildScaleExamChoiceGrouped(settings.enabledScales);

  function clearAdvanceTimer() {
    if (advanceTimerRef.current !== null) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }

  function playQuestion(q: ScaleQuestion) {
    if (audio.status !== 'ready' || !audio.sampler) {
      setStatusText('Press Initialize Audio first.');
      setStatusKind('warn');
      return;
    }
    stopChannel(channelRef.current, audio.sampler);
    const midis = buildScalePlaybackMidis(q.rootMidi, q.intervals, settings.descend);
    const playGen = channelRef.current.playbackGen;
    let cursor = audio.now() + 0.1;
    midis.forEach((midi) => {
      const note = midiToNoteName(midi);
      scheduleSamplerTrigger(audio.sampler, channelRef.current, playGen, cursor, note, settings.noteLen, 0.88);
      cursor += settings.noteLen + settings.noteGap;
    });
    setIsPlaying(true);
    scheduleChannelDone(channelRef.current, cursor - audio.now(), () => setIsPlaying(false));
    setStatusText('Listen…');
    setStatusKind('');
  }

  function startRound() {
    if (!settings.enabledScales.length) {
      setStatusText('Enable at least one scale for the selected direction.');
      setStatusKind('warn');
      return;
    }
    clearAdvanceTimer();
    const q = pickScaleQuestion(settings);
    setQuestion(q);
    setAnswered(false);
    setGuessesUsed(0);
    setWrongIds([]);
    setPromptText('Which scale did you hear? (3 guesses; first guess counts for score)');
    if (q) playQuestion(q);
  }

  const startRoundRef = useRef(startRound);
  startRoundRef.current = startRound;

  function finalize(solved: boolean, firstGuessCorrect: boolean) {
    if (!question) return;
    setAnswered(true);
    recordAttempt(TOPIC_ID, firstGuessCorrect);
    const answerText = `${question.rootName} ${question.label}`;
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

  function submitGuess(scaleId: string) {
    if (!question || answered || wrongIds.includes(scaleId)) return;
    const nextGuessesUsed = guessesUsed + 1;
    setGuessesUsed(nextGuessesUsed);
    const correct = scaleId === question.id;
    const firstGuess = nextGuessesUsed === 1;
    if (correct) {
      finalize(true, firstGuess);
      return;
    }
    setWrongIds((prev) => [...prev, scaleId]);
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
    if (!question || isPlaying) return;
    playQuestion(question);
  }

  function stop() {
    stopChannel(channelRef.current, audio.sampler);
    setIsPlaying(false);
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
      setStatusText('Audio ready. Press Play scale.');
      setStatusKind('');
    } else if (audioStatus === 'error') {
      setStatusText(`Audio init failed: ${audio.lastError ?? 'unknown error'}`);
      setStatusKind('error');
    }
  }, [audioStatus]);

  // Changing enabled scales clears the in-progress question (legacy
  // onScaleSettingsChange) — but not on the initial mount. Descend/timing
  // changes do NOT reset the question, matching legacy.
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
    setPromptText('Settings updated. Press Play scale for a new question.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.enabledScales.join(',')]);

  return {
    audioStatus,
    question,
    isPlaying,
    answered,
    choiceGroups,
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
