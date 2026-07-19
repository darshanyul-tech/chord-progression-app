import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultScaleWritingSettings } from '../../lib/written-theory/scaleWriting';
import { spellingsEqual } from '../../lib/written-theory/spelledPitch';
import { useScoresStore } from '../../state/scores';
import { useScaleWritingPractice } from './usePractice';

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
  return renderHook(() => useScaleWritingPractice(defaultScaleWritingSettings()));
}

function fillCorrectly(result: ReturnType<typeof renderPractice>['result']) {
  const { expected } = result.current.question!;
  for (let i = 1; i < expected.length; i++) {
    act(() =>
      result.current.placeAt(i, { letter: expected[i]!.letter, accidental: expected[i]!.acc as '' | '#' | 'b', octave: expected[i]!.octave }),
    );
  }
}

describe('useScaleWritingPractice — writing-frame contract (docs/14 §9b)', () => {
  it('starts with slot 0 locked to the tonic and Submit disabled', () => {
    const { result } = renderPractice();
    const q = result.current.question!;
    expect(spellingsEqual(result.current.slots[0]!, q.expected[0]!)).toBe(true);
    expect(result.current.submitEnabled).toBe(false);
  });

  it('Submit stays disabled until all 7 editable slots are filled', () => {
    const { result } = renderPractice();
    const { expected } = result.current.question!;
    act(() =>
      result.current.placeAt(1, { letter: expected[1]!.letter, accidental: expected[1]!.acc as '' | '#' | 'b', octave: expected[1]!.octave }),
    );
    expect(result.current.submitEnabled).toBe(false);
  });

  it('a fully correct scale scores +1 with no reveal', () => {
    const { result } = renderPractice();
    fillCorrectly(result);
    expect(result.current.submitEnabled).toBe(true);
    act(() => result.current.checkAnswer());
    expect(result.current.isCorrect).toBe(true);
    expect(result.current.score).toEqual({ correct: 1, total: 1 });
    expect(result.current.slotColors).toBeUndefined();
  });

  it('one wrong note: scores incorrect, reveals only the wrong slot in red, other slots stay black', () => {
    const { result } = renderPractice();
    fillCorrectly(result);
    const { expected } = result.current.question!;
    // Corrupt slot 3 with a wrong octave.
    act(() => result.current.placeAt(3, { letter: expected[3]!.letter, accidental: expected[3]!.acc as '' | '#' | 'b', octave: expected[3]!.octave + 1 }));
    act(() => result.current.checkAnswer());

    expect(result.current.isCorrect).toBe(false);
    expect(result.current.score).toEqual({ correct: 0, total: 1 });
    expect(spellingsEqual(result.current.slots[3]!, expected[3]!)).toBe(true);
    expect(result.current.slotColors?.[3]).toBe('#b3261e');
    expect(result.current.slotColors?.[2]).toBeUndefined();
  });

  it('Next starts a fresh, unanswered question', () => {
    const { result } = renderPractice();
    fillCorrectly(result);
    act(() => result.current.checkAnswer());
    expect(result.current.hasSubmitted).toBe(true);
    act(() => result.current.next());
    expect(result.current.hasSubmitted).toBe(false);
    expect(result.current.submitEnabled).toBe(false);
  });
});
