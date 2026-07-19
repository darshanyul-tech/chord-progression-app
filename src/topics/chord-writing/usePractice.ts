import { useEffect, useRef, useState } from 'react';
import { audio } from '../../lib/audio/engine';
import {
  buildChordWritingQuestion,
  chordWritingPromptText,
  gradeChordAnswer,
  type ChordWritingQuestion,
  type ChordWritingSettings,
} from '../../lib/written-theory/chordWriting';
import { spelledToMidi, type Accidental, type SpelledPitch } from '../../lib/written-theory/spelledPitch';
import type { NoteSpelling } from '../../lib/melody/theory';
import { midiToNoteName } from '../../lib/theory';
import { EMPTY_SCORE, useScoresStore } from '../../state/scores';

const TOPIC_ID = 'chord-writing';

function toSpelledPitch(n: NoteSpelling): SpelledPitch {
  return { letter: n.letter, acc: n.accidental as Accidental, octave: n.octave };
}

function samePosition(a: SpelledPitch, b: SpelledPitch): boolean {
  return a.letter === b.letter && a.octave === b.octave;
}

export function useChordWritingPractice(settings: ChordWritingSettings) {
  const recordAttempt = useScoresStore((s) => s.recordAttempt);
  const resetScoreInStore = useScoresStore((s) => s.resetScore);
  const score = useScoresStore((s) => s.scores[TOPIC_ID] ?? EMPTY_SCORE);

  const [question, setQuestion] = useState<ChordWritingQuestion | null>(null);
  const [stack, setStack] = useState<SpelledPitch[]>([]);
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
    const q = buildChordWritingQuestion(settings);
    setQuestion(q);
    setStack([]);
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
    [settings.qualities.join(','), settings.inversions.join(','), settings.clefs.join(',')],
  );

  useEffect(() => clearAdvanceTimer, []);

  const maxTones = question ? question.quality.intervals.length + 1 : 0;

  function toggle(spelling: NoteSpelling) {
    if (hasSubmitted) return;
    const pitch = toSpelledPitch(spelling);
    setStack((prev) => {
      if (prev.some((t) => samePosition(t, pitch))) return prev.filter((t) => !samePosition(t, pitch));
      if (prev.length >= maxTones) return prev;
      return [...prev, pitch];
    });
  }

  function clearAll() {
    if (hasSubmitted) return;
    setStack([]);
  }

  function toggleSharp() {
    setArmedAccidental((p) => (p === '#' ? '' : '#'));
  }
  function toggleFlat() {
    setArmedAccidental((p) => (p === 'b' ? '' : 'b'));
  }

  function playHearIt() {
    if (!question || audio.status !== 'ready' || !audio.sampler) return;
    const names = stack.map((p) => midiToNoteName(spelledToMidi(p)));
    audio.sampler.triggerAttackRelease(names, 1, audio.now());
  }

  function checkAnswer() {
    if (!question || stack.length !== maxTones) return;
    setHasSubmitted(true);
    const result = gradeChordAnswer(stack, question.expected);
    setIsCorrect(result.correct);
    recordAttempt(TOPIC_ID, result.correct);
    if (result.correct) {
      setFeedbackKind('ok');
      setFeedbackMsg('Correct! +1');
    } else {
      setFeedbackKind('bad');
      setFeedbackMsg(
        result.closedPositionRequired
          ? `Incorrect — right notes, but closed position is required. ${result.correctToneCount} of ${result.total} correctly placed.`
          : `Incorrect — ${result.correctToneCount} of ${result.total} tones correct. See the correction on the staff.`,
      );
    }
    if (settings.hearIt) playHearIt();
    if (result.correct && settings.autoAdvance) {
      advanceTimerRef.current = window.setTimeout(() => {
        advanceTimerRef.current = null;
        startRoundRef.current();
      }, 450);
    }
  }

  const submitEnabled = !hasSubmitted && !!question && stack.length === maxTones;
  const showingReveal = hasSubmitted && !isCorrect && !!question;

  return {
    audioStatus: audio.status,
    question,
    promptText: question ? chordWritingPromptText(question) : '',
    stack,
    maxTones,
    revealStack: showingReveal ? question!.expected : null,
    armedAccidental,
    hasSubmitted,
    isCorrect,
    submitEnabled,
    feedbackMsg,
    feedbackKind,
    score,
    toggle,
    clearAll,
    toggleSharp,
    toggleFlat,
    checkAnswer,
    playHearIt,
    next: startRound,
    resetScore: () => resetScoreInStore(TOPIC_ID),
  };
}
