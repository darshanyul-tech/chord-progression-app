import { describe, expect, it } from 'vitest';
import { generateProgression } from './generator';
import { chordId } from './theory';
import { defaultProgressionSettings, resolvePracticeSettings } from './settings';

function resolved(overrides: Partial<ReturnType<typeof defaultProgressionSettings>> = {}) {
  return resolvePracticeSettings({ ...defaultProgressionSettings(), ...overrides });
}

describe('generateProgression', () => {
  it('honors the requested bar count', () => {
    for (const bars of [2, 4, 8, 12]) {
      const prog = generateProgression(resolved({ bars }));
      expect(prog).toHaveLength(bars);
    }
  });

  it('diatonic-only mode yields only diatonic (non-secondary, non-chromatic) chords', () => {
    const s = resolved({ diatonicOnly: true, chromatic: false, bars: 8 });
    for (let trial = 0; trial < 10; trial++) {
      const prog = generateProgression(s);
      prog.forEach((ch) => {
        expect(ch.secondary).toBe(false);
        expect(ch.chromatic).toBeFalsy();
      });
    }
  });

  it('never repeats the identical chord (root+quality+inversion) in adjacent bars', () => {
    for (let trial = 0; trial < 10; trial++) {
      const prog = generateProgression(resolved({ bars: 8 }));
      for (let i = 1; i < prog.length; i++) {
        expect(chordId(prog[i]!)).not.toBe(chordId(prog[i - 1]!));
      }
    }
  });

  it('respects chromaticCount as an upper bound on chromatic chords inserted', () => {
    const s = resolved({ diatonicOnly: false, chromatic: true, chromaticCount: 2, bars: 8 });
    for (let trial = 0; trial < 10; trial++) {
      const prog = generateProgression(s);
      const chromaticCount = prog.filter((ch) => ch.chromatic).length;
      expect(chromaticCount).toBeLessThanOrEqual(2);
    }
  });

  it('cadenceEnd forces the final bar to the tonic and the penultimate to the dominant', () => {
    const s = resolved({ cadence: true, bars: 6 });
    for (let trial = 0; trial < 10; trial++) {
      const prog = generateProgression(s);
      const last = prog[prog.length - 1]!;
      const penultimate = prog[prog.length - 2]!;
      expect(last.roman).toBe('I');
      expect(last.rootPc).toBe(s.keyPc);
      expect(penultimate.fn).toBe('dominant');
    }
  });

  it('the first bar is always the tonic', () => {
    const prog = generateProgression(resolved({ bars: 4 }));
    expect(prog[0]!.roman).toBe('I');
    expect(prog[0]!.rootPc).toBe(resolved({ bars: 4 }).keyPc);
  });
});
