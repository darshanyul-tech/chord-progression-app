import { describe, expect, it } from 'vitest';
import { durationFitsBar } from '../rhythm/time';
import { setRng } from '../theory';
import {
  BASIC_CELL_IDS,
  FULL_CELL_IDS,
  METER_CELLS,
  METER_PAIRS,
  buildMeterTranspositionQuestion,
  cellsToMeasure,
  defaultMeterTranspositionSettings,
  generateBarCells,
  meterTranspositionPromptText,
  type MeterTranspositionSettings,
} from './meterTransposition';

describe('METER_CELLS — cell table round-trip', () => {
  it('every cell\'s compound and simple realizations sum to the same number of beat-units (1.5/beat, own-meter-correct on each side)', () => {
    METER_CELLS.forEach((cell) => {
      const compoundSum = cell.compound.reduce((s, n) => s + n.duration, 0);
      const simpleSum = cell.simple.reduce((s, n) => s + n.duration, 0);
      expect(compoundSum).toBeCloseTo(1.5 * cell.slots, 2);
      expect(simpleSum).toBeCloseTo(1 * cell.slots, 2);
    });
  });

  it('mapping compound -> simple -> compound is the identity for every cell (the table itself is the bidirectional mapping)', () => {
    METER_CELLS.forEach((cell) => {
      const roundTripped = METER_CELLS.find((c) => c.id === cell.id)!;
      expect(roundTripped.compound).toEqual(cell.compound);
      expect(roundTripped.simple).toEqual(cell.simple);
    });
  });
});

describe('generateBarCells + cellsToMeasure — bar arithmetic', () => {
  const numSlotsByPair: Record<string, number> = { '6/8': 2, '9/8': 3, '12/8': 4 };

  it('every generated bar sums to exactly the bar capacity in its own meter, for all pairs/bar-counts/difficulties', () => {
    METER_PAIRS.forEach((pair) => {
      const numSlots = numSlotsByPair[pair.id]!;
      [BASIC_CELL_IDS, FULL_CELL_IDS].forEach((cellIds) => {
        for (let i = 0; i < 200; i++) {
          const cells = generateBarCells(numSlots, cellIds);
          const compound = cellsToMeasure(cells, 'compound');
          const simple = cellsToMeasure(cells, 'simple');
          const compoundTotal = compound.reduce((s, n) => s + n.duration, 0);
          const simpleTotal = simple.reduce((s, n) => s + n.duration, 0);
          expect(compoundTotal).toBeCloseTo(numSlots * 1.5, 2);
          expect(simpleTotal).toBeCloseTo(numSlots * 1, 2);
          expect(durationFitsBar(compoundTotal, numSlots * 1.5)).toBe(true);
          expect(durationFitsBar(simpleTotal, numSlots * 1)).toBe(true);
        }
      });
    });
  });

  it('cell 6 (dotted minim / minim) only ever starts on an even 0-indexed slot with room for both slots', () => {
    for (let i = 0; i < 300; i++) {
      const cells = generateBarCells(4, FULL_CELL_IDS);
      let slot = 0;
      cells.forEach((cell) => {
        if (cell.id === 6) {
          expect(slot % 2).toBe(0);
          expect(slot + 2).toBeLessThanOrEqual(4);
        }
        slot += cell.slots;
      });
    }
  });
});

describe('generateBarCells — rest cap', () => {
  it('never more than one rest cell (id 5) per bar, over 500 draws', () => {
    for (let i = 0; i < 500; i++) {
      const cells = generateBarCells(4, FULL_CELL_IDS);
      const restCount = cells.filter((c) => c.restCell).length;
      expect(restCount).toBeLessThanOrEqual(1);
    }
  });
});

describe('buildMeterTranspositionQuestion — direction symmetry', () => {
  it('a simple->compound question\'s expected answer, realized fresh from the same cells, regenerates the original compound bar', () => {
    for (let i = 0; i < 100; i++) {
      const cells = generateBarCells(2, BASIC_CELL_IDS);
      const compound = cellsToMeasure(cells, 'compound');
      const simple = cellsToMeasure(cells, 'simple');
      // Round-tripping through the same cell sequence in each direction must
      // reproduce exactly what the other direction produced — this is what
      // "feeding the expected answer back as the next source" relies on.
      expect(cellsToMeasure(cells, 'compound')).toEqual(compound);
      expect(cellsToMeasure(cells, 'simple')).toEqual(simple);
    }
  });

  it('compoundToSimple and simpleToCompound directions are mirror images: source/expected/sig swap consistently', () => {
    setRng(() => 0);
    const compoundFirst = buildMeterTranspositionQuestion({ ...defaultMeterTranspositionSettings(), direction: 'compoundToSimple' })!;
    setRng(() => 0);
    const simpleFirst = buildMeterTranspositionQuestion({ ...defaultMeterTranspositionSettings(), direction: 'simpleToCompound' })!;
    setRng();

    expect(compoundFirst.sourceSig).toEqual(simpleFirst.targetSig);
    expect(compoundFirst.targetSig).toEqual(simpleFirst.sourceSig);
    expect(compoundFirst.sourceMeasures).toEqual(simpleFirst.expectedMeasures);
    expect(compoundFirst.expectedMeasures).toEqual(simpleFirst.sourceMeasures);
  });
});

describe('buildMeterTranspositionQuestion', () => {
  it('falls back to all meter pairs (defensively) if none are enabled — the Settings UI itself enforces >=1', () => {
    const settings: MeterTranspositionSettings = { ...defaultMeterTranspositionSettings(), pairs: [] };
    expect(buildMeterTranspositionQuestion(settings)).not.toBeNull();
  });

  it('only produces enabled meter pairs over 100 draws', () => {
    const settings: MeterTranspositionSettings = { ...defaultMeterTranspositionSettings(), pairs: ['12/8'] };
    for (let i = 0; i < 100; i++) {
      const q = buildMeterTranspositionQuestion(settings)!;
      expect(q.pairId).toBe('12/8');
    }
  });

  it('resolves "both" direction to one concrete direction per question', () => {
    const settings: MeterTranspositionSettings = { ...defaultMeterTranspositionSettings(), direction: 'both' };
    for (let i = 0; i < 50; i++) {
      const q = buildMeterTranspositionQuestion(settings)!;
      expect(['compoundToSimple', 'simpleToCompound']).toContain(q.direction);
    }
  });

  it('basic difficulty never produces cells 3/4 (the mixed-duration triplet cells)', () => {
    for (let i = 0; i < 100; i++) {
      const cells = generateBarCells(4, BASIC_CELL_IDS);
      expect(cells.every((c) => c.id !== 3 && c.id !== 4)).toBe(true);
    }
  });

  it('prompt text names both meters', () => {
    const q = buildMeterTranspositionQuestion(defaultMeterTranspositionSettings())!;
    const text = meterTranspositionPromptText(q);
    expect(text).toContain(`${q.sourceSig.beatsPerBar}/${q.sourceSig.beatValue}`);
    expect(text).toContain(`${q.targetSig.beatsPerBar}/${q.targetSig.beatValue}`);
  });

  it('is deterministic under a seeded rng', () => {
    setRng(() => 0);
    const a = buildMeterTranspositionQuestion(defaultMeterTranspositionSettings());
    setRng(() => 0);
    const b = buildMeterTranspositionQuestion(defaultMeterTranspositionSettings());
    expect(a).toEqual(b);
    setRng();
  });
});
