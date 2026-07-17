import { describe, expect, it } from 'vitest';
import { generateMelody } from './generator';
import { defaultMelodicDictationSettings } from './settings';
import type { MelodicDictationSettings } from './settings';
import { pitchedMeasuresEqual } from './grading';
import type { PitchedNote } from './theory';
import { beamableRuns, buildVexScore, CURSOR_COLOR, decomposeGap, HOVER_COLOR, WRONG_COLOR } from './vexscore';

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
          hover:
            i % 6 === 0
              ? { measureIndex: 0, beat: (i % 4) * 0.5, midi: i % 2 === 0 ? 60 + (i % 12) : null, isRest: i % 2 !== 0 }
              : null,
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
          hover: null,
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
      hover: null,
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
      hover: null,
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
      hover: null,
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
      hover: null,
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

  it('renders a partial measure (real gaps around a single placed note) without throwing', () => {
    // docs/12 RC-3: this is exactly the shape buildVexScore never saw in the
    // smoke test above (generateMelody always fills every bar) — a mid-bar
    // note with silence before and after it, padded by GhostNotes.
    const settings = { ...defaultMelodicDictationSettings(), measures: 1 };
    const generated = generateMelody(settings);
    const container = document.createElement('div');
    const partialMeasure = [{ beat: 1, duration: 1, rest: false, midi: 64 }];
    expect(() =>
      buildVexScore(container, {
        key: generated.key,
        clef: generated.clef,
        timeSig: { beatsPerBar: 4, beatValue: 4, measureBeats: 4 },
        numMeasures: 1,
        measures: [partialMeasure],
        hasSubmitted: false,
        isCorrect: false,
        revealMeasures: null,
        flashMeasure: null,
        playbackFraction: null,
        cursorMeasureIndex: 0,
        cursorBeat: null,
        cursorMidi: null,
        hover: null,
      }),
    ).not.toThrow();
  });

  it('renders a rest without throwing', () => {
    const settings = { ...defaultMelodicDictationSettings(), measures: 1 };
    const generated = generateMelody(settings);
    const container = document.createElement('div');
    const measureWithRest = [{ beat: 0, duration: 1, rest: true, midi: null }];
    expect(() =>
      buildVexScore(container, {
        key: generated.key,
        clef: generated.clef,
        timeSig: { beatsPerBar: 4, beatValue: 4, measureBeats: 4 },
        numMeasures: 1,
        measures: [measureWithRest],
        hasSubmitted: false,
        isCorrect: false,
        revealMeasures: null,
        flashMeasure: null,
        playbackFraction: null,
        cursorMeasureIndex: 0,
        cursorBeat: null,
        cursorMidi: null,
        hover: null,
      }),
    ).not.toThrow();
  });

  it('draws both the wrong user answer and the WRONG_COLOR reveal when incorrect', () => {
    const settings = { ...defaultMelodicDictationSettings(), measures: 1 };
    const generated = generateMelody(settings);
    const container = document.createElement('div');
    const wrongMeasure = [{ beat: 0, duration: 4, rest: false, midi: 40 }];
    buildVexScore(container, {
      key: generated.key,
      clef: generated.clef,
      timeSig: generated.timeSig,
      numMeasures: 1,
      measures: [wrongMeasure],
      hasSubmitted: true,
      isCorrect: false,
      revealMeasures: generated.measures,
      flashMeasure: null,
      playbackFraction: null,
      cursorMeasureIndex: 0,
      cursorBeat: null,
      cursorMidi: null,
      hover: null,
    });
    const svg = container.querySelector('svg')!;
    const wrongColored = [...svg.querySelectorAll('g,path')].some(
      (el) => el.getAttribute('stroke') === WRONG_COLOR || el.getAttribute('fill') === WRONG_COLOR,
    );
    expect(wrongColored).toBe(true);
  });

  it('draws a hover ghost in HOVER_COLOR when hovering and not submitted', () => {
    const settings = { ...defaultMelodicDictationSettings(), measures: 1 };
    const generated = generateMelody(settings);
    const container = document.createElement('div');
    buildVexScore(container, {
      key: generated.key,
      clef: generated.clef,
      timeSig: { beatsPerBar: 4, beatValue: 4, measureBeats: 4 },
      numMeasures: 1,
      measures: [[]],
      hasSubmitted: false,
      isCorrect: false,
      revealMeasures: null,
      flashMeasure: null,
      playbackFraction: null,
      cursorMeasureIndex: 0,
      cursorBeat: null,
      cursorMidi: null,
      hover: { measureIndex: 0, beat: 1, midi: 64, isRest: false },
    });
    const svg = container.querySelector('svg')!;
    const ghost = [...svg.querySelectorAll('*')].some(
      (el) => el.getAttribute('fill') === HOVER_COLOR || el.getAttribute('stroke') === HOVER_COLOR,
    );
    expect(ghost).toBe(true);
  });

  it('draws no hover ghost once submitted', () => {
    const settings = { ...defaultMelodicDictationSettings(), measures: 1 };
    const generated = generateMelody(settings);
    const container = document.createElement('div');
    buildVexScore(container, {
      key: generated.key,
      clef: generated.clef,
      timeSig: { beatsPerBar: 4, beatValue: 4, measureBeats: 4 },
      numMeasures: 1,
      measures: [[]],
      hasSubmitted: true,
      isCorrect: true,
      revealMeasures: null,
      flashMeasure: null,
      playbackFraction: null,
      cursorMeasureIndex: 0,
      cursorBeat: null,
      cursorMidi: null,
      hover: { measureIndex: 0, beat: 1, midi: 64, isRest: false },
    });
    const svg = container.querySelector('svg')!;
    const ghost = [...svg.querySelectorAll('*')].some(
      (el) => el.getAttribute('fill') === HOVER_COLOR || el.getAttribute('stroke') === HOVER_COLOR,
    );
    expect(ghost).toBe(false);
  });
});

