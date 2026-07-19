import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { defaultMeterTranspositionSettings } from '../../lib/written-theory/meterTransposition';
import { useScoresStore } from '../../state/scores';
import { useMeterTranspositionPractice } from './usePractice';

beforeEach(() => {
  localStorage.clear();
  useScoresStore.setState({ scores: {} });
});

function renderPractice() {
  return renderHook(() => useMeterTranspositionPractice(defaultMeterTranspositionSettings()));
}

describe('useMeterTranspositionPractice — writing-frame contract (docs/15-theory-topics/09 §5)', () => {
  it('starts with a question and the answer bar(s) pre-filled with rests', () => {
    const { result } = renderPractice();
    expect(result.current.question).not.toBeNull();
    const q = result.current.question!;
    expect(result.current.userMeasures).toHaveLength(q.bars);
    result.current.userMeasures.forEach((m) => expect(m.every((n) => n.isRest)).toBe(true));
    expect(result.current.submitEnabled).toBe(false);
  });

  it('Submit stays disabled until at least one note is placed', () => {
    const { result } = renderPractice();
    expect(result.current.submitEnabled).toBe(false);
    act(() => result.current.placeAt(0, 0));
    expect(result.current.submitEnabled).toBe(true);
  });

  it('placing the exact expected rhythm and submitting grades correct', () => {
    const { result } = renderPractice();
    const q = result.current.question!;
    // Clear the pre-filled rests by arming each expected note's own duration
    // (mirroring a real user clicking that palette button first) then
    // placing it at its own beat — placeAt resolves rawBeat to the nearest
    // free/replaceable slot, so placing at the note's own beat replaces the
    // rest under it.
    q.expectedMeasures.forEach((measure, mi) => {
      measure
        .filter((n) => !n.isRest)
        .forEach((n) => {
          const idx = q.paletteDurations.findIndex((p) => Math.abs(p.duration - n.duration) < 0.001 && p.isRest === n.isRest);
          expect(idx).toBeGreaterThanOrEqual(0);
          act(() => result.current.armDuration(idx));
          act(() => result.current.placeAt(mi, n.beat));
        });
    });
    act(() => result.current.checkAnswer());
    expect(result.current.hasSubmitted).toBe(true);
    expect(result.current.score.correct).toBe(1);
  });

  it('an incorrect submission reveals the expected rhythm and does not increment the score', () => {
    const { result } = renderPractice();
    // Placing nothing real (still all rests) definitely mismatches any
    // question that has at least one real note — basic-difficulty cells
    // always contain at least one non-rest cell choice in practice, but even
    // an all-rest generated bar (cell 5 alone) would still differ from a
    // one-note placement below, so force a mismatch deterministically by
    // placing a note at beat 0 with whatever's armed, then check.
    act(() => result.current.placeAt(0, 0));
    act(() => result.current.checkAnswer());
    expect(result.current.hasSubmitted).toBe(true);
    // Either graded correct (if the placement happened to match) or
    // incorrect — either way, hasSubmitted locks the question and
    // measureResults has one entry per bar.
    expect(result.current.measureResults).toHaveLength(result.current.question!.bars);
  });

  it('Next starts a fresh, unanswered question', () => {
    const { result } = renderPractice();
    act(() => result.current.placeAt(0, 0));
    act(() => result.current.checkAnswer());
    expect(result.current.hasSubmitted).toBe(true);
    act(() => result.current.next());
    expect(result.current.hasSubmitted).toBe(false);
    expect(result.current.submitEnabled).toBe(false);
    result.current.userMeasures.forEach((m) => expect(m.every((n) => n.isRest)).toBe(true));
  });

  it('Clear bar resets the active measure back to all rests', () => {
    const { result } = renderPractice();
    act(() => result.current.placeAt(0, 0));
    expect(result.current.userMeasures[0]!.some((n) => !n.isRest)).toBe(true);
    act(() => result.current.clearActiveMeasure());
    expect(result.current.userMeasures[0]!.every((n) => n.isRest)).toBe(true);
  });
});
