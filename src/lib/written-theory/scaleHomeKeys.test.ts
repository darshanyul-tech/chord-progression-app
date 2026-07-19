import { describe, expect, it } from 'vitest';
import { setRng } from '../theory';
import { theoryKeyById } from './keys';
import { transposeUp } from './spelledPitch';
import {
  buildScaleHomeKeyChoices,
  buildScaleHomeKeyQuestion,
  defaultScaleHomeKeysSettings,
  SCALE_HOME_KEY_MODES,
  type ScaleHomeKeyModeId,
  type ScaleHomeKeysSettings,
} from './scaleHomeKeys';

// Home key -> tonic, using the exact mechanism buildScaleHomeKeyQuestion uses
// internally, so this table check exercises the real interval math directly
// rather than fishing a specific draw out of the RNG.
function tonicFor(homeKeyId: string, modeId: ScaleHomeKeyModeId) {
  const homeKey = theoryKeyById(homeKeyId);
  const mode = SCALE_HOME_KEY_MODES.find((m) => m.id === modeId)!;
  return transposeUp({ letter: homeKey.tonic.letter, acc: homeKey.tonic.acc, octave: 4 }, mode.interval);
}

describe('mode -> home-key table (docs/15-theory-topics/04 §4)', () => {
  it('D Lydian -> A (the canonical example)', () => {
    expect(tonicFor('A', 'lydian')).toEqual({ letter: 'D', acc: '', octave: 5 });
  });

  it('E Dorian -> D', () => {
    expect(tonicFor('D', 'dorian').letter + tonicFor('D', 'dorian').acc).toBe('E');
  });

  it('B Phrygian -> G', () => {
    expect(tonicFor('G', 'phrygian').letter + tonicFor('G', 'phrygian').acc).toBe('B');
  });

  it('F Mixolydian -> Bb', () => {
    expect(tonicFor('Bb', 'mixolydian').letter + tonicFor('Bb', 'mixolydian').acc).toBe('F');
  });

  it('C# Aeolian -> E', () => {
    expect(tonicFor('E', 'aeolian').letter + tonicFor('E', 'aeolian').acc).toBe('C#');
  });

  it('F# Locrian -> G', () => {
    expect(tonicFor('G', 'locrian').letter + tonicFor('G', 'locrian').acc).toBe('F#');
  });

  it('Gb Lydian -> Db (flat-side spelling preserved)', () => {
    expect(tonicFor('Db', 'lydian').letter + tonicFor('Db', 'lydian').acc).toBe('Gb');
  });
});

describe('buildScaleHomeKeyQuestion', () => {
  it('returns null when no mode is enabled', () => {
    expect(buildScaleHomeKeyQuestion({ ...defaultScaleHomeKeysSettings(), modes: [] })).toBeNull();
  });

  it('forward question: home key is always in the table and within the slider bound', () => {
    const settings: ScaleHomeKeysSettings = {
      ...defaultScaleHomeKeysSettings(),
      reverse: 'off',
      maxAccidentals: 4,
      modes: ['dorian', 'lydian', 'mixolydian', 'aeolian', 'phrygian', 'locrian'],
    };
    for (let i = 0; i < 500; i++) {
      const q = buildScaleHomeKeyQuestion(settings)!;
      expect(q.direction).toBe('forward');
      const homeKey = theoryKeyById(q.homeKeyId);
      expect(homeKey.mode).toBe('major');
      expect(homeKey.accidentalCount).toBeLessThanOrEqual(4);
      expect(q.answerId).toBe(q.homeKeyId);
    }
  });

  it('reverse question: answer is always one of the 7 modes', () => {
    const settings: ScaleHomeKeysSettings = { ...defaultScaleHomeKeysSettings(), reverse: 'only' };
    for (let i = 0; i < 200; i++) {
      const q = buildScaleHomeKeyQuestion(settings)!;
      expect(q.direction).toBe('reverse');
      expect(SCALE_HOME_KEY_MODES.map((m) => m.id)).toContain(q.answerId);
    }
  });

  it('"mixed" reverse setting produces both directions over many draws', () => {
    const settings: ScaleHomeKeysSettings = { ...defaultScaleHomeKeysSettings(), reverse: 'mixed' };
    const directions = new Set<string>();
    for (let i = 0; i < 200; i++) directions.add(buildScaleHomeKeyQuestion(settings)!.direction);
    expect(directions.has('forward')).toBe(true);
    expect(directions.has('reverse')).toBe(true);
  });

  it('is deterministic under a seeded rng', () => {
    setRng(() => 0);
    const a = buildScaleHomeKeyQuestion(defaultScaleHomeKeysSettings());
    setRng(() => 0);
    const b = buildScaleHomeKeyQuestion(defaultScaleHomeKeysSettings());
    expect(a).toEqual(b);
    setRng();
  });
});

describe('buildScaleHomeKeyChoices', () => {
  it('forward -> 15 major keys; reverse -> 7 modes', () => {
    expect(buildScaleHomeKeyChoices('forward')).toHaveLength(15);
    expect(buildScaleHomeKeyChoices('reverse')).toHaveLength(7);
  });
});
