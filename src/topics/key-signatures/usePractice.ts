import { useEffect, useRef, useState } from 'react';
import type { StatusKind } from '../../components/StatusLine';
import type { ChoiceDef } from '../../components/ChoiceGrid';
import {
  buildKeySignatureChoices,
  buildKeySignatureQuestion,
  type KeySignatureQuestion,
  type KeySignatureSettings,
} from '../../lib/written-theory/keySignatures';
import { RECOGNITION_AUTO_ADVANCE_MS, RECOGNITION_MAX_GUESSES } from '../../lib/recognition/scales';
import { EMPTY_SCORE, useScoresStore } from '../../state/scores';

const TOPIC_ID = 'key-signatures';

export function useKeySignaturePractice(settings: KeySignatureSettings) {
  const recordAttempt = useScoresStore((s) => s.recordAttempt);
  const resetScoreInStore = useScoresStore((s) => s.resetScore);
  const score = useScoresStore((s) => s.scores[TOPIC_ID] ?? EMPTY_SCORE);

  const [question, setQuestion] = useState<KeySignatureQuestion | null>(null);
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
    const q = buildKeySignatureQuestion(settings);
    setQuestion(q);
    setAnswered(false);
    setGuessesUsed(0);
    setWrongIds([]);
    setStatusText(q ? `Name the ${q.askMode} key.` : 'Enable at least one clef in the settings above.');
    setStatusKind(q ? '' : 'warn');
  }

  const startRoundRef = useRef(startRound);
  startRoundRef.current = startRound;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => startRoundRef.current(), [settings.askFor, settings.maxAccidentals, settings.clefs.join(',')]);

  useEffect(() => clearAdvanceTimer, []);

  function finalize(correct: boolean, firstGuess: boolean) {
    if (!question) return;
    setAnswered(true);
    recordAttempt(TOPIC_ID, correct && firstGuess);
    const revealText = `${question.accidentalCount} accidental${question.accidentalCount === 1 ? '' : 's'} — ${question.majorLabel} / ${question.minorLabel}.`;
    if (correct) {
      setStatusText(firstGuess ? `Correct! Point added. ${revealText}` : `Correct — ${revealText}`);
    } else {
      setStatusText(`Out of guesses — ${revealText}`);
    }
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
    if (id === question.answerId) {
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

  const choices: ChoiceDef[] = question ? buildKeySignatureChoices(question.askMode) : [];

  return {
    question,
    answered,
    wrongIds,
    correctId: answered && question ? question.answerId : null,
    statusText,
    statusKind,
    choices,
    score,
    submitGuess,
    next: startRound,
    resetScore: () => resetScoreInStore(TOPIC_ID),
  };
}
