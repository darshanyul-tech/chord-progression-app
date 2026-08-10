import { describe, expect, it } from 'vitest';
import { mod12 } from '../theory';
import { generateProgression, makeTritoneSub } from './generator';
import { chordId, degreePc } from './theory';
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

  it('with secondary dominants and chromaticism off, stays diatonic even when "Diatonic only" is off', () => {
    // Secondary dominants gate the applied-dominant and borrowed-iv colours too,
    // so turning them off (the default) must not sneak chromatic colour in.
    const s = resolved({ diatonicOnly: false, allowSecondaryDominant: false, chromatic: false, bars: 8 });
    for (let trial = 0; trial < 20; trial++) {
      const prog = generateProgression(s);
      prog.forEach((ch) => {
        expect(ch.secondary).toBe(false);
        expect(ch.chromatic).toBeFalsy();
        expect(ch.roman).not.toBe('iv'); // borrowed iv
      });
    }
  });

  it('enabling secondary dominants introduces V/x colour chords', () => {
    const s = resolved({ diatonicOnly: false, allowSecondaryDominant: true, chromatic: false, bars: 8 });
    let sawSecondary = false;
    for (let trial = 0; trial < 60 && !sawSecondary; trial++) {
      sawSecondary = generateProgression(s).some((ch) => ch.roman.includes('(V/'));
    }
    expect(sawSecondary).toBe(true);
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

  it('can produce a tritone-substitution chord when chromaticism is enabled', () => {
    // A tritone sub sits a semitone above its target degree's root (a secondary
    // dominant sits a fifth above; an applied dominant sits on the degree
    // itself), so that half-step offset uniquely identifies it. makeChromaticApproach
    // (the insertChromaticChords pass) leaves degree null, so it's excluded here.
    const s = resolved({ diatonicOnly: false, chromatic: true, chromaticCount: 1, bars: 8 });
    let sawTritoneSub = false;
    for (let trial = 0; trial < 60 && !sawTritoneSub; trial++) {
      const prog = generateProgression(s);
      sawTritoneSub = prog.some(
        (ch) => ch.secondary && ch.degree !== null && mod12(ch.rootPc - degreePc(s.keyPc, ch.degree, s)) === 1,
      );
    }
    expect(sawTritoneSub).toBe(true);
  });
});

describe('makeTritoneSub', () => {
  it('builds a dominant 7th a semitone above the target degree, written as the dominant it spells', () => {
    const s = resolved();
    const ch = makeTritoneSub(5, s); // target = V (G) → sub root Ab = bVI, spelling V/bII
    expect(ch.secondary).toBe(true);
    expect(ch.roman).toBe('bVI7 (V/bII)');
  });
});
