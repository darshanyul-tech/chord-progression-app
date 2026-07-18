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

// A bar never has unaccounted-for space — a fresh 4/4 measure starts as
// four crotchet rests (one per beat), not an empty array.
const fourQuarterRests = [
  { beat: 0, duration: 1, rest: true, midi: null },
  { beat: 1, duration: 1, rest: true, midi: null },
  { beat: 2, duration: 1, rest: true, midi: null },
  { beat: 3, duration: 1, rest: true, midi: null },
];

// placeNoteAt/removeLastNote append/splice rather than re-sort (the
// renderer and grading both sort independently before use), so tests
// compare by beat position, not raw array order.
function byBeat<T extends { beat: number }>(measure: T[]): T[] {
  return [...measure].sort((a, b) => a.beat - b.beat);
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
    expect(result.current.userMeasures[0]?.find((n) => !n.rest)?.midi).toBe(72);
  });

  it('clamps an absurdly low click to the range window bottom', () => {
    const { result } = renderPractice();
    act(() => {
      result.current.placeNoteAt(0, 0, 1, false, -50);
    });
    expect(result.current.userMeasures[0]?.find((n) => !n.rest)?.midi).toBe(60);
  });

  it('leaves an in-range pitch untouched', () => {
    const { result } = renderPractice();
    act(() => {
      result.current.placeNoteAt(0, 0, 1, false, 64);
    });
    expect(result.current.userMeasures[0]?.find((n) => !n.rest)?.midi).toBe(64);
  });
});

