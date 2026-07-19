import { useEffect, useRef, useState } from 'react';
import { audio } from '../../lib/audio/engine';
import {
  buildIntervalWritingQuestion,
  intervalWritingPromptText,
  type IntervalWritingQuestion,
  type IntervalWritingSettings,
} from '../../lib/written-theory/intervalWriting';
import { spelledToMidi, spellingsEqual, type Accidental, type SpelledPitch } from '../../lib/written-theory/spelledPitch';
import type { NoteSpelling } from '../../lib/melody/theory';
import { midiToNoteName } from '../../lib/theory';
import { EMPTY_SCORE, useScoresStore } from '../../state/scores';

const TOPIC_ID = 'interval-writing';
const WRONG_COLOR = '#b3261e';

function toSpelledPitch(n: NoteSpelling): SpelledPitch {
  return { letter: n.letter, acc: n.accidental as Accidental, octave: n.octave };
}

// Writing-frame contract (docs/14-theory-engine.md §9b), matching melodic
// dictation's own checkAnswer/reveal shape exactly: one submit, correct only
// scores on that single submit, incorrect draws the expected note in red and
// locks the question until Next.
export function useIntervalWritingPractice(settings: IntervalWritingSettings) {
  const recordAttempt = useScoresStore((s) => s.recordAttempt);
  const resetScoreInStore = useScoresStore((s) => s.resetScore);
  const score = useScoresStore((s) => s.scores[TOPIC_ID] ?? EMPTY_SCORE);

  const [question, setQuestion] = useState<IntervalWritingQuestion | null>(null);
  const [answerSlot, setAnswerSlot] = useState<SpelledPitch | null>(null);
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
    const q = buildIntervalWritingQuestion(settings);
    setQuestion(q);
    setAnswerSlot(null);
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
    [settings.intervals.join(','), settings.direction, settings.clefs.join(',')],
  );

  useEffect(() => clearAdvanceTimer, []);

  function placeAt(slotIndex: number, spelling: NoteSpelling) {
    if (hasSubmitted || slotIndex !== 1) return;
    setAnswerSlot(toSpelledPitch(spelling));
  }

  function removeLast() {
    if (hasSubmitted) return;
    setAnswerSlot(null);
  }

  function clearAll() {
    removeLast();
  }

  function toggleSharp() {
    setArmedAccidental((p) => (p === '#' ? '' : '#'));
  }
  function toggleFlat() {
    setArmedAccidental((p) => (p === 'b' ? '' : 'b'));
  }

  function playHearIt() {
    if (!question || audio.status !== 'ready' || !audio.sampler) return;
    const givenName = midiToNoteName(spelledToMidi(question.given));
    const answerName = answerSlot ? midiToNoteName(spelledToMidi(answerSlot)) : null;
    audio.sampler.triggerAttackRelease(givenName, 0.5, audio.now());
    if (answerName) audio.sampler.triggerAttackRelease(answerName, 0.5, audio.now() + 0.5);
  }

  function checkAnswer() {
    if (!question || !answerSlot) return;
    setHasSubmitted(true);
    const correct = spellingsEqual(answerSlot, question.expected);
    setIsCorrect(correct);
    recordAttempt(TOPIC_ID, correct);
    if (correct) {
      setFeedbackKind('ok');
      setFeedbackMsg('Correct! +1');
    } else {
      setFeedbackKind('bad');
      setFeedbackMsg('Incorrect — see the correction on the staff.');
    }
    if (settings.hearIt) playHearIt();
    if (correct && settings.autoAdvance) {
      advanceTimerRef.current = window.setTimeout(() => {
        advanceTimerRef.current = null;
        startRoundRef.current();
      }, 450);
    }
  }

  const submitEnabled = !hasSubmitted && !!answerSlot;
  // With a single-note answer, the "red correction voice" (docs §9b)
  // collapses to substituting the wrong note's display with the expected
  // spelling, colored red — there's no second note to overlay it against.
  const showingReveal = hasSubmitted && !isCorrect && !!question;
  const slots: (SpelledPitch | null)[] = question ? [question.given, showingReveal ? question.expected : answerSlot] : [];
  const slotColors: (string | undefined)[] | undefined = showingReveal ? [undefined, WRONG_COLOR] : undefined;

  return {
    audioStatus: audio.status,
    question,
    promptText: question ? intervalWritingPromptText(question) : '',
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
