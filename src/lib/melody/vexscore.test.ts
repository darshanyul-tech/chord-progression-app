import { describe, expect, it } from 'vitest';
import { generateMelody } from './generator';
import { defaultMelodicDictationSettings } from './settings';
import type { MelodicDictationSettings } from './settings';
import { pitchedMeasuresEqual } from './grading';
import { buildVexScore, CURSOR_COLOR, WRONG_COLOR } from './vexscore';

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
          flashMeasure: i % 3 === 0 ? i % settings.measures : null,
          playbackFraction: i % 2 === 0 ? (i % 100) / 100 : null,
          cursorMeasureIndex: 0,
          cursorBeat: i % 4 === 0 ? (i % 4) : null,
          cursorMidi: i % 5 === 0 ? 60 + (i % 12) : null,
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
          flashMeasure: null,
          playbackFraction: null,
          cursorMeasureIndex: 0,
          cursorBeat: null,
          cursorMidi: null,
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
      flashMeasure: null,
      playbackFraction: null,
      cursorMeasureIndex: 0,
      cursorBeat: null,
      cursorMidi: null,
    });
    expect(geometry).toHaveLength(4);
    expect(geometry.map((g) => g.index)).toEqual([0, 1, 2, 3]);
  });

  it('draws a playback cursor in CURSOR_COLOR when playbackFraction is set', () => {
    const settings = { ...defaultMelodicDictationSettings(), measures: 2 };
    const generated = generateMelody(settings);
    const container = document.createElement('div');
    buildVexScore(container, {
      key: generated.key,
      clef: generated.clef,
      timeSig: generated.timeSig,
      numMeasures: settings.measures,
      measures: generated.measures,
      hasSubmitted: false,
      isCorrect: false,
      revealMeasures: null,
      flashMeasure: null,
      playbackFraction: 0.5,
      cursorMeasureIndex: 0,
      cursorBeat: null,
      cursorMidi: null,
    });
    const svg = container.querySelector('svg')!;
    const cursor = [...svg.querySelectorAll('path')].some((p) => p.getAttribute('stroke') === CURSOR_COLOR);
    expect(cursor).toBe(true);
  });

  it('draws no cursor when playbackFraction is null', () => {
    const settings = { ...defaultMelodicDictationSettings(), measures: 2 };
    const generated = generateMelody(settings);
    const container = document.createElement('div');
    buildVexScore(container, {
      key: generated.key,
      clef: generated.clef,
      timeSig: generated.timeSig,
      numMeasures: settings.measures,
      measures: generated.measures,
      hasSubmitted: false,
      isCorrect: false,
      revealMeasures: null,
      flashMeasure: null,
      playbackFraction: null,
      cursorMeasureIndex: 0,
      cursorBeat: null,
      cursorMidi: null,
    });
    const svg = container.querySelector('svg')!;
    const cursor = [...svg.querySelectorAll('path')].some((p) => p.getAttribute('stroke') === CURSOR_COLOR);
    expect(cursor).toBe(false);
  });

  it('flashes the given measure in WRONG_COLOR', () => {
    const settings = { ...defaultMelodicDictationSettings(), measures: 2 };
    const generated = generateMelody(settings);
    const container = document.createElement('div');
    buildVexScore(container, {
      key: generated.key,
      clef: generated.clef,
      timeSig: generated.timeSig,
      numMeasures: settings.measures,
      measures: generated.measures,
      hasSubmitted: false,
      isCorrect: false,
      revealMeasures: null,
      flashMeasure: 0,
      playbackFraction: null,
      cursorMeasureIndex: 0,
      cursorBeat: null,
      cursorMidi: null,
    });
    const svg = container.querySelector('svg')!;
    // The color lands on the enclosing <g> (SVG stroke/fill are inherited by
    // descendants), not necessarily on each individual <path> — VexFlow's
    // SVG backend skips re-writing an attribute on a child that already
    // matches its parent group's.
    const flashed = [...svg.querySelectorAll('g,path')].some(
      (el) => el.getAttribute('stroke') === WRONG_COLOR || el.getAttribute('fill') === WRONG_COLOR,
    );
    expect(flashed).toBe(true);
  });
});
