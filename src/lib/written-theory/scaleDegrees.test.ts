import { describe, expect, it } from 'vitest';
import { setRng } from '../theory';
import { theoryKeyById, scaleSpelling } from './keys';
import {
  buildScaleDegreeChoices,
  buildScaleDegreeQuestion,
  defaultScaleDegreesSettings,
  type ScaleDegreesSettings,
} from './scaleDegrees';

describe('buildScaleDegreeQuestion', () => {
  it('returns null when the pool is empty (accidental bound below the 0-key)', () => {
    // maxAccidentals must be >=0; a negative bound is the only way to empty the pool.
    expect(buildScaleDegreeQuestion({ ...defaultScaleDegreesSettings(), maxAccidentals: -1 })).toBeNull();
  });

  it('spot-check: Eb major + C is degree 6 (docs §5 canonical example)', () => {
    for (let i = 0; i < 200; i++) {
      const q = buildScaleDegreeQuestion({ ...defaultScaleDegreesSettings(), keys: 'major', maxAccidentals: 3 });
      if (q!.key.id === 'Eb' && q!.note.letter === 'C' && q!.note.acc === '') {
        expect(q!.degree).toBe(6);
        return;
      }
    }
    // If Eb never came up in 200 draws (astronomically unlikely with 8 majors <=3
    // accidentals), fall back to direct construction via the same math.
    const key = theoryKeyById('Eb');
    const idx = scaleSpelling(key).findIndex((d) => d.letter === 'C' && d.acc === '');
    expect(idx + 1).toBe(6);
  });

  it('B minor: A is degree 7', () => {
    const key = theoryKeyById('Bm');
    const idx = scaleSpelling(key).findIndex((d) => d.letter === 'A' && d.acc === '');
    expect(idx + 1).toBe(7);
  });

  it('F# major: E# is degree 7, spelled with the sharp (never respelled as F)', () => {
    const key = theoryKeyById('F#');
    const degrees = scaleSpelling(key);
    expect(degrees[6]).toEqual({ letter: 'E', acc: '#' });
  });

  it('every asked note is exactly the key\'s own scaleSpelling entry — 500-draw sweep', () => {
    const settings: ScaleDegreesSettings = { ...defaultScaleDegreesSettings(), maxAccidentals: 7, keys: 'both' };
    for (let i = 0; i < 500; i++) {
      const q = buildScaleDegreeQuestion(settings)!;
      const expected = scaleSpelling(q.key)[q.degree - 1]!;
      expect(q.note.letter).toBe(expected.letter);
      expect(q.note.acc).toBe(expected.acc);
    }
  });

  it('pool respects the mode and accidental settings', () => {
    for (let i = 0; i < 200; i++) {
      const q = buildScaleDegreeQuestion({ ...defaultScaleDegreesSettings(), keys: 'minor', maxAccidentals: 2 })!;
      expect(q.key.mode).toBe('minor');
      expect(q.key.accidentalCount).toBeLessThanOrEqual(2);
    }
  });

  it('the displayed staff octave is always within a sane practical range', () => {
    for (let i = 0; i < 300; i++) {
      const q = buildScaleDegreeQuestion({ ...defaultScaleDegreesSettings(), maxAccidentals: 7 })!;
      expect(q.note.octave).toBeGreaterThanOrEqual(2);
      expect(q.note.octave).toBeLessThanOrEqual(6);
    }
  });

  it('is deterministic under a seeded rng', () => {
    setRng(() => 0);
    const a = buildScaleDegreeQuestion(defaultScaleDegreesSettings());
    setRng(() => 0);
    const b = buildScaleDegreeQuestion(defaultScaleDegreesSettings());
    expect(a).toEqual(b);
    setRng();
  });
});

describe('buildScaleDegreeChoices', () => {
  it('always exactly 7 choices', () => {
    expect(buildScaleDegreeChoices('major', 'numbers')).toHaveLength(7);
    expect(buildScaleDegreeChoices('minor', 'names')).toHaveLength(7);
  });

  it('degree 7 is labeled Leading note in major, Subtonic in minor', () => {
    const major = buildScaleDegreeChoices('major', 'names');
    const minor = buildScaleDegreeChoices('minor', 'names');
    expect(major[6]!.label).toContain('Leading note');
    expect(minor[6]!.label).toContain('Subtonic');
  });

  it('both numeral and name are always present in the label, regardless of the setting', () => {
    const numbersFirst = buildScaleDegreeChoices('major', 'numbers')[0]!.label;
    const namesFirst = buildScaleDegreeChoices('major', 'names')[0]!.label;
    expect(numbersFirst).toContain('1̂');
    expect(numbersFirst).toContain('Tonic');
    expect(namesFirst).toContain('1̂');
    expect(namesFirst).toContain('Tonic');
  });
});
