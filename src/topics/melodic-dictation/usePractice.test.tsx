import { act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultMelodicDictationSettings } from '../../lib/melody/settings';
import { setRng } from '../../lib/theory';
import { useScoresStore } from '../../state/scores';
import { useMelodicPractice } from './usePractice';

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
    rawContext: () => ({ currentTime: 0, state: 'running' }),
  },
}));

function renderPractice(overrides: Partial<ReturnType<typeof defaultMelodicDictationSettings>> = {}) {
  const settings = {
    ...defaultMelodicDictationSettings(),
    clef: 'treble' as const,
    key: 'C',
    range: 'narrow' as const,
    signatures: ['4/4'],
    measures: 1,
    durations: [1],
    ...overrides,
  };
  return renderHook(() => useMelodicPractice(settings), {
    wrapper: ({ children }) => <MemoryRouter initialEntries={['/topic/melodic-dictation']}>{children}</MemoryRouter>,
  });
}

// docs/09-improvement-plan.md §12.5 — a click far above/below the staff used
// to place an unclamped, arbitrary MIDI value. C/treble/narrow resolves to
// [60, 72] (resolveRangeWindow); placeNoteAt should clamp to that window.
describe('useMelodicPractice — pitch range clamping', () => {
  it('clamps an absurdly high click to the range window top', () => {
    const { result } = renderPractice();
    act(() => {
      result.current.placeNoteAt(0, 0, 1, false, 200);
    });
    expect(result.current.userMeasures[0]?.[0]?.midi).toBe(72);
  });

  it('clamps an absurdly low click to the range window bottom', () => {
    const { result } = renderPractice();
    act(() => {
      result.current.placeNoteAt(0, 0, 1, false, -50);
    });
    expect(result.current.userMeasures[0]?.[0]?.midi).toBe(60);
  });

  it('leaves an in-range pitch untouched', () => {
    const { result } = renderPractice();
    act(() => {
      result.current.placeNoteAt(0, 0, 1, false, 64);
    });
    expect(result.current.userMeasures[0]?.[0]?.midi).toBe(64);
  });
});

// docs/09-improvement-plan.md §15.3 — topic hook tests for the placement/
// undo/clear/grade state machine (the pure grading/generator logic already
// has its own unit tests; this exercises the hook's glue around them).
describe('useMelodicPractice — undo/clear/grade', () => {
  afterEach(() => setRng());

  it('removeLastNote undoes the most recent placement, not an earlier one', () => {
    const { result } = renderPractice();
    act(() => {
      result.current.placeNoteAt(0, 0, 1, false, 64);
      result.current.placeNoteAt(0, 1, 1, false, 67);
    });
    expect(result.current.userMeasures[0]).toHaveLength(2);
    act(() => result.current.removeLastNote());
    expect(result.current.userMeasures[0]).toEqual([{ beat: 0, duration: 1, rest: false, midi: 64 }]);
  });

  it('clearActiveMeasure empties only the measure last placed into', () => {
    const { result } = renderPractice({ measures: 2 });
    act(() => {
      result.current.placeNoteAt(0, 0, 1, false, 64);
      result.current.placeNoteAt(1, 0, 1, false, 67); // becomes the active measure
    });
    expect(result.current.userMeasures[0]).toHaveLength(1);
    expect(result.current.userMeasures[1]).toHaveLength(1);
    act(() => result.current.clearActiveMeasure());
    expect(result.current.userMeasures[0]).toHaveLength(1);
    expect(result.current.userMeasures[1]).toHaveLength(0);
  });

  it('checkAnswer grades correct when every placement matches the generated melody exactly', () => {
    setRng(() => 0.3); // deterministic generateMelody() output for this test
    const { result } = renderPractice();
    const correct = result.current.correctMeasures;
    act(() => {
      correct.forEach((bar, mi) => {
        bar.forEach((n) => {
          result.current.placeNoteAt(mi, n.beat, n.duration, n.rest, n.rest ? null : n.midi);
        });
      });
    });
    act(() => result.current.checkAnswer());
    expect(result.current.hasSubmitted).toBe(true);
    expect(result.current.isCorrect).toBe(true);
    expect(result.current.score.correct).toBe(1);
    expect(result.current.score.total).toBe(1);
  });

  it('checkAnswer grades incorrect when a placement differs from the generated melody', () => {
    setRng(() => 0.3);
    const { result } = renderPractice();
    act(() => {
      // A pitch far outside any plausible generated note guarantees a mismatch
      // regardless of what generateMelody(0.3) actually produced.
      result.current.placeNoteAt(0, 0, 4, false, 40);
    });
    act(() => result.current.checkAnswer());
    expect(result.current.hasSubmitted).toBe(true);
    expect(result.current.isCorrect).toBe(false);
    expect(result.current.score.correct).toBe(0);
    expect(result.current.score.total).toBe(1);
  });
});
