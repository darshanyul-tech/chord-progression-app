import { random, shuffle } from '../theory';
import { durationClose, durationFitsBar, type Measure, type RhythmNote } from './time';

// Ported verbatim from legacy rhythm-dictation IIFE (generator functions,
// lines ~5746-6069, docs/05-topics/05-rhythm-dictation.md §4). Model-
// parameterized: module-level `state` reads become explicit parameters.

export const DUR_LABELS: Record<number, string> = {
  4: 'whole', 2: 'half', 1: 'quarter', 0.5: 'eighth', 0.25: 'sixteenth',
  0.333: 'triplet eighth', 0.667: 'triplet quarter',
  1.5: 'dotted quarter', 0.75: 'dotted eighth', 3: 'dotted half',
};

export type RestFrequency = 'none' | 'light' | 'moderate' | 'heavy';
export const REST_CHANCE: Record<RestFrequency, number> = { none: 0, light: 0.12, moderate: 0.25, heavy: 0.42 };

export const TRIPLET_DURS = [0.333, 0.667];

export type SyncopationLevel = 'off' | 'light' | 'moderate' | 'heavy';
export const SYNCOPATION_BOOST: Record<SyncopationLevel, number> = { off: 0, light: 2, moderate: 5, heavy: 10 };

export function getActiveDurations(
  allowedDurations: number[],
  includeTriplets: boolean,
  measureTotalBeats: number,
): number[] {
  let durs = allowedDurations.slice();
  if (includeTriplets) {
    TRIPLET_DURS.forEach((td) => {
      if (!durs.some((d) => durationClose(d, td))) durs.push(td);
    });
  } else {
    durs = durs.filter((d) => !TRIPLET_DURS.some((td) => durationClose(d, td)));
  }
  return durs.filter((d) => durationFitsBar(d, measureTotalBeats)).sort((a, b) => b - a);
}

export function restChance(restFrequency: RestFrequency): number {
  return REST_CHANCE[restFrequency] || 0;
}

export function partitionBar(totalBeats: number, activeDurations: number[]): number[] {
  const pool: number[] = [];
  let rem = totalBeats;
  let guard = 0;
  while (rem > 0.001 && guard++ < 120) {
    const fitting = activeDurations.filter((d) => d <= rem + 0.001);
    if (!fitting.length) break;
    const chosen = fitting[Math.floor(random() * fitting.length)]!;
    pool.push(chosen);
    rem -= chosen;
  }
  if (rem > 0.001) {
    if (pool.length) pool[pool.length - 1] += rem;
    else pool.push(rem);
  }
  return pool;
}

export function beatSyncopationScore(beat: number, pulseBeats: number): number {
  const onDownbeat = Math.abs(beat % pulseBeats) < 0.02;
  if (onDownbeat) return 1;
  const halfPulse = pulseBeats / 2;
  const onOffbeat =
    Math.abs((beat % pulseBeats) - halfPulse) < 0.02 || (pulseBeats === 1 && Math.abs(beat % 0.5) < 0.02);
  if (onOffbeat) return 3;
  return 6;
}

interface PlacedSpan {
  start: number;
  end: number;
}

export function candidateBeats(
  dur: number,
  placed: PlacedSpan[],
  measureTotalBeats: number,
  gridStepVal: number,
): number[] {
  const out: number[] = [];
  for (let b = 0; b <= measureTotalBeats - dur + 0.001; b += gridStepVal) {
    const snapped = Math.max(0, Math.min(measureTotalBeats - dur, Math.round(b / gridStepVal) * gridStepVal));
    if (!placed.some((p) => snapped < p.end - 0.001 && snapped + dur > p.start + 0.001)) {
      if (!out.some((x) => durationClose(x, snapped))) out.push(snapped);
    }
  }
  return out;
}

export function pickWeightedBeat(candidates: number[], syncopation: SyncopationLevel, pulseBeats: number): number {
  if (!candidates.length) return 0;
  const boost = SYNCOPATION_BOOST[syncopation] || 0;
  if (boost <= 0) return candidates[Math.floor(random() * candidates.length)]!;
  const weights = candidates.map((b) => 1 + beatSyncopationScore(b, pulseBeats) * boost * 0.15);
  const total = weights.reduce((s, w) => s + w, 0);
  let r = random() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return candidates[i]!;
  }
  return candidates[candidates.length - 1]!;
}

export function placeSequential(durations: number[], restChanceVal: number): RhythmNote[] {
  const notes: RhythmNote[] = [];
  let beat = 0;
  durations.forEach((dur) => {
    notes.push({ duration: dur, isRest: random() < restChanceVal, beat });
    beat += dur;
  });
  return notes;
}

export function placeSyncopated(
  durations: number[],
  restChanceVal: number,
  measureTotalBeats: number,
  gridStepVal: number,
  syncopation: SyncopationLevel,
  pulseBeats: number,
): RhythmNote[] {
  const order = shuffle(durations);
  const notes: RhythmNote[] = [];
  const placed: PlacedSpan[] = [];
  order.forEach((dur) => {
    let cands = candidateBeats(dur, placed, measureTotalBeats, gridStepVal);
    if (!cands.length) {
      let beat = 0;
      if (placed.length) {
        beat = placed[placed.length - 1]!.end;
      }
      if (beat + dur <= measureTotalBeats + 0.001) cands = [beat];
    }
    if (!cands.length) return;
    const beat = pickWeightedBeat(cands, syncopation, pulseBeats);
    notes.push({ duration: dur, isRest: random() < restChanceVal, beat });
    placed.push({ start: beat, end: beat + dur });
    placed.sort((a, b) => a.start - b.start);
  });
  if (!notes.length) return placeSequential(durations, restChanceVal);
  const used = notes.reduce((s, n) => s + n.duration, 0);
  if (used < measureTotalBeats - 0.02) return placeSequential(durations, restChanceVal);
  return notes.slice().sort((a, b) => a.beat - b.beat);
}

export interface RhythmGenSettings {
  measureTotalBeats: number;
  activeDurations: number[];
  restFrequency: RestFrequency;
  syncopation: SyncopationLevel;
  gridStepVal: number;
  pulseBeats: number;
}

export function fillMeasure(settings: RhythmGenSettings): Measure {
  const { measureTotalBeats, activeDurations, restFrequency, syncopation, gridStepVal, pulseBeats } = settings;
  const durations = partitionBar(measureTotalBeats, activeDurations);
  if (!durations.length) return [];
  const rc = restChance(restFrequency);
  if (syncopation === 'off') return placeSequential(durations, rc);
  if (syncopation === 'light' && random() < 0.55) return placeSequential(durations, rc);
  return placeSyncopated(durations, rc, measureTotalBeats, gridStepVal, syncopation, pulseBeats);
}
