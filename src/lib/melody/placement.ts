import { candidateBeats } from '../rhythm/generator';
import { durationClose } from '../rhythm/time';
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
  const directHit = measure.find((n) => clamped >= n.beat - 0.001 && clamped < n.beat + n.duration - 0.001);
  if (directHit) return { beat: directHit.beat, isReplace: true };

  const spans = measure.map((n) => ({ start: n.beat, end: n.beat + n.duration }));
  const candidates = candidateBeats(armedDuration, spans, measureTotalBeats, gridStepVal);
  if (!candidates.length) return null;
  const nearest = candidates.reduce((best, c) => (Math.abs(c - clamped) < Math.abs(best - clamped) ? c : best));
  return { beat: nearest, isReplace: false };
}

/** True when placing `duration` at `beat` (replacing any note already exactly at `beat`) would still overlap some *other* note. */
export function placementCollides(measure: PitchedMeasure, beat: number, duration: number): boolean {
  const end = beat + duration;
  return measure.some((n) => !durationClose(n.beat, beat) && beat < n.beat + n.duration - 0.001 && end > n.beat + 0.001);
}
