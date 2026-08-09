import type { MeasureGeometry } from './geometry';

/** The only note shape the resolver needs — both melodic's PitchedMeasure and rhythm's Measure satisfy it. */
export type PlacedNote = { beat: number; duration: number };

// A note/rest can go on ANY grid-aligned beat that fits within the bar —
// what's already written there is irrelevant to *where a click can land*;
// it only matters for what gets displaced, which is applyPlacement's job
// (gaps.ts), run identically by both the commit path (usePractice's
// placeNoteAt) and the hover preview (VexStaffHost/RhythmStaffHost) so a
// mouse placement can never land anywhere other than where its own ghost
// preview showed it (docs/12-melodic-dictation-fixes.md MD-3).

/**
 * Every beat >= minBeat on the gridStepVal grid where `duration` fits
 * entirely within the bar. minBeat lets a caller exclude a locked region
 * (e.g. melodic dictation's pre-placed starting note) from the legal set
 * entirely, so neither the hover preview nor a click can ever land inside it.
 */
export function legalPlacementBeats(
  duration: number,
  measureTotalBeats: number,
  gridStepVal: number,
  minBeat = 0,
): number[] {
  const out: number[] = [];
  const start = Math.ceil(minBeat / gridStepVal - 0.001) * gridStepVal;
  for (let b = start; b <= measureTotalBeats - duration + 0.001; b += gridStepVal) {
    out.push(Math.max(minBeat, Math.round(b / gridStepVal) * gridStepVal));
  }
  return out;
}

/**
 * Resolves a raw (proportional, unsnapped) beat estimate — from a click or
 * hover x-position — to the nearest beat `armedDuration` can legally occupy,
 * regardless of what's currently written there (a rest, a real note, or
 * nothing — all equally placeable; applyPlacement in gaps.ts decides what
 * gets displaced). Returns null only when the duration itself can't fit the
 * bar anywhere (caller should reject/flash rather than guess).
 */
export function resolvePlacementBeat(
  rawBeat: number,
  armedDuration: number,
  measureTotalBeats: number,
  gridStepVal: number,
  minBeat = 0,
): number | null {
  const legal = legalPlacementBeats(armedDuration, measureTotalBeats, gridStepVal, minBeat);
  if (!legal.length) return null;
  const clamped = Math.max(minBeat, Math.min(measureTotalBeats, rawBeat));
  return legal.reduce((best, b) => (Math.abs(b - clamped) < Math.abs(best - clamped) ? b : best));
}

/** A real x-position (post-Formatter) tagged with the beat it represents — see `xToBeat`. */
export interface Breakpoint {
  beat: number;
  x: number;
}

/**
 * Converts a click/hover x-coordinate to a beat estimate by piecewise-
 * linearly interpolating between the *actual* rendered positions of
 * whatever's currently drawn in the measure (`breakpoints` — one per real
 * tickable, beat-ascending), rather than one global linear scale across the
 * whole note area.
 *
 * A single global scale assumes VexFlow's Formatter gives every beat the
 * same pixel width, but it doesn't: a lone sixteenth note sitting among
 * quarter rests gets a much smaller share of the bar's width than its
 * "1/16 of the bar" beat-proportion would suggest, since the Formatter also
 * accounts for each glyph's own minimum width. That skew is small enough to
 * ignore for coarse (quarter/eighth) grids, but at a sixteenth-note grid it's
 * large enough that a click aimed at "e" or "a" (the off-eighth 16th
 * positions) can land measurably closer, in this naive proportional space,
 * to a neighbouring on-eighth candidate instead — i.e. finer subdivisions
 * become unreliable to click even though resolvePlacementBeat's candidate
 * list already includes them. Interpolating between *neighbouring real
 * tickables* instead sidesteps this: VexFlow spaces adjacent notes evenly
 * within their own local region even when the bar's global proportions are
 * skewed, so a click between two known real positions maps far more
 * accurately to the beat in between.
 *
 * Extrapolates past either end using the nearest pair's own slope (the
 * caller's later clamp to [0, measureTotalBeats] handles any overshoot).
 * Falls back to a single linear scale across `noteStartX`..`noteEndX` when
 * fewer than two breakpoints exist (e.g. one note/rest filling the whole
 * bar) — nothing to interpolate between.
 */
