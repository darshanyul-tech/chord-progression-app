import { candidateBeats } from '../rhythm/generator';
import type { MeasureGeometry } from './geometry';

/** The only note shape the resolver needs — both melodic's PitchedMeasure and rhythm's Measure satisfy it. */
export type PlacedNote = { beat: number; duration: number };

// docs/12-melodic-dictation-fixes.md MD-3. The single resolver both the
// commit path (usePractice's placeNoteAt) and the hover preview
// (VexStaffHost/RhythmStaffHost) call, so a mouse placement can never land
// anywhere other than where its own ghost preview showed it. Reuses
// rhythm/generator.ts's candidateBeats (already the exact-fit-without-
// overlap beat search the rhythm generator uses to place notes) instead of
// re-deriving it.

export interface ResolvedPlacement {
  /** The beat the note will actually be placed at — may differ from rawBeat (snapped to a free slot, or to a direct hit). */
  beat: number;
  /** True when this placement replaces the note it landed on, rather than filling empty space. */
  isReplace: boolean;
}

// A click landing anywhere in an existing note's *full* span used to count
// as a direct hit — so a click aimed at the free beat right after a note
// (off by only a little, e.g. raw beat 0.9 when the next note starts at 1)
// still fell inside that note's [0, 1) span and replaced it instead of
// filling the next beat. Shrinking the hit-zone to a note's own middle
// keeps a real "click this note to edit it" target while leaving the
// boundary near a free neighbour free to resolve there instead.
//
// The margin itself is pinned to gridStepVal (the smallest addressable
// position for the current question) rather than scaled to whichever
// note's or armed duration's length happens to be involved — that's what
// keeps a measure's snap zones anchored to the same beat positions no
// matter what's placed in them. E.g. in 4/4 on a quarter-note grid, filling
// zone 1 with a half note (spanning zones 1-2) never moves zone 3's own
// boundary; only whether zones 1-2 are still free changes. Capped to a
// fraction of the referenced span so a note/candidate no longer than one
// grid step still keeps a non-empty confident core.
const BOUNDARY_MARGIN_FRACTION = 0.3;
const BOUNDARY_MARGIN_CAP_FRACTION = 0.4;

function boundaryMargin(gridStepVal: number, referenceDuration: number): number {
  return Math.min(gridStepVal * BOUNDARY_MARGIN_FRACTION, referenceDuration * BOUNDARY_MARGIN_CAP_FRACTION);
}

function coreContains(clamped: number, beat: number, duration: number, leftMargin: number, rightMargin: number): boolean {
  return clamped >= beat + leftMargin - 0.001 && clamped < beat + duration - rightMargin - 0.001;
}

/**
 * Resolves a raw (proportional, unsnapped) beat estimate — from a click or
 * hover x-position — into either a direct hit on an existing note (replace)
 * or a free beat that can hold `armedDuration` without overlapping anything
 * (place). Prefers whichever note or candidate the click confidently lands
 * within its own (margin-shrunk, where adjacent to something else) core
 * before falling back to nearest-distance, so a click can't get pulled onto
 * the wrong side of a boundary just because a raw distance calculation
 * narrowly favours it. Returns null only when no free slot exists anywhere
 * for this duration (caller should reject/flash rather than guess).
 */
