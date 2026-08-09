import { describe, expect, it } from 'vitest';
import type { MeasureGeometry } from './geometry';
import { findMeasureAt, legalPlacementBeats, resolvePlacementBeat, xToBeat, type Breakpoint } from './placement';

// docs/12-melodic-dictation-fixes.md MD-3 RC-3, extended: a click/hover can
// land on *any* grid-aligned beat the armed duration fits at — what's
// already written there (a rest or a real note) never blocks where a note
// can go, only what applyPlacement (gaps.ts) later displaces. The resolver
// itself is now a pure "nearest legal grid beat" function with no notion of
// existing content.
describe('legalPlacementBeats', () => {
  it('lists every quarter-grid beat a quarter note fits at in an empty 3/4 bar', () => {
    expect(legalPlacementBeats(1, 3, 1)).toEqual([0, 1, 2]);
  });

  it('lists every eighth-grid beat a quaver fits at in a 2/4 bar', () => {
    // The user's own reported case: two crotchet rests in 2/4 must still
    // allow a quaver on 1, 1+, 2, 2+ — not just where the rests start.
    expect(legalPlacementBeats(0.5, 2, 0.5)).toEqual([0, 0.5, 1, 1.5]);
  });

  it('a semibreve in 4/4 has exactly one legal beat', () => {
    expect(legalPlacementBeats(4, 4, 1)).toEqual([0]);
  });

  it('returns an empty list when the duration exceeds the bar', () => {
    expect(legalPlacementBeats(4, 3, 1)).toEqual([]);
  });

  it('excludes everything before minBeat (a locked region)', () => {
    // A locked quarter-note start in a 4/4 bar leaves only beats 1-3 legal
    // for another quarter note.
    expect(legalPlacementBeats(1, 4, 1, 1)).toEqual([1, 2, 3]);
  });
});

describe('resolvePlacementBeat', () => {
  it('places a quarter note in an empty 3/4 bar at the nearest of the three legal beats', () => {
    expect(resolvePlacementBeat(0.2, 1, 3, 1)).toBe(0);
    expect(resolvePlacementBeat(1.4, 1, 3, 1)).toBe(1);
    expect(resolvePlacementBeat(2.9, 1, 3, 1)).toBe(2);
  });

  it('resolves to a sub-beat grid position, not just where existing content starts (the reported bug)', () => {
    // 2/4 bar on an eighth-note grid: a click aimed at "1+" (beat 0.5) must
    // land there even though beat 0 already holds something (a crotchet
    // rest, in practice — the resolver itself no longer looks at content).
    expect(resolvePlacementBeat(0.6, 0.5, 2, 0.5)).toBe(0.5);
    expect(resolvePlacementBeat(1.6, 0.5, 2, 0.5)).toBe(1.5);
  });

  it('returns null when the duration itself cannot fit the bar anywhere', () => {
    expect(resolvePlacementBeat(2.5, 4, 3, 1)).toBeNull();
  });

  it('snaps to the single legal beat when the armed duration only fits at one distant spot', () => {
    // A semibreve in 4/4 fits only at beat 0 — a click anywhere in the bar
    // (even beat 3) must still resolve there, not reject.
    expect(resolvePlacementBeat(3, 4, 4, 1)).toBe(0);
  });

  it('clamps a raw beat outside the bar to the nearest legal beat', () => {
    expect(resolvePlacementBeat(-1, 1, 3, 1)).toBe(0);
    expect(resolvePlacementBeat(10, 1, 3, 1)).toBe(2);
  });

  it('respects minBeat, never resolving into a locked region', () => {
    // Locked through beat 1 (e.g. melodic dictation's starting note) — even
    // a click aimed squarely at beat 0 must resolve to the nearest legal
    // beat at or after minBeat.
    expect(resolvePlacementBeat(0.1, 1, 4, 1, 1)).toBe(1);
    expect(resolvePlacementBeat(2.4, 1, 4, 1, 1)).toBe(2);
  });
});

