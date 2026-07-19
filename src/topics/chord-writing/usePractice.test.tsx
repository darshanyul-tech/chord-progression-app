import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultChordWritingSettings } from '../../lib/written-theory/chordWriting';
import { useScoresStore } from '../../state/scores';
import { useChordWritingPractice } from './usePractice';

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
  return renderHook(() => useChordWritingPractice(defaultChordWritingSettings()));
}

describe('useChordWritingPractice — writing-frame contract (docs/14 §9b)', () => {
  it('starts with an empty stack and Submit disabled', () => {
    const { result } = renderPractice();
    expect(result.current.stack).toHaveLength(0);
    expect(result.current.submitEnabled).toBe(false);
  });

  it('Submit stays disabled until the stack is full (no partial grading)', () => {
    const { result } = renderPractice();
    const { expected } = result.current.question!;
    act(() => result.current.toggle({ letter: expected[0]!.letter, accidental: expected[0]!.acc as '' | '#' | 'b', octave: expected[0]!.octave }));
    expect(result.current.submitEnabled).toBe(false);
  });

  it('clicking an already-placed tone removes it (toggle)', () => {
    const { result } = renderPractice();
    const { expected } = result.current.question!;
    const tone = { letter: expected[0]!.letter, accidental: expected[0]!.acc as '' | '#' | 'b', octave: expected[0]!.octave };
    act(() => result.current.toggle(tone));
    expect(result.current.stack).toHaveLength(1);
    act(() => result.current.toggle(tone));
    expect(result.current.stack).toHaveLength(0);
  });

  it('an octave-shifted correct stack (bass-octave freedom) scores +1', () => {
    const { result } = renderPractice();
    const { expected } = result.current.question!;
    expected.forEach((p) => {
      act(() => result.current.toggle({ letter: p.letter, accidental: p.acc as '' | '#' | 'b', octave: p.octave - 1 }));
    });
    expect(result.current.submitEnabled).toBe(true);
    act(() => result.current.checkAnswer());
    expect(result.current.isCorrect).toBe(true);
    expect(result.current.score).toEqual({ correct: 1, total: 1 });
    expect(result.current.revealStack).toBeNull();
  });

  it('a wrong tone scores incorrect and reveals the expected stack', () => {
    const { result } = renderPractice();
    const { expected } = result.current.question!;
    expected.forEach((p, i) => {
      const octave = i === 0 ? p.octave + 3 : p.octave; // deliberately break the bass
      act(() => result.current.toggle({ letter: p.letter, accidental: p.acc as '' | '#' | 'b', octave }));
    });
    act(() => result.current.checkAnswer());
    expect(result.current.isCorrect).toBe(false);
    expect(result.current.score).toEqual({ correct: 0, total: 1 });
    expect(result.current.revealStack).toEqual(expected);
  });

  it('Next starts a fresh, unanswered question', () => {
    const { result } = renderPractice();
    const { expected } = result.current.question!;
    expected.forEach((p) => {
      act(() => result.current.toggle({ letter: p.letter, accidental: p.acc as '' | '#' | 'b', octave: p.octave }));
    });
    act(() => result.current.checkAnswer());
    expect(result.current.hasSubmitted).toBe(true);
    act(() => result.current.next());
    expect(result.current.hasSubmitted).toBe(false);
    expect(result.current.stack).toHaveLength(0);
  });
});