export function resolvePlacementBeat(
  measure: readonly PlacedNote[],
  rawBeat: number,
  armedDuration: number,
  measureTotalBeats: number,
  gridStepVal: number,
): ResolvedPlacement | null {
  const clamped = Math.max(0, Math.min(measureTotalBeats, rawBeat));

  const coreHit = measure.find((n) => {
    const m = boundaryMargin(gridStepVal, n.duration);
    return coreContains(clamped, n.beat, n.duration, m, m);
  });
  if (coreHit) return { beat: coreHit.beat, isReplace: true };

  const spans = measure.map((n) => ({ start: n.beat, end: n.beat + n.duration }));
  const candidates = candidateBeats(armedDuration, spans, measureTotalBeats, gridStepVal);

  if (candidates.length) {
    // Prefer a candidate the click confidently lands within — margined only
    // on a side that actually touches an existing note (where confusing it
    // with that note is possible); an isolated candidate with free space on
    // both sides accepts a click anywhere across its full width, so aiming
    // loosely at open space still works exactly as before. Whenever
    // gridStepVal is finer than armedDuration, two isolated (full-width)
    // candidates' ranges can overlap (e.g. candidates 0.5 apart but each a
    // full 1-beat-wide range) — picking the *nearest* confident match
    // rather than the first one found in ascending order avoids a
    // systematic bias toward the earlier candidate whenever a click lands
    // in that overlap.
    const touchesLeft = (c: number) => measure.some((n) => Math.abs(n.beat + n.duration - c) < 0.01);
    const touchesRight = (c: number) => measure.some((n) => Math.abs(n.beat - (c + armedDuration)) < 0.01);
    const candidateMargin = boundaryMargin(gridStepVal, armedDuration);
    const confidentMatches = candidates.filter((c) =>
      coreContains(clamped, c, armedDuration, touchesLeft(c) ? candidateMargin : 0, touchesRight(c) ? candidateMargin : 0),
    );
    if (confidentMatches.length) {
      const nearestConfident = confidentMatches.reduce((best, c) =>
        Math.abs(c - clamped) < Math.abs(best - clamped) ? c : best,
      );
      return { beat: nearestConfident, isReplace: false };
    }

    // Missed every confident zone — the click is somewhere in the boundary
    // buffer between a note and a candidate that neither wants to claim
    // outright (the breathing room you'd naturally leave writing notes by
    // hand). Still resolves to whichever is nearest rather than rejecting a
    // click that's merely a little off-centre — but critically, it now
    // *tries the confident zones first*, so a click that's actually well
    // inside a candidate's own space always wins that candidate outright,
    // instead of an existing note's unshrunk full span (or the raw nearest-
    // distance calculation) pulling it back the wrong way. That's what let
    // a click approaching a barline — where the beat↔pixel mapping is
    // least exact — sometimes snap onto a note the click wasn't visually
    // anywhere near.
    const nearest = candidates.reduce((best, c) => (Math.abs(c - clamped) < Math.abs(best - clamped) ? c : best));
    return { beat: nearest, isReplace: false };
  }

  // No free slot anywhere for this duration — fall back to any note whose
  // full, unshrunk span contains the click, so a near-edge click can still
  // land as an edit rather than being rejected outright just for missing
  // the stricter core zone.
  const edgeHit = measure.find((n) => clamped >= n.beat - 0.001 && clamped < n.beat + n.duration - 0.001);
  if (edgeHit) return { beat: edgeHit.beat, isReplace: true };

  return null;
}

/**
 * Picks which measure a click landed in, given every measure's geometry.
 * Two measures on the same row share a ±`tolerance` band around their
 * common barline (vexscore.ts's own MARGIN_LEFT/MARGIN_RIGHT are only 10
 * each — well inside the default 20), so a click near that boundary can
 * match both. Prefers a measure whose own note area actually contains x;
 * only for a click in the tolerance-only margin outside every measure's
 * real span does it fall back to the nearest by row, then by x-distance to
 * that measure's own span. Same-row measures share a topLineY, so without
 * that x-distance tie-break, a plain "closest topLineY" reduce never breaks
 * the tie (equal values never satisfy a strict "<") and always keeps
 * whichever measure came first — i.e. always the earlier measure,
 * regardless of which side of the barline the click was actually nearer
 * to. That's what let a click aimed at the next bar's first beat, right
 * after finishing the previous one, keep resolving back into the (now
 * full) previous bar and landing on its last note as an edit instead.
 */
export function findMeasureAt(geometries: MeasureGeometry[], x: number, y: number, tolerance = 20): MeasureGeometry | null {
  const candidates = geometries.filter((g) => x >= g.noteStartX - tolerance && x <= g.noteEndX + tolerance);
  if (!candidates.length) return null;
  const containing = candidates.filter((g) => x >= g.noteStartX && x <= g.noteEndX);
  const pool = containing.length ? containing : candidates;
  const xDistance = (g: MeasureGeometry) => (x < g.noteStartX ? g.noteStartX - x : x > g.noteEndX ? x - g.noteEndX : 0);
  return pool.reduce((best, g) => {
    const bestRowDist = Math.abs(best.topLineY - y);
    const rowDist = Math.abs(g.topLineY - y);
    if (rowDist !== bestRowDist) return rowDist < bestRowDist ? g : best;
    return xDistance(g) < xDistance(best) ? g : best;
  });
}
