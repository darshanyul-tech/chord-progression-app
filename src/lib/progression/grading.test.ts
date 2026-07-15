import { describe, expect, it } from 'vitest';
import {
  degreeOptions,
  describeBarAnswer,
  describeBarGuess,
  extensionOptions,
  familiesMatch,
  familyExtToQuality,
  familyOptions,
  gradeBarMatch,
} from './grading';
import { defaultProgressionSettings, resolvePracticeSettings } from './settings';
import type { ProgChord } from './theory';

function resolved(overrides: Partial<ReturnType<typeof defaultProgressionSettings>> = {}) {
  return resolvePracticeSettings({ ...defaultProgressionSettings(), ...overrides });
}

describe('familyExtToQuality', () => {
  it('maps triad-mode families regardless of requested extension', () => {
    const s = { extensions: [3] };
    expect(familyExtToQuality('maj', 3, s)).toBe('maj');
    expect(familyExtToQuality('min', 3, s)).toBe('m');
    expect(familyExtToQuality('dim', 3, s)).toBe('dim');
  });

  it('maps seventh-chord families at ext=7', () => {
    const s = { extensions: [7] };
    expect(familyExtToQuality('maj', 7, s)).toBe('maj7');
    expect(familyExtToQuality('min', 7, s)).toBe('m7');
    expect(familyExtToQuality('dom', 7, s)).toBe('7');
    expect(familyExtToQuality('halfdim', 7, s)).toBe('m7b5');
    expect(familyExtToQuality('dim', 7, s)).toBe('dim7');
  });

  it('maps upper extensions per family', () => {
    const s = { extensions: [7, 9, 11, 13] };
    expect(familyExtToQuality('maj', 9, s)).toBe('maj9');
    expect(familyExtToQuality('maj', 11, s)).toBe('maj11');
    expect(familyExtToQuality('maj', 13, s)).toBe('maj13');
    expect(familyExtToQuality('min', 9, s)).toBe('m9');
    expect(familyExtToQuality('dom', 9, s)).toBe('9');
    expect(familyExtToQuality('dom', 13, s)).toBe('13');
  });
});

describe('gradeBarMatch', () => {
  const s = resolved({ inversions: true });
  const chord: ProgChord = {
    degree: 1,
    fn: 'tonic',
    rootPc: s.keyPc,
    rootName: s.key,
    quality: 'maj7',
    rootDegree: 1,
    family: 'maj',
    ext: 7,
    symbol: `${s.key}maj7`,
    roman: 'I',
    inversion: 1,
    secondary: false,
  };

  it('is fully correct when degree, family, ext, and inversion all match', () => {
    const match = gradeBarMatch(chord, 0, 'maj', 7, 1, s);
    expect(match).toEqual({ degOk: true, famOk: true, extOk: true, invOk: true, allOk: true });
  });

  it('flags a wrong scale-degree guess', () => {
    const match = gradeBarMatch(chord, 2, 'maj', 7, 1, s);
    expect(match.degOk).toBe(false);
    expect(match.allOk).toBe(false);
  });

  it('flags a wrong family/ext but still credits degree', () => {
    const match = gradeBarMatch(chord, 0, 'min', 7, 1, s);
    expect(match.degOk).toBe(true);
    expect(match.famOk).toBe(false);
    expect(match.allOk).toBe(false);
  });

  it('ignores inversion when inversions setting is off', () => {
    const sNoInv = resolved({ inversions: false });
    const match = gradeBarMatch(chord, 0, 'maj', 7, 0, sNoInv);
    expect(match.invOk).toBe(true);
  });

  it('treats major and dominant as equivalent in triad mode (no 7ths)', () => {
    const triadSettings = resolved({ extensions: [] }); // falls back to [3]
    const triadChord: ProgChord = { ...chord, quality: 'dom', family: 'dom', ext: 3 };
    const match = gradeBarMatch(triadChord, 0, 'maj', 3, null, triadSettings);
    expect(match.famOk).toBe(true);
  });
});

describe('familiesMatch', () => {
  it('is true for an exact family match', () => {
    expect(familiesMatch('maj', 'maj', { extensions: [7] })).toBe(true);
  });

  it('is false for a mismatch once 7ths are allowed (no maj/dom equivalence)', () => {
    expect(familiesMatch('maj', 'dom', { extensions: [7] })).toBe(false);
  });

  it('treats non-maj/dom families as still mismatched in triad mode', () => {
    expect(familiesMatch('min', 'dim', { extensions: [] })).toBe(false);
  });
});

describe('familyOptions', () => {
  it('offers the full 5-family list once 7ths are allowed', () => {
    expect(familyOptions({ extensions: [7] })).toHaveLength(5);
  });

  it('offers only the 3-family triad list without 7ths', () => {
    expect(familyOptions({ extensions: [] })).toHaveLength(3);
  });
});

describe('extensionOptions', () => {
  it('offers only Triad in triad mode', () => {
    expect(extensionOptions({ extensions: [] })).toEqual([{ value: 3, label: 'Triad' }]);
  });

  it('offers 7th plus every other enabled extension', () => {
    const opts = extensionOptions({ extensions: [7, 9, 13] });
    expect(opts.map((o) => o.value)).toEqual([7, 9, 13]);
  });
});

describe('degreeOptions', () => {
  it('lists the 7 diatonic scale degrees by default', () => {
    const s = resolved();
    const opts = degreeOptions(s);
    expect(opts).toHaveLength(7);
    expect(opts[0]!.label).toBe('I');
  });

  it('lists all 12 chromatic roman numerals when chromaticism is on', () => {
    const s = resolved();
    const opts = degreeOptions({ ...s, chromaticism: true });
    expect(opts).toHaveLength(12);
  });
});

describe('describeBarAnswer / describeBarGuess', () => {
  const s = resolved({ inversions: true });
  const chord: ProgChord = {
    degree: 1,
    fn: 'tonic',
    rootPc: s.keyPc,
    rootName: s.key,
    quality: 'maj7',
    rootDegree: 1,
    family: 'maj',
    ext: 7,
    symbol: `${s.key}maj7`,
    roman: 'I',
    inversion: 1,
    secondary: false,
  };

  it('describeBarAnswer includes the roman numeral, quality, and (when on) inversion', () => {
    const text = describeBarAnswer(chord, s);
    expect(text).toContain('I');
    expect(text).toContain(chord.symbol);
  });

  it('describeBarGuess includes the guessed roman label and resulting symbol', () => {
    const text = describeBarGuess(0, 'maj', 7, 1, s, 'I');
    expect(text).toContain('I');
    expect(text).toContain(s.key);
  });
});
