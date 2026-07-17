import { candidateBeats } from '../rhythm/generator';
import type { PitchedMeasure } from './theory';

// docs/12-melodic-dictation-fixes.md MD-3. The single resolver both the
// commit path (usePractice's placeNoteAt) and the hover preview
// (VexStaffHost) call, so a mouse placement can never land anywhere other
// than where its own ghost preview showed it. Reuses rhythm/generator.ts's
// candidateBeats (already the exact-fit-without-overlap beat search the
// rhythm generator uses to place notes) instead of re-deriving it.

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
// filling the next beat. Reported live: three crotchets in 3/4 capped out
// at one, because every attempt to add the second one re-hit the first.
// Shrinking the hit-zone to this note's own middle keeps a real "click this
// note to edit it" target while leaving the boundary near a free neighbour
// free to resolve there instead.
const DIRECT_HIT_MARGIN = 0.25;

/**
 * Resolves a raw (proportional, unsnapped) beat estimate — from a click or
 * hover x-position — into either a direct hit on an existing note (replace)
 * or the nearest free beat that can hold `armedDuration` without overlapping
 * anything (place). Returns null when no free slot exists for that duration
 * anywhere in the bar (caller should reject/flash rather than guess).
 */
export function resolvePlacementBeat(
  measure: PitchedMeasure,
  rawBeat: number,
  armedDuration: number,
  measureTotalBeats: number,
  gridStepVal: number,
): ResolvedPlacement | null {
  const clamped = Math.max(0, Math.min(measureTotalBeats, rawBeat));

  const isWithin = (n: PitchedMeasure[number], margin: number) =>
    clamped >= n.beat + margin - 0.001 && clamped < n.beat + n.duration - margin - 0.001;

  const coreHit = measure.find((n) => isWithin(n, n.duration * DIRECT_HIT_MARGIN));
  if (coreHit) return { beat: coreHit.beat, isReplace: true };

  const spans = measure.map((n) => ({ start: n.beat, end: n.beat + n.duration }));
  const candidates = candidateBeats(armedDuration, spans, measureTotalBeats, gridStepVal);
  if (candidates.length) {
    const nearest = candidates.reduce((best, c) => (Math.abs(c - clamped) < Math.abs(best - clamped) ? c : best));
    return { beat: nearest, isReplace: false };
  }

  // No free slot anywhere for this duration — fall back to the note's full,
  // unshrunk span so a click near its edge can still land as an edit rather
  // than being rejected outright just for missing the stricter core zone.
  const edgeHit = measure.find((n) => isWithin(n, 0));
  if (edgeHit) return { beat: edgeHit.beat, isReplace: true };

  return null;
}
