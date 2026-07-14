import { describe, expect, it } from 'vitest';
import { familyExtToQuality, gradeBarMatch } from './grading';
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
