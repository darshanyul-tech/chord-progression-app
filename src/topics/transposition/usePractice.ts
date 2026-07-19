import { useEffect, useRef, useState } from 'react';
import { audio } from '../../lib/audio/engine';
import {
  buildTranspositionQuestion,
  transpositionPromptText,
  type TranspositionQuestion,
  type TranspositionSettings,
} from '../../lib/written-theory/transposition';
import { theoryKeyById } from '../../lib/written-theory/keys';
import { spelledToMidi, spellingsEqual, type Accidental, type SpelledPitch } from '../../lib/written-theory/spelledPitch';
import type { NoteSpelling } from '../../lib/melody/theory';
import { midiToNoteName } from '../../lib/theory';
import { EMPTY_SCORE, useScoresStore } from '../../state/scores';

const TOPIC_ID = 'transposition';
const WRONG_COLOR = '#b3261e';

function toSpelledPitch(n: NoteSpelling): SpelledPitch {
  return { letter: n.letter, acc: n.accidental as Accidental, octave: n.octave };
}

export function useTranspositionPractice(settings: TranspositionSettings) {
  const recordAttempt = useScoresStore((s) => s.recordAttempt);
  const resetScoreInStore = useScoresStore((s) => s.resetScore);
  const score = useScoresStore((s) => s.scores[TOPIC_ID] ?? EMPTY_SCORE);

  const [question, setQuestion] = useState<TranspositionQuestion | null>(null);
  const [userSlots, setUserSlots] = useState<(SpelledPitch | null)[]>([]);
  const [placementOrder, setPlacementOrder] = useState<number[]>([]);
  const [armedAccidental, setArmedAccidental] = useState<'' | '#' | 'b'>('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackKind, setFeedbackKind] = useState<'' | 'ok' | 'bad'>('');
  const advanceTimerRef = useRef<number | null>(null);

  function clearAdvanceTimer() {
    if (advanceTimerRef.current !== null) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }

  function startRound() {
    clearAdvanceTimer();
    const q = buildTranspositionQuestion(settings);
    setQuestion(q);
    setUserSlots(q ? Array(q.expected.length).fill(null) : []);
    setPlacementOrder([]);
    setArmedAccidental('');
    setHasSubmitted(false);
    setIsCorrect(false);
    setFeedbackMsg('');
    setFeedbackKind('');
  }

  const startRoundRef = useRef(startRound);
  startRoundRef.current = startRound;

  useEffect(
    () => startRoundRef.current(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings.mode, settings.phrasing, settings.intervals.join(','), settings.length, settings.clef],
  );

  useEffect(() => clearAdvanceTimer, []);

  function placeAt(slotIndex: number, spelling: NoteSpelling) {
    if (hasSubmitted) return;
    setUserSlots((prev) => prev.map((s, i) => (i === slotIndex ? toSpelledPitch(spelling) : s)));
    setPlacementOrder((prev) => [...prev.filter((i) => i !== slotIndex), slotIndex]);
  }

  function removeLast() {
    if (hasSubmitted || !placementOrder.length) return;
    const last = placementOrder[placementOrder.length - 1]!;
    setUserSlots((prev) => prev.map((s, i) => (i === last ? null : s)));
    setPlacementOrder((prev) => prev.slice(0, -1));
  }

  function clearAll() {
    if (hasSubmitted) return;
    setUserSlots((prev) => prev.map(() => null));
    setPlacementOrder([]);
  }

  function toggleSharp() {
    setArmedAccidental((p) => (p === '#' ? '' : '#'));
  }
  function toggleFlat() {
    setArmedAccidental((p) => (p === 'b' ? '' : 'b'));
  }

  function playHearIt() {
    if (!question || audio.status !== 'ready' || !audio.sampler) return;
    userSlots.forEach((slot, i) => {
      if (!slot) return;
      audio.sampler!.triggerAttackRelease(midiToNoteName(spelledToMidi(slot)), 0.35, audio.now() + i * 0.35);
    });
  }

  function checkAnswer() {
    if (!question || userSlots.some((s) => !s)) return;
    setHasSubmitted(true);
    const correctCount = userSlots.filter((s, i) => spellingsEqual(s!, question.expected[i]!)).length;
    const correct = correctCount === question.expected.length;
    setIsCorrect(correct);
    recordAttempt(TOPIC_ID, correct);
    if (correct) {
      setFeedbackKind('ok');
      setFeedbackMsg('Correct! +1');
    } else {
      setFeedbackKind('bad');
      setFeedbackMsg(`Incorrect — ${correctCount} of ${question.expected.length} notes correct. See the correction on the staff.`);
    }
    if (correct && settings.autoAdvance) {
      advanceTimerRef.current = window.setTimeout(() => {
        advanceTimerRef.current = null;
        startRoundRef.current();
      }, 450);
    }
  }

  const submitEnabled = !hasSubmitted && !!question && userSlots.every((s) => !!s);
  const showingReveal = hasSubmitted && !isCorrect && !!question;
  const slots: (SpelledPitch | null)[] = showingReveal
    ? userSlots.map((s, i) => (spellingsEqual(s!, question!.expected[i]!) ? s : question!.expected[i]!))
    : userSlots;
  const slotColors: (string | undefined)[] | undefined = showingReveal
    ? userSlots.map((s, i) => (spellingsEqual(s!, question!.expected[i]!) ? undefined : WRONG_COLOR))
    : undefined;

  return {
    audioStatus: audio.status,
    question,
    promptText: question ? transpositionPromptText(question) : '',
    targetKey: question ? theoryKeyById(question.targetKeyId) : null,
    slots,
    slotColors,
    // The answer's rhythm is locked to the source melody's own real
    // durations (docs §1) — one entry per non-rest note, same flattened
    // order spellNoteInKey used to build sourceSpelled/expected.
    durations: question ? question.sourceMelody.measures.flatMap((bar) => bar.filter((n) => !n.rest).map((n) => n.duration)) : [],
    armedAccidental,
    hasSubmitted,
    isCorrect,
    submitEnabled,
    feedbackMsg,
    feedbackKind,
    score,
    placeAt,
    removeLast,
    clearAll,
    toggleSharp,
    toggleFlat,
    checkAnswer,
    playHearIt,
    next: startRound,
    resetScore: () => resetScoreInStore(TOPIC_ID),
  };
}