// docs/12-melodic-dictation-fixes.md MD-3: gap-decomposition feeds the
// GhostNote padding that makes placed-note x-position proportional to beat.
describe('decomposeGap', () => {
  it('returns nothing for a zero (already-full) gap', () => {
    expect(decomposeGap(0)).toEqual([]);
  });

  it('decomposes a dotted-quarter-sized gap in one chunk', () => {
    expect(decomposeGap(1.5)).toEqual([1.5]);
  });

  it('sums to the full bar for an empty 3/4 measure', () => {
    const chunks = decomposeGap(3);
    expect(chunks.reduce((s, d) => s + d, 0)).toBeCloseTo(3, 6);
  });

  it('sums exactly for an arbitrary quarter-grid gap', () => {
    const chunks = decomposeGap(2.75);
    expect(chunks.reduce((s, d) => s + d, 0)).toBeCloseTo(2.75, 6);
  });
});

// docs/12-melodic-dictation-fixes.md MD-2: only time-adjacent, non-rest,
// sub-beat runs of 2+ notes should ever receive a beam.
describe('beamableRuns', () => {
  const note = (beat: number, duration: number, rest = false): PitchedNote => ({ beat, duration, rest, midi: rest ? null : 60 });

  it('does not beam a lone eighth note', () => {
    expect(beamableRuns([note(0, 0.5)])).toEqual([]);
  });

  it('beams two time-adjacent eighths into one run', () => {
    const notes = [note(0, 0.5), note(0.5, 0.5)];
    expect(beamableRuns(notes)).toEqual([notes]);
  });

  it('does not beam eighths separated by a gap', () => {
    const notes = [note(0, 0.5), note(2, 0.5)];
    expect(beamableRuns(notes)).toEqual([]);
  });

  it('does not beam eighths separated by a rest', () => {
    const notes = [note(0, 0.5), note(0.5, 0.5, true), note(1, 0.5)];
    expect(beamableRuns(notes)).toEqual([]);
  });

  it('beams four adjacent sixteenths into one run', () => {
    const notes = [note(0, 0.25), note(0.25, 0.25), note(0.5, 0.25), note(0.75, 0.25)];
    expect(beamableRuns(notes)).toEqual([notes]);
  });

  it('never beams quarter notes or longer', () => {
    const notes = [note(0, 1), note(1, 1)];
    expect(beamableRuns(notes)).toEqual([]);
  });
});
