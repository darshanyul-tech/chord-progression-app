/**
 * The shared framework for any topic that renders a VexFlow staff of
 * beat-positioned notes and lets the user click/hover to place them.
 * Rhythm Dictation and Melodic Dictation are both built on this — a future
 * staff-based topic (e.g. a two-part or chord-progression rhythm topic)
 * should be too, rather than re-deriving any of the pieces below.
 *
 * What it covers, and where:
 *  - Rendering a measure (gap-padded spacing, hover-preview ghost note,
 *    meter-aware beaming) — `drawMeasureVoice` in measureVoice.ts, built on
 *    tickables.ts + beaming.ts.
 *  - Click/hover hit-testing (resolving a raw x/y or beat estimate to a
 *    direct-hit replace or a free-slot placement, with fixed-position snap
 *    "zones" that never shift based on what's already placed) —
 *    `resolvePlacementBeat` / `findMeasureAt` in placement.ts.
 *  - Filling every beat of a measure with rests by default, so a bar never
 *    has unaccounted-for space — `fillGaps` / `defaultRestMeasure` in
 *    gaps.ts.
 *  - Measure geometry for hit-testing — `MeasureGeometry` in geometry.ts.
 *
 * A topic plugs in by implementing small adapter interfaces over its own
 * note shape (e.g. RhythmNote's `isRest` vs melodic's PitchedNote's `rest`+
 * `midi`) — see RestAdapter (gaps.ts), TickableAdapter (tickables.ts), and
 * MeasureVoiceAdapter (measureVoice.ts). Duration/note-value <-> VexFlow
 * duration-code mapping is a separate, already-shared concern: see
 * lib/rhythm-staff/vexDuration.ts's `vexDurationFor`.
 */

export type { MeasureGeometry } from './geometry';
export { fillGaps, defaultRestMeasure, decomposeGap, pulseRestSpans, type RestAdapter } from './gaps';
export { beamableRuns, generateBeamedRuns } from './beaming';
export { buildGapPaddedTickables, buildGhostNote, type TickableAdapter, type GapPaddedTickables } from './tickables';
export { drawMeasureVoice, type MeasureVoiceAdapter, type DrawMeasureVoiceOptions } from './measureVoice';
export { resolvePlacementBeat, findMeasureAt, type PlacedNote, type ResolvedPlacement } from './placement';
export { vexDurationFor, type VexDuration } from '../rhythm-staff/vexDuration';
