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

// A bar never has unaccounted-for space — a fresh 4/4 measure starts as
// four crotchet rests (one per beat), not an empty array.
const fourQuarterRests = [
  { beat: 0, duration: 1, isRest: true },
  { beat: 1, duration: 1, isRest: true },
  { beat: 2, duration: 1, isRest: true },
  { beat: 3, duration: 1, isRest: true },
];

// placeNoteAt/removeLastNote append/splice rather than re-sort (the
// renderer and grading both sort independently before use), so tests
// compare by beat position, not raw array order.
function byBeat<T extends { beat: number }>(measure: T[]): T[] {
  return [...measure].sort((a, b) => a.beat - b.beat);
}

describe('useRhythmPractice — default rest fill', () => {
  it('a fresh 4/4 measure starts as four crotchet rests, not empty', () => {
    const { result } = renderPractice();
    expect(result.current.userMeasures[0]).toEqual(fourQuarterRests);
  });

  it('a compound 6/8 measure starts as two dotted-quarter rests (the meter\'s own pulse)', () => {
    const { result } = renderPractice({ signatures: ['6/8'], durations: [1.5] });
    expect(result.current.userMeasures[0]).toEqual([
      { beat: 0, duration: 1.5, isRest: true },
      { beat: 1.5, duration: 1.5, isRest: true },
    ]);
  });

  it('replacing a whole quarter-rest slot with a smaller note refills the leftover with a rest, never a gap', () => {
    const { result } = renderPractice({ durations: [1, 0.5] });
    act(() => result.current.placeNoteAt(0, 0, 0.5, false)); // eighth note over the beat-0 quarter rest
    const totalBeats = byBeat(result.current.userMeasures[0]).reduce((s, n) => s + n.duration, 0);
    expect(totalBeats).toBeCloseTo(4, 6); // no unaccounted-for space anywhere in the bar
    expect(byBeat(result.current.userMeasures[0])).toEqual([
      { beat: 0, duration: 0.5, isRest: false },
      { beat: 0.5, duration: 0.5, isRest: true },
      { beat: 1, duration: 1, isRest: true },
      { beat: 2, duration: 1, isRest: true },
      { beat: 3, duration: 1, isRest: true },
    ]);
  });
});

describe('useRhythmPractice — placement', () => {
  it('placeNoteAt replaces the default rest at the given beat', () => {
    const { result } = renderPractice();
    act(() => result.current.placeNoteAt(0, 0, 1, false));
    expect(byBeat(result.current.userMeasures[0])).toEqual([
      { beat: 0, duration: 1, isRest: false },
      { beat: 1, duration: 1, isRest: true },
      { beat: 2, duration: 1, isRest: true },
      { beat: 3, duration: 1, isRest: true },
    ]);
  });

  it('a click on an exact grid beat inside an existing note clears that note and targets the clicked beat precisely, not the note\'s own start', () => {
    const { result } = renderPractice();
    act(() => result.current.placeNoteAt(0, 0, 2, false)); // half note at beat 0 (replaces the two default rests it spans)
    act(() => result.current.placeNoteAt(0, 1, 1, false)); // beat 1 — the grid point the half note's second half starts at
    // The half note is cleared entirely (whatever a new placement overlaps
    // is displaced, never partially truncated) and the new quarter lands
    // exactly at beat 1 — not, as the old coreHit-based model would have,
    // snapped back to the enclosing note's own start (beat 0).
    expect(byBeat(result.current.userMeasures[0])).toEqual([
      { beat: 0, duration: 1, isRest: true },
      { beat: 1, duration: 1, isRest: false },
      { beat: 2, duration: 1, isRest: true },
      { beat: 3, duration: 1, isRest: true },
    ]);
  });

  it('snaps to the sole legal beat when the armed duration only fits there, even clicking far away', () => {
    const { result } = renderPractice();
    act(() => result.current.placeNoteAt(0, 0, 1, false)); // quarter at beat 0
    act(() => result.current.placeNoteAt(0, 2.5, 4, false)); // whole note only fits at beat 0 — snaps there, clearing the bar
    expect(byBeat(result.current.userMeasures[0])).toEqual([{ beat: 0, duration: 4, isRest: false }]);
  });

  it('flashes the measure and rejects a placement whose duration exceeds the bar entirely', () => {
    const { result } = renderPractice({ signatures: ['3/4'] });
    const before = byBeat(result.current.userMeasures[0]);
    act(() => result.current.placeNoteAt(0, 1, 4, false)); // whole note (4 beats) can't fit a 3-beat bar anywhere
    expect(byBeat(result.current.userMeasures[0])).toEqual(before);
    expect(result.current.flashMeasure).toBe(0);
  });

  it('places a quaver on the off-beat (1+) in a 2/4 bar of crotchet rests, leaving a quaver rest behind — not just onto where a rest already starts', () => {
    const { result } = renderPractice({ signatures: ['2/4'], durations: [1, 0.5] });
    expect(byBeat(result.current.userMeasures[0])).toEqual([
      { beat: 0, duration: 1, isRest: true },
      { beat: 1, duration: 1, isRest: true },
    ]);
    act(() => result.current.placeNoteAt(0, 0.6, 0.5, false)); // a click aimed at "1+" (beat 0.5)
    expect(byBeat(result.current.userMeasures[0])).toEqual([
      { beat: 0, duration: 0.5, isRest: true },
      { beat: 0.5, duration: 0.5, isRest: false },
      { beat: 1, duration: 1, isRest: true },
    ]);
  });
});

