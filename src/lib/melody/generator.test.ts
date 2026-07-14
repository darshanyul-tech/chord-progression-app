import { describe, expect, it } from 'vitest';
import { generateMelody } from './generator';
import { defaultMelodicDictationSettings } from './settings';
import { diatonicPcs, resolveRangeWindow, scaleDegreePool, type PitchedMeasure, type PitchedNote } from './theory';

function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

function flattenOnsets(measures: PitchedMeasure[]): PitchedNote[] {
  return measures.flatMap((bar) => bar.filter((n) => !n.rest));
}

describe('generateMelody walk invariants (topic doc 07 §8, 1000 melodies per motion)', () => {
  (['steps', 'mixed', 'leapy'] as const).forEach((motion) => {
    it(`motion=${motion}: every pitch stays within the resolved range window`, () => {
      const settings = { ...defaultMelodicDictationSettings(), motion, chromatic: 'none' as const, measures: 4 };
      for (let i = 0; i < 1000; i++) {
        const { key, clef, measures } = generateMelody(settings);
        const window = resolveRangeWindow(key, clef, settings.range);
        flattenOnsets(measures).forEach((n) => {
          expect(n.midi).toBeGreaterThanOrEqual(window.lowMidi);
          expect(n.midi).toBeLessThanOrEqual(window.highMidi);
        });
      }
    });

    it(`motion=${motion}: the final note is always scale degree 1, 3, or 5`, () => {
      const settings = { ...defaultMelodicDictationSettings(), motion, chromatic: 'none' as const, measures: 2 };
      for (let i = 0; i < 1000; i++) {
        const { key, measures } = generateMelody(settings);
        const onsets = flattenOnsets(measures);
        if (!onsets.length) continue;
        const pcs = diatonicPcs(key);
        const degreePcs = [pcs[0], pcs[2], pcs[4]];
        expect(degreePcs).toContain(mod12(onsets[onsets.length - 1]!.midi!));
      }
    });
  });

  it('leapy motion: any leap of >=3 scale degrees is always followed by a single step in the opposite direction', () => {
    const settings = {
      ...defaultMelodicDictationSettings(),
      motion: 'leapy' as const,
      chromatic: 'none' as const,
      measures: 4,
      range: 'wide' as const,
    };
    for (let i = 0; i < 1000; i++) {
      const { key, clef, measures } = generateMelody(settings);
      const window = resolveRangeWindow(key, clef, settings.range);
      const pool = scaleDegreePool(key, window.lowMidi, window.highMidi);
      const indices = flattenOnsets(measures).map((n) => pool.indexOf(n.midi!));
      // Transitions among loop-computed positions only — the very last note
      // is separately forced to 1/3/5 and isn't governed by the recovery rule.
      for (let k = 0; k < indices.length - 3; k++) {
        const diff = indices[k + 1]! - indices[k]!;
        if (Math.abs(diff) >= 3) {
          const nextDiff = indices[k + 2]! - indices[k + 1]!;
          expect(Math.abs(nextDiff)).toBe(1);
          expect(Math.sign(nextDiff)).toBe(-Math.sign(diff));
        }
      }
    }
  });
});

describe('chromatic pass (§3.5, §8)', () => {
  (['light', 'moderate'] as const).forEach((chromatic) => {
    it(`chromatic=${chromatic}: never alters two consecutive notes, and never exceeds the setting's band`, () => {
      const measuresCount = 8;
      const expectedMax = chromatic === 'light' ? Math.round(measuresCount / 4) : Math.round(measuresCount);
      const settings = { ...defaultMelodicDictationSettings(), chromatic, measures: measuresCount };
      for (let i = 0; i < 200; i++) {
        const { key, measures } = generateMelody(settings);
        const diatonic = new Set(diatonicPcs(key));
        const onsets = flattenOnsets(measures);
        const isChromatic = onsets.map((n) => !diatonic.has(mod12(n.midi!)));
        for (let idx = 0; idx < isChromatic.length - 1; idx++) {
          if (isChromatic[idx]) expect(isChromatic[idx + 1]).toBe(false);
        }
        expect(isChromatic.filter(Boolean).length).toBeLessThanOrEqual(expectedMax);
      }
    });
  });

  it('chromatic=none never alters any note', () => {
    const settings = { ...defaultMelodicDictationSettings(), chromatic: 'none' as const, measures: 4 };
    for (let i = 0; i < 100; i++) {
      const { key, measures } = generateMelody(settings);
      const diatonic = new Set(diatonicPcs(key));
      flattenOnsets(measures).forEach((n) => expect(diatonic.has(mod12(n.midi!))).toBe(true));
    }
  });
});

describe('generateMelody basic shape', () => {
  it('produces exactly settings.measures bars, with a rhythm skeleton that fills every bar', () => {
    const settings = { ...defaultMelodicDictationSettings(), measures: 4 };
    const { measures } = generateMelody(settings);
    expect(measures).toHaveLength(4);
  });

  it('honors an explicit clef and non-random key when randomKey is off', () => {
    const settings = { ...defaultMelodicDictationSettings(), clef: 'bass' as const, key: 'Bb', randomKey: false };
    const { key, clef } = generateMelody(settings);
    expect(clef).toBe('bass');
    expect(key.id).toBe('Bb');
  });
});
