import { pick, random, shuffle } from '../theory';
import { fillMeasure, getActiveDurations } from '../rhythm/generator';
import { gridStep, metricPulseBeats, parseTimeSig, sortNotes, type TimeSigInfo } from '../rhythm/time';
import type { ChromaticSetting, MelodicDictationSettings, MelodicMotion } from './settings';
import {
  MELODY_KEYS,
  keyById,
  resolveRangeWindow,
  scaleDegreePool,
  type Clef,
  type KeyDef,
  type PitchedMeasure,
  type PitchedNote,
  type RangeWindow,
} from './theory';

// Ported deterministic algorithm from docs/05-topics/07-melodic-dictation.md §3.
// Rhythm skeleton reuses the ported rhythm-dictation generator (D13 reuse
// mandate); pitch assignment is a constrained random walk over the diatonic
// scale-degree pool (array index == scale-degree distance, so "±N degrees"
// is just "±N pool index").

const MAX_RANGE_RETRIES = 5;
const REPEAT_CHANCE = 0.08;

const MOTION_WEIGHTS: Record<MelodicMotion, [number, number, number, number]> = {
  steps: [0.6, 0.25, 0.1, 0.05],
  mixed: [0.4, 0.3, 0.18, 0.12],
  leapy: [0.25, 0.25, 0.25, 0.25],
};

export interface GeneratedMelody {
  key: KeyDef;
  clef: Clef;
  timeSig: TimeSigInfo;
  measures: PitchedMeasure[];
}

function weightedPick<T>(items: readonly T[], weights: readonly number[]): T {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return items[i]!;
  }
  return items[items.length - 1]!;
}

/** Interval magnitude in scale degrees, weighted by motion setting (§3.4). */
function drawDegreeMagnitude(motion: MelodicMotion): number {
  const weights = MOTION_WEIGHTS[motion];
  const bucket = weightedPick([1, 2, 3, 4], weights);
  return bucket === 4 ? (random() < 0.5 ? 4 : 5) : bucket;
}

function clampIndex(idx: number, maxIndex: number): number {
  return Math.max(0, Math.min(maxIndex, idx));
}

function nearestPoolIndexForDegreeStep(pool: number[], stepIndex: number, aroundIndex: number): number {
  let best = -1;
  let bestDist = Infinity;
  pool.forEach((_, idx) => {
    if (idx % 7 !== stepIndex) return;
    const dist = Math.abs(idx - aroundIndex);
    if (dist < bestDist) {
      bestDist = dist;
      best = idx;
    }
  });
  return best;
}

/** Walks the flat onset sequence, assigning `.midi` in place (§3.4). */
function walkPitches(onsets: PitchedNote[], pool: number[], motion: MelodicMotion): void {
  if (!pool.length || !onsets.length) return;
  const maxIndex = pool.length - 1;
  const middle = maxIndex / 2;

  const firstDegreeStep = weightedPick([0, 2, 4], [3, 1, 2]); // tonic:mediant:dominant = 3:1:2
  let currentIndex = nearestPoolIndexForDegreeStep(pool, firstDegreeStep, middle);
  if (currentIndex < 0) currentIndex = Math.round(middle);
  onsets[0]!.midi = pool[currentIndex]!;

  if (onsets.length === 1) return;

  let recoveryDirection = 0; // 0 = free choice; else the forced step direction after a leap
  for (let i = 1; i < onsets.length - 1; i++) {
    const nearLowEdge = currentIndex <= 1;
    const nearHighEdge = currentIndex >= maxIndex - 1;

    let direction: number;
    if (recoveryDirection !== 0) direction = recoveryDirection;
    else if (nearLowEdge && !nearHighEdge) direction = 1;
    else if (nearHighEdge && !nearLowEdge) direction = -1;
    else direction = random() < 0.5 ? -1 : 1;

    let magnitude: number;
    let repeated = false;
    if (recoveryDirection !== 0) {
      magnitude = 1; // classic recovery rule: forced step in the opposite direction
    } else if (random() < REPEAT_CHANCE) {
      magnitude = 0;
      repeated = true;
    } else {
      magnitude = drawDegreeMagnitude(motion);
    }

    currentIndex = clampIndex(currentIndex + direction * magnitude, maxIndex);
    onsets[i]!.midi = pool[currentIndex]!;
    recoveryDirection = !repeated && magnitude >= 3 ? -direction : 0;
  }

  // Last note: force to 1̂/3̂/5̂ nearest the current position, tonic double-weighted (§3.4).
  const lastDegreeStep = weightedPick([0, 2, 4], [2, 1, 1]);
  const lastIndex = nearestPoolIndexForDegreeStep(pool, lastDegreeStep, currentIndex);
  onsets[onsets.length - 1]!.midi = pool[lastIndex >= 0 ? lastIndex : currentIndex]!;
}