describe('useRhythmPractice — undo/clear', () => {
  it('removeLastNote undoes the most recent placement, refilling its span with default rests', () => {
    const { result } = renderPractice();
    act(() => {
      result.current.placeNoteAt(0, 0, 1, false);
      result.current.placeNoteAt(0, 1, 1, false);
    });
    expect(byBeat(result.current.userMeasures[0])).toEqual([
      { beat: 0, duration: 1, isRest: false },
      { beat: 1, duration: 1, isRest: false },
      { beat: 2, duration: 1, isRest: true },
      { beat: 3, duration: 1, isRest: true },
    ]);
    act(() => result.current.removeLastNote());
    expect(byBeat(result.current.userMeasures[0])).toEqual(
      fourQuarterRests.map((r, i) => (i === 0 ? { beat: 0, duration: 1, isRest: false } : r)),
    );
  });

  it('clearActiveMeasure resets only the measure last placed into to default rests', () => {
    const { result } = renderPractice({ measures: 2 });
    act(() => {
      result.current.placeNoteAt(0, 0, 1, false);
      result.current.placeNoteAt(1, 0, 1, false); // becomes the active measure
    });
    expect(result.current.userMeasures[0].filter((n) => !n.isRest)).toHaveLength(1);
    expect(result.current.userMeasures[1].filter((n) => !n.isRest)).toHaveLength(1);
    act(() => result.current.clearActiveMeasure());
    expect(result.current.userMeasures[0].filter((n) => !n.isRest)).toHaveLength(1);
    expect(result.current.userMeasures[1]).toEqual(fourQuarterRests);
  });
});

describe('useRhythmPractice — ties', () => {
  it('placing a note with Tie armed marks that note itself tied (its curve leads forward to whatever comes next)', () => {
    const { result } = renderPractice();
    act(() => result.current.placeNoteAt(0, 0, 1, false));
    expect(byBeat(result.current.userMeasures[0])[0]!.tied).toBeUndefined();

    act(() => result.current.toggleTie());
    act(() => result.current.placeNoteAt(0, 1, 1, false));
    const placed = byBeat(result.current.userMeasures[0]);
    expect(placed[1]!.tied).toBe(true); // the newly placed note carries the tie
    expect(placed[0]!.tied).toBeUndefined(); // its predecessor is untouched
  });

  it('Tie never applies when placing a rest', () => {
    const { result } = renderPractice();
    act(() => result.current.toggleTie());
    act(() => result.current.placeNoteAt(0, 0, 1, true));
    expect(byBeat(result.current.userMeasures[0])[0]!.tied).toBeUndefined();
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
