/**
 * The shared framework for any topic that renders a VexFlow staff of
 * beat-positioned notes and lets the user click/hover to place them.
 * Rhythm Dictation and Melodic Dictation are both built on this — a future
 * staff-based topic (e.g. a two-part or chord-progression rhythm topic)
 * should be too, rather than re-deriving any of the pieces below.
 *
 * What it covers, and where:
 *  - Rendering a measure (gap-padded spacing, a hover preview of the *whole*
 *    resulting bar — not just the note under the cursor, meter-aware
 *    beaming) — `drawMeasureVoice` in measureVoice.ts, built on tickables.ts
 *    + beaming.ts.
 *  - Click/hover hit-testing: resolving a raw x/y or beat estimate to the
 *    nearest beat the armed duration can legally occupy — any grid
 *    position, since what's already written there (a rest or a real note)
 *    never blocks where a new note can land, only what it displaces —
 *    `resolvePlacementBeat` / `legalPlacementBeats` / `findMeasureAt` in
 *    placement.ts.
 *  - Turning a resolved placement into the bar's new state: clearing
 *    whatever the new note's span overlaps and re-filling any span left
 *    uncovered with rests, so a bar never has unaccounted-for space —
 *    `applyPlacement` / `fillGaps` / `defaultRestMeasure` in gaps.ts. This is
 *    the one function both the commit path and the hover preview call, so a
 *    preview can never show a result the click wouldn't actually produce.
 *  - Measure geometry for hit-testing — `MeasureGeometry` in geometry.ts.
 *  - Ties (always connect forward, to "the note in front"): arming Tie tags
 *    the newly placed note itself as tied; `drawTies` (ties.ts, called once
 *    per staff after every measure is drawn) draws each tied note's curve to
 *    its follower (`findFollowingNote`, placement.ts) or a pending partial
 *    curve when nothing valid follows yet. Melodic dictation forces the note
 *    placed after a tied note to inherit its pitch (`findPrecedingNote` via
 *    lib/melody/theory.ts's tiePreview, shared by commit and hover ghost).
 *
 * A topic plugs in by implementing small adapter interfaces over its own
 * note shape (e.g. RhythmNote's `isRest` vs melodic's PitchedNote's `rest`+
 * `midi`) — see RestAdapter (gaps.ts), TickableAdapter (tickables.ts), and
 * MeasureVoiceAdapter (measureVoice.ts). Duration/note-value <-> VexFlow
 * duration-code mapping is a separate, already-shared concern: see
 * lib/rhythm-staff/vexDuration.ts's `vexDurationFor`.
 */

export type { MeasureGeometry } from './geometry';
export { fillGaps, defaultRestMeasure, applyPlacement, decomposeGap, pulseRestSpans, type RestAdapter, type AppliedPlacement } from './gaps';
export { beamableRuns, generateBeamedRuns } from './beaming';
export { buildGapPaddedTickables, buildGhostNote, type TickableAdapter, type GapPaddedTickables } from './tickables';
export { drawMeasureVoice, type MeasureVoiceAdapter, type DrawMeasureVoiceOptions } from './measureVoice';
export {
  resolvePlacementBeat,
  legalPlacementBeats,
  xToBeat,
  findMeasureAt,
  findPrecedingNote,
  findFollowingNote,
  type PlacedNote,
  type Breakpoint,
  type LocatedNote,
} from './placement';
export { drawTies, type TieAdapter } from './ties';
export { vexDurationFor, type VexDuration } from '../rhythm-staff/vexDuration';
