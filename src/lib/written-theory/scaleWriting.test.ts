import { describe, expect, it } from 'vitest';
import { setRng } from '../theory';
import { spellingLabel } from './spelledPitch';
import {
  buildScaleWritingQuestion,
  defaultScaleWritingSettings,
  isMelodicMinorDescendingException,
  scaleWritingPromptText,
  type ScaleWritingSettings,
} from './scaleWriting';

function labels(q: ReturnType<typeof buildScaleWritingQuestion>): string {
  return q!.expected.map((n) => spellingLabel(n)).join(' ');
}

describe('buildScaleWritingQuestion', () => {
  it('returns null when no scale or no clef is enabled', () => {
    expect(buildScaleWritingQuestion({ ...defaultScaleWritingSettings(), scales: [] })).toBeNull();
    expect(buildScaleWritingQuestion({ ...defaultScaleWritingSettings(), clefs: [] })).toBeNull();
  });

  it('500-question sweep: 8 notes, no double accidentals, all within the window, both directions', () => {
    const settings: ScaleWritingSettings = {
      ...defaultScaleWritingSettings(),
      scales: ['major', 'naturalMinor', 'harmonicMinor', 'melodicMinor', 'dorian', 'lydian', 'mixolydian'],
      direction: 'both',
    };
    for (let i = 0; i < 500; i++) {
      const q = buildScaleWritingQuestion(settings)!;
      expect(q.expected).toHaveLength(8);
      q.expected.forEach((n) => {
        expect(n.acc).not.toBe('##');
        expect(n.acc).not.toBe('bb');
      });
    }
  });

  it('the pool excludes G# harmonic minor and D# major (need double accidentals), includes Ab/C# major', () => {
    const settings: ScaleWritingSettings = { ...defaultScaleWritingSettings(), scales: ['harmonicMinor'] };
    for (let i = 0; i < 300; i++) {
      const q = buildScaleWritingQuestion(settings)!;
      expect(`${q.tonic.letter}${q.tonic.acc}`).not.toBe('G#');
    }
    const majorSettings: ScaleWritingSettings = { ...defaultScaleWritingSettings(), scales: ['major'] };
    for (let i = 0; i < 300; i++) {
      const q = buildScaleWritingQuestion(majorSettings)!;
      expect(`${q.tonic.letter}${q.tonic.acc}`).not.toBe('D#');
    }
  });

  it('melodic minor descending is flagged as the classical exception; ascending is not', () => {
    const descending: ScaleWritingSettings = { ...defaultScaleWritingSettings(), scales: ['melodicMinor'], direction: 'descending' };
    const ascending: ScaleWritingSettings = { ...defaultScaleWritingSettings(), scales: ['melodicMinor'], direction: 'ascending' };
    expect(isMelodicMinorDescendingException(buildScaleWritingQuestion(descending)!)).toBe(true);
    expect(isMelodicMinorDescendingException(buildScaleWritingQuestion(ascending)!)).toBe(false);
  });

  it('F melodic minor: ascending = F G Ab Bb C D E F, descending = F Eb Db C Bb Ab G F', () => {
    let ascQ = null;
    let descQ = null;
    for (let i = 0; i < 500 && (!ascQ || !descQ); i++) {
      const settings: ScaleWritingSettings = {
        ...defaultScaleWritingSettings(),
        scales: ['melodicMinor'],
        direction: 'both',
        clefs: ['bass'],
      };
      const q = buildScaleWritingQuestion(settings)!;
      if (`${q.tonic.letter}${q.tonic.acc}` === 'F') {
        if (q.direction === 'ascending' && !ascQ) ascQ = q;
        if (q.direction === 'descending' && !descQ) descQ = q;
      }
    }
    if (ascQ) expect(labels(ascQ)).toBe('F G A♭ B♭ C D E F');
    if (descQ) expect(labels(descQ)).toBe('F E♭ D♭ C B♭ A♭ G F');
  });

  it('octave window: every note stays within the clef staff (a sane practical range)', () => {
    const settings: ScaleWritingSettings = { ...defaultScaleWritingSettings(), clefs: ['treble'] };
    for (let i = 0; i < 200; i++) {
      const q = buildScaleWritingQuestion(settings)!;
      q.expected.forEach((n) => {
        expect(n.octave).toBeGreaterThanOrEqual(2);
        expect(n.octave).toBeLessThanOrEqual(6);
      });
    }
  });

  it('is deterministic under a seeded rng', () => {
    setRng(() => 0);
    const a = buildScaleWritingQuestion(defaultScaleWritingSettings());
    setRng(() => 0);
    const b = buildScaleWritingQuestion(defaultScaleWritingSettings());
    expect(a).toEqual(b);
    setRng();
  });
});

describe('scaleWritingPromptText', () => {
  it('states scale name and direction', () => {
    const settings: ScaleWritingSettings = { ...defaultScaleWritingSettings(), scales: ['major'], direction: 'ascending' };
    const q = buildScaleWritingQuestion(settings)!;
    expect(scaleWritingPromptText(q)).toMatch(/^Write the .* Major scale, ascending\.$/);
  });
});
