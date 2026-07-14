import { describe, expect, it } from 'vitest';
import { generateMelody } from './generator';
import { defaultMelodicDictationSettings } from './settings';
import type { MelodicDictationSettings } from './settings';
import { pitchedMeasuresEqual } from './grading';
import { buildVexScore } from './vexscore';

// Smoke test (docs/04-notation-engine.md §B7): builds without throwing for
// generated melodies across all settings combinations (property-style loop).
describe('buildVexScore smoke test', () => {
  it('renders without throwing for 200 random settings/melody combinations, both submitted and unsubmitted', () => {
    const clefs: MelodicDictationSettings['clef'][] = ['treble', 'bass', 'random'];
    const keys = ['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb', 'Ab', 'Am', 'Em', 'Dm', 'Gm', 'Cm'];
    const ranges: MelodicDictationSettings['range'][] = ['narrow', 'medium', 'wide'];
    const chromatics: MelodicDictationSettings['chromatic'][] = ['none', 'light', 'moderate'];
    const motions: MelodicDictationSettings['motion'][] = ['steps', 'mixed', 'leapy'];
    const measuresOptions = [1, 2, 4];

    for (let i = 0; i < 200; i++) {
      const settings: MelodicDictationSettings = {
        ...defaultMelodicDictationSettings(),
        clef: clefs[i % clefs.length]!,
        key: keys[i % keys.length]!,
        range: ranges[i % ranges.length]!,
        chromatic: chromatics[i % chromatics.length]!,
        motion: motions[i % motions.length]!,
        measures: measuresOptions[i % measuresOptions.length]!,
      };
      const generated = generateMelody(settings);
      const container = document.createElement('div');

      expect(() =>
        buildVexScore(container, {
          key: generated.key,
          clef: generated.clef,
          timeSig: generated.timeSig,
          numMeasures: settings.measures,
          measures: generated.measures,
          hasSubmitted: false,
          isCorrect: false,
          revealMeasures: null,
        }),
      ).not.toThrow();

      const isCorrect = pitchedMeasuresEqual(generated.measures, generated.measures);
      expect(() =>
        buildVexScore(container, {
          key: generated.key,
          clef: generated.clef,
          timeSig: generated.timeSig,
          numMeasures: settings.measures,
          measures: generated.measures,
          hasSubmitted: true,
          isCorrect,
          revealMeasures: generated.measures,
        }),
      ).not.toThrow();
    }
  });

  it('returns one geometry entry per measure', () => {
    const settings = { ...defaultMelodicDictationSettings(), measures: 4 };
    const generated = generateMelody(settings);
    const container = document.createElement('div');
    const geometry = buildVexScore(container, {
      key: generated.key,
      clef: generated.clef,
      timeSig: generated.timeSig,
      numMeasures: settings.measures,
      measures: generated.measures,
      hasSubmitted: false,
      isCorrect: false,
      revealMeasures: null,
    });
    expect(geometry).toHaveLength(4);
    expect(geometry.map((g) => g.index)).toEqual([0, 1, 2, 3]);
  });
});
