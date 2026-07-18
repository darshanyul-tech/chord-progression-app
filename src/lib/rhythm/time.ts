// Ported verbatim from legacy rhythm-dictation IIFE (geometry/time functions,
// lines ~5731-5943, docs/04-notation-engine.md Part A). Model-parameterized
// per the doc's explicit allowance: module-level `state` reads become
// function parameters; algorithms/constants unchanged. The legacy fixed
// 128..960 coordinate system (STAFF_LEFT/STAFF_RIGHT/measureWidth/
// beatFromClickX/noteX) that used to live here is gone — click hit-testing
// now reads VexFlow's own drawn stave geometry instead (RhythmStaffHost,
// mirroring Melodic Dictation's VexStaffHost), which stays correct no
// matter how VexFlow actually lays out a measure.

export interface RhythmNote {
  beat: number;
  duration: number;
  isRest: boolean;
}
export type Measure = RhythmNote[];

export interface TimeSigInfo {
  beatsPerBar: number;
  beatValue: number;
  measureBeats: number;
}

export function parseTimeSig(sig: string): TimeSigInfo {
  const parts = sig.split('/');
  const num = parseInt(parts[0]!, 10);
  const den = parseInt(parts[1]!, 10);
  // Bar capacity in quarter-note beat units: 4/4 = 4, 3/4 = 3, 6/8 = 3, 2/4 = 2
  const measureBeats = num * (4 / den);
  return { beatsPerBar: num, beatValue: den, measureBeats };
}

export function metricPulseBeats(beatValue: number, beatsPerBar: number): number {
  if (beatValue === 4) return 1;
  if (beatValue === 8) {
    return beatsPerBar % 3 === 0 ? 1.5 : 0.5;
  }
  return 4 / beatValue;
}

export function metricPulseCount(measureTotalBeats: number, pulseBeats: number): number {
  return Math.max(1, Math.round(measureTotalBeats / pulseBeats));
}

export function durationTicks(d: number): number {
  return Math.round(d * 12);
}

export function gcdInt(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || 1;
}

export function durationClose(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01;
}

export function maxNotesOfDuration(dur: number, measureTotalBeats: number): number {
  if (dur <= 0) return 0;
  return Math.floor((measureTotalBeats + 0.001) / dur);
}

export function durationFitsBar(dur: number, measureTotalBeats: number): boolean {
  return dur > 0 && dur <= measureTotalBeats + 0.001;
}

export function sortNotes(notes: RhythmNote[] | undefined): RhythmNote[] {
  return (notes || []).slice().sort((a, b) => a.beat - b.beat);
}

export function measuresEqual(a: RhythmNote[] | undefined, b: RhythmNote[] | undefined): boolean {
  const na = sortNotes(a);
  const nb = sortNotes(b);
  if (na.length !== nb.length) return false;
  for (let i = 0; i < na.length; i++) {
    if (!durationClose(na[i]!.beat, nb[i]!.beat)) return false;
    if (!durationClose(na[i]!.duration, nb[i]!.duration)) return false;
    if (!!na[i]!.isRest !== !!nb[i]!.isRest) return false;
  }
  return true;
}

export function gridStep(activeDurations: number[]): number {
  const durs = activeDurations.filter((d) => d > 0.01);
  if (!durs.length) return 0.25;
  let g = durationTicks(durs[0]!);
  durs.forEach((d) => {
    g = gcdInt(g, durationTicks(d));
  });
  return Math.max(g / 12, 1 / 12);
}

export function snapBeat(beat: number, maxBeat: number, step: number): number {
  const snapped = Math.round(beat / step) * step;
  return Math.max(0, Math.min(maxBeat, snapped));
}

export function noteOverlaps(measure: RhythmNote[], beat: number, duration: number): boolean {
  const end = beat + duration;
  return measure.some((n) => {
    const nEnd = n.beat + n.duration;
    return beat < nEnd - 0.001 && end > n.beat + 0.001;
  });
}

// Only durations that decompose cleanly here appear in either topic's
// palette (plus their multiples/sums), so every gap either app can produce
// is representable without a remainder. Shared by both staff renderers
// (docs/12-melodic-dictation-fixes.md MD-3/RC-3): greedily splits a
// beat-gap into standard note-value chunks (largest first), used to pad
// measures with invisible GhostNotes so the Formatter spaces *placed* notes
// proportionally to their real beat position instead of packing them
// sequentially with no regard for empty beats — the mismatch that let a bar
// accept fewer notes than its capacity. 0.667/0.333 (triplet quarter/eighth)
// are rhythm-dictation-only durations, harmless as unused entries for
// melodic dictation's gaps.
const CANONICAL_GAP_DURATIONS = [4, 3, 2, 1.5, 1, 0.75, 0.667, 0.5, 0.333, 0.25];

export function decomposeGap(gapBeats: number): number[] {
  const out: number[] = [];
  let rem = gapBeats;
  let guard = 0;
  while (rem > 0.001 && guard++ < 64) {
    const fit = CANONICAL_GAP_DURATIONS.find((d) => d <= rem + 0.001);
    if (!fit) break;
    out.push(fit);
    rem -= fit;
  }
  return out;
}

export interface RestSpan {
  beat: number;
  duration: number;
}

/**
 * Splits a beat-span into rest spans at the meter's natural pulse
 * (metricPulseBeats — quarter rests in simple meters, dotted-quarter or
 * eighth rests in compound ones, the same subdivision count-in clicks
 * already use), falling back to decomposeGap's canonical values for
 * whatever remainder doesn't divide evenly (e.g. a span that starts
 * mid-pulse because a neighbouring placed note has an odd length). Used by
 * both dictation topics to default-fill every beat of a measure with a
 * rest instead of leaving it truly empty — a bar should never have
 * unaccounted-for space, so a fresh 4/4 measure starts as four crotchet
 * rests rather than nothing.
 */
export function pulseRestSpans(startBeat: number, spanBeats: number, pulseBeats: number): RestSpan[] {
  const out: RestSpan[] = [];
  let cursor = startBeat;
  let rem = spanBeats;
  while (rem > pulseBeats - 0.001) {
    out.push({ beat: cursor, duration: pulseBeats });
    cursor += pulseBeats;
    rem -= pulseBeats;
  }
  if (rem > 0.001) {
    decomposeGap(rem).forEach((d) => {
      out.push({ beat: cursor, duration: d });
      cursor += d;
    });
  }
  return out;
}
