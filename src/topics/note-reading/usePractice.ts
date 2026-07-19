import { useEffect, useRef, useState } from 'react';
import type { StatusKind } from '../../components/StatusLine';
import type { GroupedChoiceGroup } from '../../components/GroupedChoiceGrid';
import {
  buildNoteReadingChoiceGroups,
  buildNoteReadingQuestion,
  type NoteReadingQuestion,
  type NoteReadingSettings,
} from '../../lib/written-theory/noteReading';
import { RECOGNITION_AUTO_ADVANCE_MS, RECOGNITION_MAX_GUESSES } from '../../lib/recognition/scales';
import { EMPTY_SCORE, useScoresStore } from '../../state/scores';

const TOPIC_ID = 'note-reading';

// Choice-frame topic (docs/14-theory-engine.md §9a): no transport row (there
// is nothing to play), so a question is generated immediately on mount and
// again whenever settings change or Next is pressed.
export function useNoteReadingPractice(settings: NoteReadingSettings) {
  const recordAttempt = useScoresStore((s) => s.recordAttempt);
  const resetScoreInStore = useScoresStore((s) => s.resetScore);
  const score = useScoresStore((s) => s.scores[TOPIC_ID] ?? EMPTY_SCORE);

  const [question, setQuestion] = useState<NoteReadingQuestion | null>(null);
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
    const q = buildNoteReadingQuestion(settings);
    setQuestion(q);
    setAnswered(false);
    setGuessesUsed(0);
    setWrongIds([]);
    setStatusText(q ? 'Name the note.' : 'Enable at least one clef in the settings above.');
    setStatusKind(q ? '' : 'warn');
  }

  const startRoundRef = useRef(startRound);
  startRoundRef.current = startRound;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => startRoundRef.current(), [settings.clefs.join(','), settings.range, settings.accidentals, settings.octaveNumbers]);

  useEffect(() => clearAdvanceTimer, []);

  function finalize(correct: boolean, firstGuess: boolean) {
    if (!question) return;
    setAnswered(true);
    recordAttempt(TOPIC_ID, correct && firstGuess);
    if (correct) {
      setStatusText(firstGuess ? 'Correct! Point added.' : `Correct — that was ${question.answerId}.`);
      setStatusKind('');
    } else {
      setStatusText(`Out of guesses — that was ${question.answerId}.`);
      setStatusKind('');
    }
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

  const choiceGroups: GroupedChoiceGroup[] = question
    ? buildNoteReadingChoiceGroups(question.clef, settings.range, settings.accidentals, settings.octaveNumbers)
    : [];

  return {
    question,
    answered,
    wrongIds,
    correctId: answered && question ? question.answerId : null,
    statusText,
    statusKind,
    choiceGroups,
    score,
    submitGuess,
    next: startRound,
    resetScore: () => resetScoreInStore(TOPIC_ID),
  };
}
