import { act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultRhythmDictationSettings } from '../../lib/rhythm/settings';
import { setRng } from '../../lib/theory';
import { useScoresStore } from '../../state/scores';
import { useRhythmPractice } from './usePractice';

// Topic hook tests (09-improvement-plan.md §15.3) for the placement/undo/
// clear/grade state machine — the pure rhythm generator/grading logic
// already has its own unit tests; this exercises the hook's glue.

vi.mock('../../lib/audio/engine', () => ({
  audio: {
    status: 'idle',
    sampler: null,
    lastError: null,
    initAudio: vi.fn().mockResolvedValue(undefined),
    subscribe: () => () => {},
    now: () => 0,
    rawContext: () => ({ currentTime: 0, state: 'running' }),
  },
}));

beforeEach(() => {
  localStorage.clear();
  useScoresStore.setState({ scores: {} });
});

afterEach(() => {
  setRng();
});

function renderPractice(overrides: Partial<ReturnType<typeof defaultRhythmDictationSettings>> = {}) {
  const settings = {
    ...defaultRhythmDictationSettings(),
    signatures: ['4/4'],
    measures: 1,
    durations: [1],
    restFrequency: 'none' as const,
    ...overrides,
  };
  return renderHook(() => useRhythmPractice(settings), {
    wrapper: ({ children }) => <MemoryRouter initialEntries={['/topic/rhythm-dictation']}>{children}</MemoryRouter>,
  });
}

describe('useRhythmPractice — placement', () => {
  it('placeNoteAt records a note at the given measure/beat', () => {
    const { result } = renderPractice();
    act(() => result.current.placeNoteAt(0, 0, 1, false));
    expect(result.current.userMeasures[0]).toEqual([{ beat: 0, duration: 1, isRest: false }]);
  });

  it('placing over an existing note replaces it instead of rejecting the click', () => {
    const { result } = renderPractice();
    act(() => {
      result.current.placeNoteAt(0, 0, 2, false); // half note at beat 0
      result.current.placeNoteAt(0, 0, 1, false); // quarter note overlapping it
    });
    expect(result.current.userMeasures[0]).toEqual([{ beat: 0, duration: 1, isRest: false }]);
  });

  it('flashes the measure and rejects a placement that would overflow the bar', () => {
    const { result } = renderPractice();
    act(() => result.current.placeNoteAt(0, 3.5, 4, false)); // whole note doesn't fit at beat 3.5 in 4/4
    expect(result.current.userMeasures[0]).toEqual([]);
    expect(result.current.flashMeasure).toBe(0);
  });
});

describe('useRhythmPractice — undo/clear', () => {
  it('removeLastNote undoes the most recent placement, not an earlier one', () => {
    const { result } = renderPractice();
    act(() => {
      result.current.placeNoteAt(0, 0, 1, false);
      result.current.placeNoteAt(0, 1, 1, false);
    });
    expect(result.current.userMeasures[0]).toHaveLength(2);
    act(() => result.current.removeLastNote());
    expect(result.current.userMeasures[0]).toEqual([{ beat: 0, duration: 1, isRest: false }]);
  });

  it('clearActiveMeasure empties only the measure last placed into', () => {
    const { result } = renderPractice({ measures: 2 });
    act(() => {
      result.current.placeNoteAt(0, 0, 1, false);
      result.current.placeNoteAt(1, 0, 1, false); // becomes the active measure
    });
    expect(result.current.userMeasures[0]).toHaveLength(1);
    expect(result.current.userMeasures[1]).toHaveLength(1);
    act(() => result.current.clearActiveMeasure());
    expect(result.current.userMeasures[0]).toHaveLength(1);
    expect(result.current.userMeasures[1]).toHaveLength(0);
  });
});

describe('useRhythmPractice — grading', () => {
  it('checkAnswer grades correct when every placement matches the generated pattern exactly', () => {
    setRng(() => 0.3); // deterministic generateQuestion() output for this test
    const { result } = renderPractice();
    const correct = result.current.correctPattern;
    act(() => {
      correct.forEach((bar, mi) => {
        bar.forEach((n) => {
          result.current.placeNoteAt(mi, n.beat, n.duration, n.isRest);
        });
      });
    });
    act(() => result.current.checkAnswer());
    expect(result.current.hasSubmitted).toBe(true);
    expect(result.current.measureResults).toEqual([true]);
    expect(result.current.score.correct).toBe(1);
    expect(result.current.score.total).toBe(1);
  });

  it('checkAnswer grades incorrect when a placement differs from the generated pattern', () => {
    setRng(() => 0.3);
    const { result } = renderPractice();
    act(() => result.current.placeNoteAt(0, 0, 0.5, false)); // an eighth note is not in the durations pool ([1])
    act(() => result.current.checkAnswer());
    expect(result.current.hasSubmitted).toBe(true);
    expect(result.current.measureResults).toEqual([false]);
    expect(result.current.score.correct).toBe(0);
    expect(result.current.score.total).toBe(1);
  });
});
