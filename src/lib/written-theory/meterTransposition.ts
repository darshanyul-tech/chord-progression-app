// Tier-1 builder for Theory Topic 09 — Meter Transposition
// (docs/15-theory-topics/09). Pure lib/rhythm/time.ts primitives, no VexFlow.
import { parseTimeSig, type Measure, type RhythmNote, type TimeSigInfo } from '../rhythm/time';
import { pick } from '../theory';

export type MeterDirection = 'compoundToSimple' | 'simpleToCompound';
export type MeterDirectionSetting = MeterDirection | 'both';
export type MeterDifficulty = 'basic' | 'full';

export interface MeterPairDef {
  id: string;
  compound: string;
  simple: string;
}

export const METER_PAIRS: MeterPairDef[] = [
  { id: '6/8', compound: '6/8', simple: '2/4' },
  { id: '9/8', compound: '9/8', simple: '3/4' },
  { id: '12/8', compound: '12/8', simple: '4/4' },
];

export interface MeterTranspositionSettings extends Record<string, unknown> {
  pairs: string[];
  direction: MeterDirectionSetting;
  difficulty: MeterDifficulty;
  bars: 1 | 2;
  autoAdvance: boolean;
}

export function defaultMeterTranspositionSettings(): MeterTranspositionSettings {
  return {
    pairs: ['6/8', '9/8'],
    direction: 'compoundToSimple',
    difficulty: 'basic',
    bars: 1,
    autoAdvance: false,
  };
}

interface CellNote {
  duration: number;
  isRest: boolean;
}

export interface MeterCell {
  id: number;
  /** How many compound-beat slots (1.5 beat-units each) this cell consumes — every cell is 1 except the dotted-minim cell, which spans 2. */
  slots: 1 | 2;
  restCell: boolean;
  compound: CellNote[];
  simple: CellNote[];
}

// The v1 cell table (docs §3) — the entire correctness core. Generation
// composes bars purely from these cells, so nothing outside this table is
// ever produced and no post-hoc filtering for "unrepresentable" content is
// needed (unlike the double-accidental pools elsewhere in written-theory).
export const METER_CELLS: MeterCell[] = [
  { id: 1, slots: 1, restCell: false, compound: [{ duration: 1.5, isRest: false }], simple: [{ duration: 1, isRest: false }] },
  {
    id: 2,
    slots: 1,
    restCell: false,
    compound: [{ duration: 0.5, isRest: false }, { duration: 0.5, isRest: false }, { duration: 0.5, isRest: false }],
    simple: [{ duration: 0.333, isRest: false }, { duration: 0.333, isRest: false }, { duration: 0.333, isRest: false }],
  },
  {
    id: 3,
    slots: 1,
    restCell: false,
    compound: [{ duration: 1, isRest: false }, { duration: 0.5, isRest: false }],
    simple: [{ duration: 0.667, isRest: false }, { duration: 0.333, isRest: false }],
  },
  {
    id: 4,
    slots: 1,
    restCell: false,
    compound: [{ duration: 0.5, isRest: false }, { duration: 1, isRest: false }],
    simple: [{ duration: 0.333, isRest: false }, { duration: 0.667, isRest: false }],
  },
  { id: 5, slots: 1, restCell: true, compound: [{ duration: 1.5, isRest: true }], simple: [{ duration: 1, isRest: true }] },
  { id: 6, slots: 2, restCell: false, compound: [{ duration: 3, isRest: false }], simple: [{ duration: 2, isRest: false }] },
];

export const BASIC_CELL_IDS = [1, 2, 5, 6];
export const FULL_CELL_IDS = [1, 2, 3, 4, 5, 6];

export function cellIdsForDifficulty(difficulty: MeterDifficulty): number[] {
  return difficulty === 'full' ? FULL_CELL_IDS : BASIC_CELL_IDS;
}

/** Number of compound-beat slots (1.5 beat-units each) a compound-meter bar holds — the same count applies to the paired simple meter's bar (1 beat-unit each), since that's exactly what makes them a valid pair. */
function slotsPerBar(compoundSig: TimeSigInfo): number {
  return compoundSig.measureBeats / 1.5;
}

/**
 * Fills one bar's worth of compound-beat slots by picking cells uniformly
 * from the enabled set, capping the rest cell at one per bar (docs §4) so a
 * question can't degenerate into an all-rest bar. Cell 6 (the two-slot
 * dotted minim) only starts when a full two-slot span remains.
 */
