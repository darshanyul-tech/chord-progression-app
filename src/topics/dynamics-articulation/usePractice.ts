import { useEffect, useRef, useState } from 'react';
import type { StatusKind } from '../../components/StatusLine';
import { useAudioReady } from '../../hooks/useAudioReady';
import { useStopOnDeactivate } from '../../hooks/useStopOnDeactivate';
import { audio } from '../../lib/audio/engine';
import { createPlaybackChannel, scheduleChannelDone, scheduleSamplerTrigger, stopChannel } from '../../lib/audio/playback';
import {
  articulationById,
  buildDynamicsArticulationQuestion,
  type DAQuestion,
  type DASettings,
} from '../../lib/recognition/dynamicsArticulation';
import { RECOGNITION_AUTO_ADVANCE_MS, RECOGNITION_MAX_GUESSES } from '../../lib/recognition/intervals';
import { midiToNoteName } from '../../lib/theory';
import { EMPTY_SCORE, useScoresStore } from '../../state/scores';

const TOPIC_ID = 'dynamics-articulation';

// New topic, no legacy source (docs/05-topics/12-dynamics-articulation.md
// §4-5) — same recognition-topic shape as the comparison topics; the
// "hearing" is one phrase (articulation mode) or the phrase played twice at
// different velocities (dynamics mode), one note per beat.
export function useDynamicsArticulationPractice(settings: DASettings) {
  const audioStatus = useAudioReady();
  const channelRef = useRef(createPlaybackChannel());
  useStopOnDeactivate(TOPIC_ID, channelRef.current);

  const recordAttempt = useScoresStore((s) => s.recordAttempt);
  const resetScoreInStore = useScoresStore((s) => s.resetScore);
  const score = useScoresStore((s) => s.scores[TOPIC_ID] ?? EMPTY_SCORE);

  const [question, setQuestion] = useState<DAQuestion | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [guessesUsed, setGuessesUsed] = useState(0);
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [statusText, setStatusText] = useState('Press Initialize Audio to begin.');
  const [statusKind, setStatusKind] = useState<StatusKind>('');
  const [promptText, setPromptText] = useState('Play a phrase, then answer below.');
  const advanceTimerRef = useRef<number | null>(null);
  const skipSettingsResetRef = useRef(true);

  function clearAdvanceTimer() {
    if (advanceTimerRef.current !== null) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }

  function playQuestion(q: DAQuestion) {
    if (audio.status !== 'ready' || !audio.sampler) {
      setStatusText('Press Initialize Audio first.');
      setStatusKind('warn');
      return;
    }
    stopChannel(channelRef.current, audio.sampler);
    const playGen = channelRef.current.playbackGen;
    const beatLen = 60 / settings.tempo;
    let cursor = audio.now() + 0.1;

    function schedulePhrase(noteLen: number, velocity: number) {
      q.phraseMidis.forEach((midi) => {
        scheduleSamplerTrigger(audio.sampler, channelRef.current, playGen, cursor, midiToNoteName(midi), noteLen, velocity);
        cursor += beatLen;
      });
    }

    if (q.mode === 'dynamics') {
      schedulePhrase(beatLen * 0.9, q.velocityA);
      cursor += beatLen; // one beat of silence between the two hearings
      schedulePhrase(beatLen * 0.9, q.velocityB);
    } else {
      const def = articulationById(q.articulationId)!;
      schedulePhrase(beatLen * def.noteLenFraction, def.velocity);
    }

    setIsPlaying(true);
    scheduleChannelDone(channelRef.current, cursor - audio.now(), () => setIsPlaying(false));
    setStatusText('Listen…');
    setStatusKind('');
  }

  function startRound() {
    clearAdvanceTimer();
    const q = buildDynamicsArticulationQuestion(settings);
    setQuestion(q);
    setAnswered(false);
    setGuessesUsed(0);
    setWrongIds([]);
    if (!q) {
      setStatusText('Enable at least two articulations to practise.');
      setStatusKind('warn');
      setPromptText('Adjust settings above, then press Play phrase.');
      return;
    }
    setPromptText(
      settings.mode === 'dynamics'
        ? 'Is the second hearing louder, softer, or the same? (3 guesses; first guess counts for score)'
        : 'Which articulation did you hear? (3 guesses; first guess counts for score)',
    );
    playQuestion(q);
  }

  const startRoundRef = useRef(startRound);
  startRoundRef.current = startRound;

  function finalize(solved: boolean, firstGuessCorrect: boolean) {
    if (!question) return;
    setAnswered(true);
    recordAttempt(TOPIC_ID, firstGuessCorrect);
    const answerText =
      question.mode === 'dynamics'
        ? question.answerId === 'same'
          ? 'the second hearing was the same loudness'
          : `the second hearing was ${question.answerId}`
        : `it was ${articulationById(question.articulationId)?.label ?? question.articulationId} — ${articulationById(question.articulationId)?.description ?? ''}`;
    if (solved && firstGuessCorrect) {
      setPromptText(`✓ Correct on your first guess — ${answerText}.`);
      setStatusText('Correct! Point added.');
      setStatusKind('');
    } else if (solved) {
      setPromptText(`✓ Correct — ${answerText}. (No score point; only the first guess counts.)`);
      setStatusText('Correct, but not on your first try — no point added.');
      setStatusKind('');
    } else {
      setPromptText(`✗ Out of guesses — ${answerText}.`);
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

  function submitGuess(answerId: string) {
    if (!question || answered || wrongIds.includes(answerId)) return;
    const nextGuessesUsed = guessesUsed + 1;
    setGuessesUsed(nextGuessesUsed);
    const correct = answerId === question.answerId;
    const firstGuess = nextGuessesUsed === 1;
    if (correct) {
      finalize(true, firstGuess);
      return;
    }
    setWrongIds((prev) => [...prev, answerId]);
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
      setStatusText('Audio ready. Press Play phrase.');
      setStatusKind('');
    } else if (audioStatus === 'error') {
      setStatusText(`Audio init failed: ${audio.lastError ?? 'unknown error'}`);
      setStatusKind('error');
    }
  }, [audioStatus]);

  // Changing mode/difficulty/pool clears the in-progress question (same
  // convention as the other recognition topics) — but not on the initial mount.
  const enabledArticulationsKey = settings.enabledArticulations.join(',');
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
    setPromptText('Settings updated. Press Play phrase for a new question.');
    setStatusText('Settings updated.');
    setStatusKind('');
  }, [settings.mode, settings.difficulty, enabledArticulationsKey]);

  return {
    audioStatus,
    question,
    isPlaying,
    answered,
    wrongIds,
    correctId: answered && question ? question.answerId : null,
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
