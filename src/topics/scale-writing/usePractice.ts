import { useEffect, useRef, useState } from 'react';
import { audio } from '../../lib/audio/engine';
import {
  buildScaleWritingQuestion,
  isMelodicMinorDescendingException,
  scaleWritingPromptText,
  type ScaleWritingQuestion,
  type ScaleWritingSettings,
} from '../../lib/written-theory/scaleWriting';
import { spelledToMidi, spellingsEqual, type Accidental, type SpelledPitch } from '../../lib/written-theory/spelledPitch';
import type { NoteSpelling } from '../../lib/melody/theory';
import { midiToNoteName } from '../../lib/theory';
import { EMPTY_SCORE, useScoresStore } from '../../state/scores';

const TOPIC_ID = 'scale-writing';
const WRONG_COLOR = '#b3261e';
const SLOT_COUNT = 8;

function toSpelledPitch(n: NoteSpelling): SpelledPitch {
  return { letter: n.letter, acc: n.accidental as Accidental, octave: n.octave };
}

export function useScaleWritingPractice(settings: ScaleWritingSettings) {
  const recordAttempt = useScoresStore((s) => s.recordAttempt);
  const resetScoreInStore = useScoresStore((s) => s.resetScore);
  const score = useScoresStore((s) => s.scores[TOPIC_ID] ?? EMPTY_SCORE);

  const [question, setQuestion] = useState<ScaleWritingQuestion | null>(null);
  const [userSlots, setUserSlots] = useState<(SpelledPitch | null)[]>(Array(SLOT_COUNT).fill(null));
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
    const q = buildScaleWritingQuestion(settings);
    setQuestion(q);
    const slots = Array(SLOT_COUNT).fill(null) as (SpelledPitch | null)[];
    if (q) slots[0] = q.expected[0]!;
    setUserSlots(slots);
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
    [settings.scales.join(','), settings.direction, settings.clefs.join(',')],
  );

  useEffect(() => clearAdvanceTimer, []);

  function placeAt(slotIndex: number, spelling: NoteSpelling) {
    if (hasSubmitted || slotIndex === 0) return;
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
    setUserSlots((prev) => prev.map((s, i) => (i === 0 ? s : null)));
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
      const name = midiToNoteName(spelledToMidi(slot));
      audio.sampler!.triggerAttackRelease(name, 0.35, audio.now() + i * 0.35);
    });
  }

  function checkAnswer() {
    if (!question || userSlots.some((s) => !s)) return;
    setHasSubmitted(true);
    const correctCount = userSlots.filter((s, i) => spellingsEqual(s!, question.expected[i]!)).length;
    const correct = correctCount === SLOT_COUNT;
    setIsCorrect(correct);
    recordAttempt(TOPIC_ID, correct);
    if (correct) {
      setFeedbackKind('ok');
      setFeedbackMsg(
        isMelodicMinorDescendingException(question)
          ? 'Correct! +1 (melodic minor descending uses the natural-minor form).'
          : 'Correct! +1',
      );
    } else {
      setFeedbackKind('bad');
      setFeedbackMsg(`Incorrect — ${correctCount} of ${SLOT_COUNT} notes correct. See the correction on the staff.`);
    }
    if (settings.hearIt) playHearIt();
    if (correct && settings.autoAdvance) {
      advanceTimerRef.current = window.setTimeout(() => {
        advanceTimerRef.current = null;
        startRoundRef.current();
      }, 450);
    }
  }

  const submitEnabled = !hasSubmitted && userSlots.every((s) => !!s);
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
    promptText: question ? scaleWritingPromptText(question) : '',
    slots,
    slotColors,
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
