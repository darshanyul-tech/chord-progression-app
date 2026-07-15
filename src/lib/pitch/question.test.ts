import { afterEach, describe, expect, it } from 'vitest';
import { setRng } from '../theory';
import { buildSingingPool, buildSingingQuestion, ROOT_RANGE_PRESETS, type RootRangeWindow } from './question';
import type { IntervalEnabledEntry } from '../recognition/intervals';

afterEach(() => setRng());

describe('buildSingingPool', () => {
  it('includes only the enabled asc/desc cells', () => {
    const enabledIntervals: Record<string, IntervalEnabledEntry> = {
      m2: { asc: true, desc: false },
      M3: { asc: false, desc: true },
    };
    const pool = buildSingingPool('both', enabledIntervals);
    expect(pool).toEqual([
      { id: 'm2', label: 'Minor 2nd', semitones: 1, direction: 'asc' },
      { id: 'M3', label: 'Major 3rd', semitones: 4, direction: 'desc' },
    ]);
  });

  it('filters to a single direction when requested', () => {
    const enabledIntervals: Record<string, IntervalEnabledEntry> = { m2: { asc: true, desc: true } };
    expect(buildSingingPool('asc', enabledIntervals)).toEqual([
      { id: 'm2', label: 'Minor 2nd', semitones: 1, direction: 'asc' },
    ]);
    expect(buildSingingPool('desc', enabledIntervals)).toEqual([
      { id: 'm2', label: 'Minor 2nd', semitones: 1, direction: 'desc' },
    ]);
  });

  it('returns an empty pool when nothing is enabled', () => {
    expect(buildSingingPool('both', {})).toEqual([]);
  });
});

describe('buildSingingQuestion', () => {
  it('returns null for an empty pool', () => {
    expect(buildSingingQuestion([], ROOT_RANGE_PRESETS.auto)).toBeNull();
  });

  it('keeps both the root and the target note inside the range window', () => {
    setRng(() => 0.5);
    const pool = [{ id: 'M9', label: 'Major 9th', semitones: 14, direction: 'asc' as const }];
    const range: RootRangeWindow = { lowMidi: 48, highMidi: 69 };
    for (let trial = 0; trial < 20; trial++) {
      setRng(() => trial / 20);
      const q = buildSingingQuestion(pool, range);
      expect(q).not.toBeNull();
      expect(q!.rootMidi).toBeGreaterThanOrEqual(range.lowMidi);
      expect(q!.rootMidi).toBeLessThanOrEqual(range.highMidi);
      const targetMidi = q!.rootMidi + q!.targetSemitones;
      expect(targetMidi).toBeGreaterThanOrEqual(range.lowMidi);
      expect(targetMidi).toBeLessThanOrEqual(range.highMidi);
    }
  });

  it('encodes direction as the sign of targetSemitones', () => {
    setRng(() => 0);
    const ascQ = buildSingingQuestion([{ id: 'P5', label: 'Perfect 5th', semitones: 7, direction: 'asc' }], ROOT_RANGE_PRESETS.auto);
    expect(ascQ!.targetSemitones).toBe(7);

    const descQ = buildSingingQuestion([{ id: 'P5', label: 'Perfect 5th', semitones: 7, direction: 'desc' }], ROOT_RANGE_PRESETS.auto);
    expect(descQ!.targetSemitones).toBe(-7);
  });

  it('falls back to anchoring at the range low end when the interval is too wide to fit anywhere else', () => {
    const tooWide = [{ id: 'M9', label: 'Major 9th', semitones: 14, direction: 'asc' as const }];
    const narrowRange: RootRangeWindow = { lowMidi: 60, highMidi: 61 }; // span of 1 semitone, interval needs 14
    const q = buildSingingQuestion(tooWide, narrowRange);
    expect(q).not.toBeNull();
    expect(q!.rootMidi).toBe(narrowRange.lowMidi);
  });
});