export function generateBarCells(numSlots: number, cellIds: number[]): MeterCell[] {
  const pool = METER_CELLS.filter((c) => cellIds.includes(c.id));
  const cells: MeterCell[] = [];
  let usedRest = false;
  let slot = 0;
  while (slot < numSlots) {
    // Cell 6 (dotted minim / minim) only starts on an odd beat boundary —
    // docs §3: "beats 1, 3, …" (1-indexed), i.e. an even 0-indexed slot —
    // and only when a full two-slot span remains.
    const roomFor2 = slot % 2 === 0 && slot + 2 <= numSlots;
    const candidates = pool.filter((c) => {
      if (c.slots > 1 && !roomFor2) return false;
      if (c.restCell && usedRest) return false;
      return true;
    });
    const chosen = pick(candidates.length ? candidates : pool);
    cells.push(chosen);
    if (chosen.restCell) usedRest = true;
    slot += chosen.slots;
  }
  return cells;
}

/** Realizes a bar's cell sequence as one side's notation — the cursor advances by each note's own (already meter-correct) duration, so compound and simple realizations of the same cell sequence naturally land at proportionally different beat positions without any conversion math. */
export function cellsToMeasure(cells: readonly MeterCell[], side: 'compound' | 'simple'): Measure {
  const notes: RhythmNote[] = [];
  let cursor = 0;
  cells.forEach((cell) => {
    const seq = side === 'compound' ? cell.compound : cell.simple;
    seq.forEach((n) => {
      notes.push({ beat: cursor, duration: n.duration, isRest: n.isRest });
      cursor += n.duration;
    });
  });
  return notes;
}

export interface MeterTranspositionQuestion {
  pairId: string;
  compoundSig: TimeSigInfo;
  simpleSig: TimeSigInfo;
  direction: MeterDirection;
  sourceSig: TimeSigInfo;
  targetSig: TimeSigInfo;
  sourceMeasures: Measure[];
  expectedMeasures: Measure[];
  bars: number;
  /** Distinct duration/rest entries appearing on the target side of the enabled difficulty's cells — the answer palette (docs §5), computed per-question since it depends on this question's own direction. */
  paletteDurations: { duration: number; isRest: boolean }[];
}

function distinctPaletteEntries(cellIds: number[], side: 'compound' | 'simple'): { duration: number; isRest: boolean }[] {
  const pool = METER_CELLS.filter((c) => cellIds.includes(c.id));
  const out: { duration: number; isRest: boolean }[] = [];
  pool.forEach((cell) => {
    (side === 'compound' ? cell.compound : cell.simple).forEach((n) => {
      if (!out.some((e) => Math.abs(e.duration - n.duration) < 0.001 && e.isRest === n.isRest)) {
        out.push({ duration: n.duration, isRest: n.isRest });
      }
    });
  });
  return out.sort((a, b) => a.duration - b.duration);
}

export function buildMeterTranspositionQuestion(settings: MeterTranspositionSettings): MeterTranspositionQuestion | null {
  const enabledPairs = settings.pairs.length ? settings.pairs : METER_PAIRS.map((p) => p.id);
  const candidatePairs = METER_PAIRS.filter((p) => enabledPairs.includes(p.id));
  if (!candidatePairs.length) return null;
  const pairDef = pick(candidatePairs);

  const direction: MeterDirection = settings.direction === 'both' ? pick(['compoundToSimple', 'simpleToCompound']) : settings.direction;
  const cellIds = cellIdsForDifficulty(settings.difficulty);
  const compoundSig = parseTimeSig(pairDef.compound);
  const simpleSig = parseTimeSig(pairDef.simple);
  const numSlots = slotsPerBar(compoundSig);
  const bars = settings.bars;

  const barCells: MeterCell[][] = Array.from({ length: bars }, () => generateBarCells(numSlots, cellIds));
  const compoundMeasures = barCells.map((cells) => cellsToMeasure(cells, 'compound'));
  const simpleMeasures = barCells.map((cells) => cellsToMeasure(cells, 'simple'));

  const sourceSig = direction === 'compoundToSimple' ? compoundSig : simpleSig;
  const targetSig = direction === 'compoundToSimple' ? simpleSig : compoundSig;
  const sourceMeasures = direction === 'compoundToSimple' ? compoundMeasures : simpleMeasures;
  const expectedMeasures = direction === 'compoundToSimple' ? simpleMeasures : compoundMeasures;
  const targetSide: 'compound' | 'simple' = direction === 'compoundToSimple' ? 'simple' : 'compound';

  return {
    pairId: pairDef.id,
    compoundSig,
    simpleSig,
    direction,
    sourceSig,
    targetSig,
    sourceMeasures,
    expectedMeasures,
    bars,
    paletteDurations: distinctPaletteEntries(cellIds, targetSide),
  };
}

function sigLabel(sig: TimeSigInfo): string {
  return `${sig.beatsPerBar}/${sig.beatValue}`;
}

export function meterTranspositionPromptText(q: MeterTranspositionQuestion): string {
  return `Rewrite this ${sigLabel(q.sourceSig)} rhythm in ${sigLabel(q.targetSig)} so it sounds identical.`;
}
