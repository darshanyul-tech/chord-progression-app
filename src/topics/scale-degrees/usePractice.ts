import { useEffect, useRef, useState } from 'react';
import type { StatusKind } from '../../components/StatusLine';
import {
  buildScaleDegreeChoices,
  buildScaleDegreeQuestion,
  scaleDegreeRevealText,
  type ScaleDegreeChoice,
  type ScaleDegreeQuestion,
  type ScaleDegreesSettings,
} from '../../lib/written-theory/scaleDegrees';
import { RECOGNITION_AUTO_ADVANCE_MS, RECOGNITION_MAX_GUESSES } from '../../lib/recognition/scales';
import { EMPTY_SCORE, useScoresStore } from '../../state/scores';

const TOPIC_ID = 'scale-degrees';

export function useScaleDegreesPractice(settings: ScaleDegreesSettings) {
  const recordAttempt = useScoresStore((s) => s.recordAttempt);
  const resetScoreInStore = useScoresStore((s) => s.resetScore);
  const score = useScoresStore((s) => s.scores[TOPIC_ID] ?? EMPTY_SCORE);

  const [question, setQuestion] = useState<ScaleDegreeQuestion | null>(null);
  const [answered, setAnswered] = useState(false);
  const [guessesUsed, setGuessesUsed] = useState(0);
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [statusText, setStatusText] = useState('');
  const [statusKind, setStatusKind] = useState<StatusKind>('');
  const advanceTimerRef = useRef<number | null>(null);

  function clearAdvanceTimer() {
    if (advanceTimerRef.current !== null) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }

  function startRound() {
    clearAdvanceTimer();
    const q = buildScaleDegreeQuestion(settings);
    setQuestion(q);
    setAnswered(false);
    setGuessesUsed(0);
    setWrongIds([]);
    setStatusText(q ? 'Which scale degree?' : 'Enable at least one key.');
    setStatusKind(q ? '' : 'warn');
  }

  const startRoundRef = useRef(startRound);
  startRoundRef.current = startRound;

  useEffect(() => startRoundRef.current(), [settings.keys, settings.maxAccidentals, settings.display, settings.degreeLabels]);

  useEffect(() => clearAdvanceTimer, []);

  function finalize(correct: boolean, firstGuess: boolean) {
    if (!question) return;
    setAnswered(true);
    recordAttempt(TOPIC_ID, correct && firstGuess);
    const revealText = scaleDegreeRevealText(question.key, question.degree);
    setStatusText(
      correct
        ? firstGuess
          ? `Correct! Point added. ${revealText}`
          : `Correct — ${revealText}`
        : `Out of guesses — ${revealText}`,
    );
    setStatusKind('');
    if (settings.autoAdvance) {
      advanceTimerRef.current = window.setTimeout(() => {
        advanceTimerRef.current = null;
        startRoundRef.current();
      }, RECOGNITION_AUTO_ADVANCE_MS);
    }
  }

  function submitGuess(id: string) {
    if (!question || answered || wrongIds.includes(id)) return;
    const nextGuessesUsed = guessesUsed + 1;
    setGuessesUsed(nextGuessesUsed);
    const firstGuess = nextGuessesUsed === 1;
    if (id === String(question.degree)) {
      finalize(true, firstGuess);
      return;
    }
    setWrongIds((prev) => [...prev, id]);
    if (nextGuessesUsed >= RECOGNITION_MAX_GUESSES) {
      finalize(false, false);
      return;
    }
    const left = RECOGNITION_MAX_GUESSES - nextGuessesUsed;
    setStatusText(`Not quite — ${left} guess${left === 1 ? '' : 'es'} left.`);
    setStatusKind('warn');
  }

  const choices: ScaleDegreeChoice[] = question ? buildScaleDegreeChoices(question.key.mode, settings.degreeLabels) : [];

  return {
    question,
    answered,
    wrongIds,
    correctId: answered && question ? String(question.degree) : null,
    statusText,
    statusKind,
    choices,
    score,
    submitGuess,
    next: startRound,
    resetScore: () => resetScoreInStore(TOPIC_ID),
  };
}