// docs/09-improvement-plan.md §15.3 — topic hook tests for the placement/
// undo/clear/grade state machine (the pure grading/generator logic already
// has its own unit tests; this exercises the hook's glue around them).
describe('useMelodicPractice — undo/clear/grade', () => {
  afterEach(() => setRng());

  it('removeLastNote undoes the most recent placement, refilling its span with a default rest', () => {
    const { result } = renderPractice();
    act(() => {
      result.current.placeNoteAt(0, 0, 1, false, 64);
      result.current.placeNoteAt(0, 1, 1, false, 67);
    });
    expect(result.current.userMeasures[0]).toHaveLength(4); // 2 notes + 2 remaining default rests
    act(() => result.current.removeLastNote());
    expect(byBeat(result.current.userMeasures[0])).toEqual([
      { beat: 0, duration: 1, rest: false, midi: 64 },
      { beat: 1, duration: 1, rest: true, midi: null },
      { beat: 2, duration: 1, rest: true, midi: null },
      { beat: 3, duration: 1, rest: true, midi: null },
    ]);
  });

  it('clearActiveMeasure resets only the measure last placed into to default rests', () => {
    const { result } = renderPractice({ measures: 2 });
    act(() => {
      result.current.placeNoteAt(0, 0, 1, false, 64);
      result.current.placeNoteAt(1, 0, 1, false, 67); // becomes the active measure
    });
    expect(result.current.userMeasures[0].filter((n) => !n.rest)).toHaveLength(1);
    expect(result.current.userMeasures[1].filter((n) => !n.rest)).toHaveLength(1);
    act(() => result.current.clearActiveMeasure());
    expect(result.current.userMeasures[0].filter((n) => !n.rest)).toHaveLength(1);
    expect(result.current.userMeasures[1]).toEqual(fourQuarterRests);
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

// docs/12-melodic-dictation-fixes.md MD-3 (RC-3): a bar used to only ever
// accept one note per click because layout/hit-testing disagreed and any
// near-miss click silently replaced the existing note instead of filling
// the next free beat. Raw beats below are deliberately off-exact (not
// n.beat itself) to simulate real, slightly-imprecise clicks.
describe('useMelodicPractice — placement resolution (docs/12 regression)', () => {
  it('places three quarter notes in a 3/4 bar without a later click overwriting an earlier one', () => {
    const { result } = renderPractice({ signatures: ['3/4'], durations: [1] });
    act(() => {
      result.current.placeNoteAt(0, 0.1, 1, false, 60);
    });
    act(() => {
      result.current.placeNoteAt(0, 1.3, 1, false, 62);
    });
    act(() => {
      result.current.placeNoteAt(0, 2.6, 1, false, 64);
    });
    expect(result.current.userMeasures[0]).toHaveLength(3);
    expect(result.current.userMeasures[0]?.map((n) => n.beat).sort((a, b) => a - b)).toEqual([0, 1, 2]);
  });

  it('replaces the note a click lands directly on, rather than adding a duplicate', () => {
    const { result } = renderPractice({ signatures: ['3/4'], durations: [1] });
    act(() => {
      result.current.placeNoteAt(0, 0, 1, false, 60);
    });
    act(() => {
      result.current.placeNoteAt(0, 0.5, 1, false, 65); // clicks back onto the same note (re-pitch)
    });
    expect(result.current.userMeasures[0].filter((n) => !n.rest)).toHaveLength(1);
    expect(result.current.userMeasures[0].find((n) => !n.rest)).toEqual({ beat: 0, duration: 1, rest: false, midi: 65 });
  });

  it('flashes and rejects a placement once the bar has no room for the armed duration', () => {
    const { result } = renderPractice({ signatures: ['3/4'], durations: [1] });
    act(() => {
      result.current.placeNoteAt(0, 0.1, 1, false, 60);
      result.current.placeNoteAt(0, 1.3, 1, false, 62);
      result.current.placeNoteAt(0, 2.6, 1, false, 64);
    });
    expect(result.current.userMeasures[0]).toHaveLength(3);
    act(() => {
      // Beyond the bar end (clamps to beat 3) — not inside any existing
      // note's span, and the fully-filled 3/4 bar has no free slot left.
      result.current.placeNoteAt(0, 3.4, 1, false, 67);
    });
    expect(result.current.userMeasures[0]).toHaveLength(3);
    expect(result.current.flashMeasure).toBe(0);
  });

  // Reported after the MD-3 fix shipped: clicking directly on an existing
  // note to swap it for a *bigger* one was rejected outright whenever the
  // bigger note would now cover a later note too — placeNoteAt used to
  // reject on any collision instead of clearing what the deliberate replace
  // now spans. A direct hit is different from a gap click: the user aimed
  // at that exact note, so it's allowed to consume neighbours the gap-fill
  // path (resolvePlacementBeat's free-slot search) would never touch.
  it('replacing a note with a bigger one clears whatever else the new span now covers', () => {
    const { result } = renderPractice({ signatures: ['4/4'], durations: [1, 0.5] });
    // Separate act() calls, not one batched block: the first two placements
    // both land inside the *same* original default quarter-rest (0-1), so
    // batching them would resolve the second click against the pre-batch
    // (still-whole-rest) snapshot instead of the first click's already-split
    // result — a staleness artifact of batching same-slot clicks together
    // that a real click sequence (each its own event/render) never hits.
    act(() => {
      result.current.placeNoteAt(0, 0, 0.5, false, 60); // first eighth
    });
    act(() => {
      result.current.placeNoteAt(0, 0.5, 0.5, false, 62); // second eighth
    });
    act(() => {
      result.current.placeNoteAt(0, 1, 1, false, 64); // quarter
    });
    expect(result.current.userMeasures[0].filter((n) => !n.rest)).toHaveLength(3);
    act(() => {
      // Click back on the first eighth, armed with a duration big enough to swallow all three.
      result.current.placeNoteAt(0, 0.25, 2, false, 67);
    });
    // Beats 2-4 were still the untouched default rests — a half note only
    // covers beats 0-2, so they stay exactly as they were.
    expect(byBeat(result.current.userMeasures[0])).toEqual([
      { beat: 0, duration: 2, rest: false, midi: 67 },
      { beat: 2, duration: 1, rest: true, midi: null },
      { beat: 3, duration: 1, rest: true, midi: null },
    ]);
  });

  // A whole note filling an otherwise-full 4/4 bar was unplaceable: clicking
  // on any of the bar's existing notes to swap them all for a whole note hit
  // the same over-broad collision rejection as above.
  it('places a whole note over an otherwise-full 4/4 bar by clicking on an existing note', () => {
    const { result } = renderPractice({ signatures: ['4/4'], durations: [1, 4] });
    act(() => {
      result.current.placeNoteAt(0, 0, 1, false, 60);
      result.current.placeNoteAt(0, 1, 1, false, 62);
      result.current.placeNoteAt(0, 2, 1, false, 64);
      result.current.placeNoteAt(0, 3, 1, false, 65);
    });
    expect(result.current.userMeasures[0]).toHaveLength(4);
    act(() => {
      result.current.placeNoteAt(0, 0.2, 4, false, 60);
    });
    expect(result.current.userMeasures[0]).toEqual([{ beat: 0, duration: 4, rest: false, midi: 60 }]);
  });

  // Found via live browser verification of the MD-3 fix: an earlier version
  // of moveCursorBeat picked "nearest candidate to the cursor, then +1",
  // which skipped the very next beat whenever the cursor wasn't itself a
  // candidate (true right after every placement, since placing a note
  // never moves the cursor) — ArrowRight after placing beat 0 jumped
  // straight to beat 2, and a further ArrowRight jumped measures entirely,
  // leaving beat 1 unreachable by keyboard.
  it('moveCursorBeat steps to the very next free beat, not the one after it', () => {
    const { result } = renderPractice({ signatures: ['3/4'], durations: [1] });
    act(() => result.current.focusCursor());
    expect(result.current.cursorBeat).toBe(0);
    act(() => result.current.placeAtCursor());
    expect(byBeat(result.current.userMeasures[0])).toEqual([
      { beat: 0, duration: 1, rest: false, midi: 60 },
      { beat: 1, duration: 1, rest: true, midi: null },
      { beat: 2, duration: 1, rest: true, midi: null },
    ]);
    act(() => result.current.moveCursorBeat(1));
    expect(result.current.cursorBeat).toBe(1);
    act(() => result.current.placeAtCursor());
    act(() => result.current.moveCursorBeat(1));
    expect(result.current.cursorBeat).toBe(2);
    act(() => result.current.placeAtCursor());
    expect(result.current.userMeasures[0]?.map((n) => n.beat).sort((a, b) => a - b)).toEqual([0, 1, 2]);
  });
});
