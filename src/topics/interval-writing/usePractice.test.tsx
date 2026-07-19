import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultIntervalWritingSettings } from '../../lib/written-theory/intervalWriting';
import { spellingsEqual } from '../../lib/written-theory/spelledPitch';
import { useScoresStore } from '../../state/scores';
import { useIntervalWritingPractice } from './usePractice';

beforeEach(() => {
  localStorage.clear();
  useScoresStore.setState({ scores: {} });
});

vi.mock('../../lib/audio/engine', () => ({
  audio: {
    status: 'idle',
    sampler: null,
    lastError: null,
    initAudio: vi.fn().mockResolvedValue(undefined),
    subscribe: () => () => {},
    now: () => 0,
  },
}));

function renderPractice() {
  return renderHook(() => useIntervalWritingPractice(defaultIntervalWritingSettings()));
}

describe('useIntervalWritingPractice — writing-frame contract (docs/14 §9b)', () => {
  it('starts with a question and no answer placed yet', () => {
    const { result } = renderPractice();
    expect(result.current.question).not.toBeNull();
    expect(result.current.submitEnabled).toBe(false);
  });

  it('Submit is disabled until the answer slot is filled', () => {
    const { result } = renderPractice();
    const { given } = result.current.question!;
    act(() => result.current.placeAt(0, { letter: given.letter, accidental: given.acc as '' | '#' | 'b', octave: given.octave }));
    // slot 0 is locked — placing there must not enable submit.
    expect(result.current.submitEnabled).toBe(false);
  });

  it('correct answer: one submit scores +1, no reveal shown', () => {
    const { result } = renderPractice();
    const { expected } = result.current.question!;
    act(() =>
      result.current.placeAt(1, { letter: expected.letter, accidental: expected.acc as '' | '#' | 'b', octave: expected.octave }),
    );
    expect(result.current.submitEnabled).toBe(true);
    act(() => result.current.checkAnswer());
    expect(result.current.isCorrect).toBe(true);
    expect(result.current.hasSubmitted).toBe(true);
    expect(result.current.score).toEqual({ correct: 1, total: 1 });
    // Correct: the displayed slot is still the user's (matching) answer, not a red reveal.
    expect(result.current.slotColors).toBeUndefined();
  });

  it('wrong answer: scores incorrect, reveals the expected note in red, locks input', () => {
    const { result } = renderPractice();
    const { expected } = result.current.question!;
    // A deliberately wrong spelling: bump the octave so it can never equal `expected`.
    const wrong = { letter: expected.letter, accidental: expected.acc as '' | '#' | 'b', octave: expected.octave + 1 };
    act(() => result.current.placeAt(1, wrong));
    act(() => result.current.checkAnswer());

    expect(result.current.isCorrect).toBe(false);
    expect(result.current.hasSubmitted).toBe(true);
    expect(result.current.score).toEqual({ correct: 0, total: 1 });
    // Reveal: slot 1 now shows the *expected* spelling, colored red.
    expect(spellingsEqual(result.current.slots[1]!, expected)).toBe(true);
    expect(result.current.slotColors?.[1]).toBe('#b3261e');
  });

  it('enharmonic-equivalent answer (same MIDI, different letter) still grades wrong', () => {
    const { result } = renderPractice();
    const { expected } = result.current.question!;
    // Pick a letter one step away — guaranteed not to equal expected.letter,
    // so even if this test's specific interval makes the exact MIDI-match
    // improbable, the letter mismatch alone already fails spellingsEqual.
    const otherLetters = ['C', 'D', 'E', 'F', 'G', 'A', 'B'].filter((l) => l !== expected.letter);
    const wrong = { letter: otherLetters[0]!, accidental: '' as const, octave: expected.octave };
    act(() => result.current.placeAt(1, wrong));
    act(() => result.current.checkAnswer());
    expect(result.current.isCorrect).toBe(false);
  });

  it('Next starts a fresh, unanswered question', () => {
    const { result } = renderPractice();
    const { expected } = result.current.question!;
    act(() =>
      result.current.placeAt(1, { letter: expected.letter, accidental: expected.acc as '' | '#' | 'b', octave: expected.octave }),
    );
    act(() => result.current.checkAnswer());
    expect(result.current.hasSubmitted).toBe(true);
    act(() => result.current.next());
    expect(result.current.hasSubmitted).toBe(false);
    expect(result.current.submitEnabled).toBe(false);
  });

  it('Backspace/Clear remove the placed answer before submit', () => {
    const { result } = renderPractice();
    const { expected } = result.current.question!;
    act(() =>
      result.current.placeAt(1, { letter: expected.letter, accidental: expected.acc as '' | '#' | 'b', octave: expected.octave }),
    );
    expect(result.current.submitEnabled).toBe(true);
    act(() => result.current.removeLast());
    expect(result.current.submitEnabled).toBe(false);
  });
});