function chromaticNoteCount(setting: ChromaticSetting, measures: number): number {
  if (setting === 'none') return 0;
  if (setting === 'light') return Math.round(measures / 4);
  return Math.round(measures); // moderate: ~1 per bar
}

/** Alters up to `count` non-first/non-last notes ±1 semitone toward the next note (§3.5). */
function applyChromaticPass(onsets: PitchedNote[], count: number): void {
  if (count <= 0 || onsets.length < 3) return;
  const candidateIndices = shuffle(Array.from({ length: onsets.length - 2 }, (_, i) => i + 1));
  const used = new Set<number>();
  let altered = 0;
  for (const idx of candidateIndices) {
    if (altered >= count) break;
    if (used.has(idx - 1) || used.has(idx + 1)) continue; // never alter two consecutive notes
    const note = onsets[idx]!;
    const next = onsets[idx + 1]!;
    if (note.midi === null || next.midi === null || note.midi === next.midi) continue;
    note.midi += next.midi > note.midi ? 1 : -1;
    used.add(idx);
    altered++;
  }
}

function buildRhythmSkeleton(settings: MelodicDictationSettings, timeSig: TimeSigInfo) {
  const durs = getActiveDurations(settings.durations, false, timeSig.measureBeats); // triplets always off (§3.2)
  const step = gridStep(durs);
  const pulse = metricPulseBeats(timeSig.beatValue, timeSig.beatsPerBar);
  const bars = [];
  for (let i = 0; i < settings.measures; i++) {
    bars.push(
      fillMeasure({
        measureTotalBeats: timeSig.measureBeats,
        activeDurations: durs,
        restFrequency: settings.rests,
        syncopation: settings.syncopation,
        gridStepVal: step,
        pulseBeats: pulse,
      }),
    );
  }
  return bars;
}

function allPitchesInRange(measures: PitchedMeasure[], window: RangeWindow): boolean {
  return measures.every((bar) =>
    bar.every((n) => n.rest || (n.midi! >= window.lowMidi && n.midi! <= window.highMidi)),
  );
}

function attemptMelody(
  settings: MelodicDictationSettings,
  timeSig: TimeSigInfo,
  pool: number[],
): PitchedMeasure[] {
  const rhythmBars = buildRhythmSkeleton(settings, timeSig);
  const pitched: PitchedMeasure[] = rhythmBars.map((bar) =>
    sortNotes(bar).map((n) => ({ beat: n.beat, duration: n.duration, rest: n.isRest, midi: null })),
  );
  const onsets = pitched.flatMap((bar) => bar.filter((n) => !n.rest));
  if (onsets.length) {
    walkPitches(onsets, pool, settings.motion);
    applyChromaticPass(onsets, chromaticNoteCount(settings.chromatic, settings.measures));
  }
  return pitched;
}

export function generateMelody(settings: MelodicDictationSettings): GeneratedMelody {
  const clef: Clef = settings.clef === 'random' ? (random() < 0.5 ? 'treble' : 'bass') : settings.clef;
  const key = settings.randomKey ? pick(MELODY_KEYS) : keyById(settings.key);
  const sig = settings.signatures.length ? pick(settings.signatures) : '4/4';
  const timeSig = parseTimeSig(sig);
  const window = resolveRangeWindow(key, clef, settings.range);
  const pool = scaleDegreePool(key, window.lowMidi, window.highMidi);

  let measures = attemptMelody(settings, timeSig, pool);
  for (let attempt = 1; attempt < MAX_RANGE_RETRIES && !allPitchesInRange(measures, window); attempt++) {
    measures = attemptMelody(settings, timeSig, pool);
  }
  return { key, clef, timeSig, measures };
}