export function xToBeat(
  x: number,
  breakpoints: readonly Breakpoint[],
  noteStartX: number,
  noteEndX: number,
  measureTotalBeats: number,
): number {
  if (breakpoints.length < 2) {
    const rel = (x - noteStartX) / Math.max(1, noteEndX - noteStartX);
    return rel * measureTotalBeats;
  }
  const interp = (a: Breakpoint, b: Breakpoint): number => {
    if (Math.abs(b.x - a.x) < 0.001) return a.beat;
    const t = (x - a.x) / (b.x - a.x);
    return a.beat + t * (b.beat - a.beat);
  };
  const n = breakpoints.length;
  if (x <= breakpoints[0]!.x) return interp(breakpoints[0]!, breakpoints[1]!);
  if (x >= breakpoints[n - 1]!.x) return interp(breakpoints[n - 2]!, breakpoints[n - 1]!);
  for (let i = 0; i < n - 1; i++) {
    if (x >= breakpoints[i]!.x && x <= breakpoints[i + 1]!.x) return interp(breakpoints[i]!, breakpoints[i + 1]!);
  }
  return breakpoints[n - 1]!.beat;
}

/** A note plus which measure it lives in — findPrecedingNote/findFollowingNote's result, since the caller often needs to mutate that specific measure (e.g. retroactively tagging a tie). */
export interface LocatedNote<T> {
  note: T;
  measureIndex: number;
}

/**
 * The note immediately before `beat` in `measures[measureIndex]` — the same
 * measure's own last note ending at or before it, falling back to the
 * previous measure's last note when nothing in this measure precedes it (a
 * tie across the barline). Ties always connect forward (see
 * findFollowingNote) — this is used only at *placement* time, to find which
 * already-placed note a new tied note should retroactively be marked as
 * tying into (usePractice.ts in both topics), and to force a new tied
 * melodic note's pitch to match it.
 */
export function findPrecedingNote<T extends { beat: number; duration: number }>(
  measures: readonly (readonly T[])[],
  measureIndex: number,
  beat: number,
): LocatedNote<T> | null {
  const sameMeasure = (measures[measureIndex] ?? [])
    .filter((n) => n.beat + n.duration <= beat + 0.001)
    .sort((a, b) => b.beat - a.beat)[0];
  if (sameMeasure) return { note: sameMeasure, measureIndex };
  if (measureIndex > 0) {
    const prevMeasure = measures[measureIndex - 1] ?? [];
    const last = [...prevMeasure].sort((a, b) => b.beat - a.beat)[0];
    if (last) return { note: last, measureIndex: measureIndex - 1 };
  }
  return null;
}

/**
 * The note immediately after `beat + duration` in `measures[measureIndex]` —
 * the same measure's own next note, falling back to the next measure's first
 * note (a tie across the barline). A tied note (`tied: true`) always
 * connects to *this* note — see lib/notation/ties.ts's `drawTies`, which
 * calls this to find the curve's other end, and the hover-preview code in
 * both VexStaffHost/RhythmStaffHost, which calls findPrecedingNote instead
 * (from the hover's own position) to preview a tie into an already-placed
 * later note.
 */
export function findFollowingNote<T extends { beat: number; duration: number }>(
  measures: readonly (readonly T[])[],
  measureIndex: number,
  beat: number,
  duration: number,
): LocatedNote<T> | null {
  const end = beat + duration;
  const sameMeasure = (measures[measureIndex] ?? [])
    .filter((n) => n.beat >= end - 0.001)
    .sort((a, b) => a.beat - b.beat)[0];
  if (sameMeasure) return { note: sameMeasure, measureIndex };
  if (measureIndex < measures.length - 1) {
    const nextMeasure = measures[measureIndex + 1] ?? [];
    const first = [...nextMeasure].sort((a, b) => a.beat - b.beat)[0];
    if (first) return { note: first, measureIndex: measureIndex + 1 };
  }
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