// A single global linear scale across the note area assumes VexFlow gives
// every beat equal pixel width — it doesn't once very different durations
// share a bar (a lone sixteenth among quarter rests gets much less than
// "1/16 of the width"), which is what made finer subdivisions ("e"/"a" in
// 16th-note counting) unreliable to click even though resolvePlacementBeat's
// own candidate list already included them. xToBeat interpolates between
// the *actual* rendered positions instead.
describe('xToBeat', () => {
  it('falls back to a linear scale across noteStartX..noteEndX with fewer than two breakpoints', () => {
    expect(xToBeat(50, [], 0, 100, 4)).toBeCloseTo(2);
    expect(xToBeat(50, [{ beat: 0, x: 0 }], 0, 100, 4)).toBeCloseTo(2);
  });

  it('interpolates linearly between two evenly-spaced breakpoints', () => {
    const breakpoints: Breakpoint[] = [
      { beat: 0, x: 0 },
      { beat: 4, x: 100 },
    ];
    expect(xToBeat(0, breakpoints, 0, 100, 4)).toBeCloseTo(0);
    expect(xToBeat(50, breakpoints, 0, 100, 4)).toBeCloseTo(2);
    expect(xToBeat(100, breakpoints, 0, 100, 4)).toBeCloseTo(4);
  });

  it("finds the right beat even when the real layout is heavily skewed (the reported 16th-note 'e'/'a' bug)", () => {
    // A lone sixteenth (beat 1) squeezed among three quarter rests (beats 0,
    // 2, 3) gets far less than an even 1/4-of-the-bar share of the width —
    // exactly the layout that made a naive linear scale miss "e"/"a". The
    // midpoint between the sixteenth (x=110) and the next quarter rest
    // (x=130) must still resolve near beat 1.5, not get pulled toward
    // whichever of the two neighbouring *quarter* beats a global scale would
    // favour.
    const breakpoints: Breakpoint[] = [
      { beat: 0, x: 20 },
      { beat: 1, x: 110 },
      { beat: 2, x: 130 },
      { beat: 3, x: 220 },
    ];
    expect(xToBeat(120, breakpoints, 0, 300, 4)).toBeCloseTo(1.5, 1);
    // Right at the sixteenth's own position resolves to its own beat.
    expect(xToBeat(110, breakpoints, 0, 300, 4)).toBeCloseTo(1);
  });

  it('extrapolates past the first breakpoint using the first pair\'s own slope', () => {
    const breakpoints: Breakpoint[] = [
      { beat: 1, x: 50 },
      { beat: 2, x: 100 },
    ];
    expect(xToBeat(0, breakpoints, 0, 200, 4)).toBeCloseTo(0);
  });

  it('extrapolates past the last breakpoint using the last pair\'s own slope', () => {
    const breakpoints: Breakpoint[] = [
      { beat: 1, x: 50 },
      { beat: 2, x: 100 },
    ];
    expect(xToBeat(150, breakpoints, 0, 200, 4)).toBeCloseTo(3);
  });

  it('never divides by zero when two breakpoints share the same x', () => {
    const breakpoints: Breakpoint[] = [
      { beat: 0, x: 50 },
      { beat: 0.5, x: 50 },
      { beat: 1, x: 100 },
    ];
    expect(() => xToBeat(50, breakpoints, 0, 200, 4)).not.toThrow();
    expect(Number.isFinite(xToBeat(50, breakpoints, 0, 200, 4))).toBe(true);
  });
});

// findMeasureAt: two same-row measures share a topLineY, so picking between
// them near their shared barline can't rely on row-distance alone — it used
// to always keep whichever measure was found first (the earlier one),
// regardless of which side of the barline x was actually nearer to.
describe('findMeasureAt', () => {
  const measure0: MeasureGeometry = { index: 0, noteStartX: 10, noteEndX: 490, topLineY: 100, spacing: 10, breakpoints: [] };
  const measure1: MeasureGeometry = { index: 1, noteStartX: 510, noteEndX: 990, topLineY: 100, spacing: 10, breakpoints: [] };

  it('picks the measure whose note area actually contains x', () => {
    expect(findMeasureAt([measure0, measure1], 250, 100)?.index).toBe(0);
    expect(findMeasureAt([measure0, measure1], 750, 100)?.index).toBe(1);
  });

  it('picks measure 1 for a click just past the shared barline, even though it is inside measure 0\'s tolerance band too', () => {
    // 495 is within measure0.noteEndX(490)+20 *and* measure1.noteStartX(510)-20 —
    // the classic case where both used to match and the tie always broke
    // toward measure 0 regardless of x. It's nearer measure1's own start.
    const result = findMeasureAt([measure0, measure1], 505, 100);
    expect(result?.index).toBe(1);
  });

  it('picks measure 0 for a click just before the shared barline, in the same overlapping tolerance band', () => {
    const result = findMeasureAt([measure0, measure1], 495, 100);
    expect(result?.index).toBe(0);
  });

  it('returns null when x is outside every measure’s tolerance band', () => {
    expect(findMeasureAt([measure0, measure1], -100, 100)).toBeNull();
  });

  it('prefers the row nearer to y when measures are on different rows', () => {
    const row2: MeasureGeometry = { index: 2, noteStartX: 10, noteEndX: 490, topLineY: 250, spacing: 10, breakpoints: [] };
    expect(findMeasureAt([measure0, row2], 250, 240)?.index).toBe(2);
    expect(findMeasureAt([measure0, row2], 250, 110)?.index).toBe(0);
  });
});
