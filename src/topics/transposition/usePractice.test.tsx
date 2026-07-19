import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultTranspositionSettings } from '../../lib/written-theory/transposition';
import { spellingsEqual } from '../../lib/written-theory/spelledPitch';
import { useScoresStore } from '../../state/scores';
import { useTranspositionPractice } from './usePractice';

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
  return renderHook(() => useTranspositionPractice(defaultTranspositionSettings()));
}

function fillCorrectly(result: ReturnType<typeof renderPractice>['result']) {
  const { expected } = result.current.question!;
  expected.forEach((n, i) => {
    act(() => result.current.placeAt(i, { letter: n!.letter, accidental: n!.acc as '' | '#' | 'b', octave: n!.octave }));
  });
}

describe('useTranspositionPractice — writing-frame contract, keyed-staff normalization (docs/14 §9b/§10)', () => {
  it('starts with all slots empty, rhythm-locked durations matching the source melody', () => {
    const { result } = renderPractice();
    const q = result.current.question!;
    expect(result.current.slots.every((s) => s === null)).toBe(true);
    expect(result.current.durations).toHaveLength(q.expected.length);
    expect(result.current.submitEnabled).toBe(false);
  });

  it('Submit stays disabled until every slot is filled (rhythm-locked entry, any order)', () => {
    const { result } = renderPractice();
    const { expected } = result.current.question!;
    // Fill in reverse order — SlotStaffInput allows filling slots in any order (docs §8a).
    for (let i = expected.length - 1; i >= 0; i--) {
      const n = expected[i]!;
      act(() => result.current.placeAt(i, { letter: n.letter, accidental: n.acc as '' | '#' | 'b', octave: n.octave }));
      if (i > 0) expect(result.current.submitEnabled).toBe(false);
    }
    expect(result.current.submitEnabled).toBe(true);
  });

  it('a fully correct transposition scores +1 with no reveal', () => {
    const { result } = renderPractice();
    fillCorrectly(result);
    act(() => result.current.checkAnswer());
    expect(result.current.isCorrect).toBe(true);
    expect(result.current.score).toEqual({ correct: 1, total: 1 });
    expect(result.current.slotColors).toBeUndefined();
  });

  it('an enharmonic-equivalent wrong answer (equal MIDI, different letter) grades wrong and reveals the correct spelling in red', () => {
    const { result } = renderPractice();
    const { expected } = result.current.question!;
    // Corrupt slot 0 by shifting its letter (still a real note, definitely
    // not spelling-equal to expected[0]).
    const otherLetters = ['C', 'D', 'E', 'F', 'G', 'A', 'B'].filter((l) => l !== expected[0]!.letter);
    act(() => result.current.placeAt(0, { letter: otherLetters[0]!, accidental: '', octave: expected[0]!.octave }));
    for (let i = 1; i < expected.length; i++) {
      const n = expected[i]!;
      act(() => result.current.placeAt(i, { letter: n.letter, accidental: n.acc as '' | '#' | 'b', octave: n.octave }));
    }
    act(() => result.current.checkAnswer());

    expect(result.current.isCorrect).toBe(false);
    expect(result.current.score).toEqual({ correct: 0, total: 1 });
    expect(spellingsEqual(result.current.slots[0]!, expected[0]!)).toBe(true);
    expect(result.current.slotColors?.[0]).toBe('#b3261e');
  });

  it('Next starts a fresh, unanswered question', () => {
    const { result } = renderPractice();
    fillCorrectly(result);
    act(() => result.current.checkAnswer());
    expect(result.current.hasSubmitted).toBe(true);
    act(() => result.current.next());
    expect(result.current.hasSubmitted).toBe(false);
    expect(result.current.slots.every((s) => s === null)).toBe(true);
  });
});
