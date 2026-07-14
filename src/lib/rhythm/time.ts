// Ported verbatim from legacy rhythm-dictation IIFE (geometry/time functions,
// lines ~5731-5943, docs/04-notation-engine.md Part A). Model-parameterized
// per the doc's explicit allowance: module-level `state` reads become
// function parameters; algorithms/constants unchanged.

export const STAFF_LEFT = 128;
export const STAFF_RIGHT = 960;
export const LINE_Y = 108;
export const BAR_TOP = LINE_Y - 28;
export const BAR_BOTTOM = LINE_Y + 28;
export const NOTE_Y = LINE_Y;

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

export function measureWidth(numMeasures: number): number {
  return (STAFF_RIGHT - STAFF_LEFT) / numMeasures;
}

export function beatFromClickX(
  clickX: number,
  measureIndex: number,
  noteDuration: number | null,
  numMeasures: number,
  measureTotalBeats: number,
  gridStepVal: number,
): number {
  const mw = measureWidth(numMeasures);
  const startX = STAFF_LEFT + measureIndex * mw;
  const innerW = mw - 24;
  const rel = (clickX - startX - 12) / innerW;
  const dur = noteDuration != null ? noteDuration : gridStepVal;
  const maxBeat = Math.max(0, measureTotalBeats - dur);
  return snapBeat(rel * measureTotalBeats, maxBeat, gridStepVal);
}

export function noteX(measureIndex: number, beatInMeasure: number, numMeasures: number, measureTotalBeats: number): number {
  const mw = measureWidth(numMeasures);
  const startX = STAFF_LEFT + measureIndex * mw;
  return startX + 16 + (beatInMeasure / measureTotalBeats) * (mw - 24);
}
