import { afterEach, describe, expect, it } from 'vitest';
import {
  beatSyncopationScore,
  candidateBeats,
  getActiveDurations,
  fillMeasure,
  partitionBar,
  pickWeightedBeat,
  placeSequential,
  placeSyncopated,
  type RhythmGenSettings,
} from './generator';
import { gridStep, metricPulseBeats } from './time';
import { setRng } from '../theory';

function makeSettings(overrides: Partial<RhythmGenSettings> = {}): RhythmGenSettings {
  const measureTotalBeats = overrides.measureTotalBeats ?? 4;
  const activeDurations = overrides.activeDurations ?? getActiveDurations([4, 2, 1, 0.5, 1.5], false, measureTotalBeats);
  return {
    measureTotalBeats,
    activeDurations,
    restFrequency: overrides.restFrequency ?? 'moderate',
    syncopation: overrides.syncopation ?? 'off',
    gridStepVal: overrides.gridStepVal ?? gridStep(activeDurations),
    pulseBeats: overrides.pulseBeats ?? metricPulseBeats(4, 4),
  };
}

describe('fillMeasure', () => {
  it('always fills the bar exactly (sum of note durations == measureTotalBeats)', () => {
    for (let i = 0; i < 30; i++) {
      const settings = makeSettings();
      const measure = fillMeasure(settings);
      const total = measure.reduce((s, n) => s + n.duration, 0);
      expect(total).toBeCloseTo(settings.measureTotalBeats, 5);
    }
  });

  it('only uses enabled durations', () => {
    const settings = makeSettings({ activeDurations: [1, 0.5] });
    for (let i = 0; i < 20; i++) {
      const measure = fillMeasure(settings);
      measure.forEach((n) => {
        expect([1, 0.5]).toContain(n.duration);
      });
    }
  });

  it('rest frequency "none" produces no rests', () => {
    for (let i = 0; i < 20; i++) {
      const settings = makeSettings({ restFrequency: 'none' });
      const measure = fillMeasure(settings);
      expect(measure.every((n) => !n.isRest)).toBe(true);
    }
  });

  it('syncopation "off" places every onset on a grid pulse (sequential placement)', () => {
    for (let i = 0; i < 20; i++) {
      const settings = makeSettings({ syncopation: 'off' });
      const measure = fillMeasure(settings);
      let expectedBeat = 0;
      const sorted = measure.slice().sort((a, b) => a.beat - b.beat);
      sorted.forEach((n) => {
        expect(n.beat).toBeCloseTo(expectedBeat, 5);
        expectedBeat += n.duration;
      });
    }
  });

  afterEach(() => setRng());

  it('syncopation "moderate"/"heavy" still fills the bar exactly, even off-grid', () => {
    for (const syncopation of ['moderate', 'heavy'] as const) {
      for (let i = 0; i < 20; i++) {
        const settings = makeSettings({ syncopation });
        const measure = fillMeasure(settings);
        const total = measure.reduce((s, n) => s + n.duration, 0);
        expect(total).toBeCloseTo(settings.measureTotalBeats, 5);
      }
    }
  });

  it('syncopation "light" can take either the sequential or the syncopated branch', () => {
    // fillMeasure's own 55%-sequential coin flip for 'light' (rhythm/generator.ts).
    setRng(() => 0); // < 0.55 -> placeSequential
    const sequential = fillMeasure(makeSettings({ syncopation: 'light' }));
    let expectedBeat = 0;
    sequential
      .slice()
      .sort((a, b) => a.beat - b.beat)
      .forEach((n) => {
        expect(n.beat).toBeCloseTo(expectedBeat, 5);
        expectedBeat += n.duration;
      });

    setRng(() => 0.99); // >= 0.55 -> placeSyncopated path is at least exercised without throwing
    const syncopated = fillMeasure(makeSettings({ syncopation: 'light' }));
    expect(syncopated.reduce((s, n) => s + n.duration, 0)).toBeCloseTo(4, 5);
  });
});

describe('partitionBar', () => {
  it('partitions the bar into a subset of the active durations summing to the total', () => {
    const parts = partitionBar(4, [1, 0.5]);
    expect(parts.reduce((s, d) => s + d, 0)).toBeCloseTo(4, 5);
    parts.forEach((d) => expect([1, 0.5]).toContain(d));
  });

  it('extends the final chunk with any remainder when no duration fits exactly', () => {
    const parts = partitionBar(2.5, [2]);
    expect(parts.reduce((s, d) => s + d, 0)).toBeCloseTo(2.5, 5);
  });
});

describe('beatSyncopationScore', () => {
  it('scores on-downbeat lowest, on-offbeat middling, and everything else highest', () => {
    expect(beatSyncopationScore(0, 1)).toBe(1);
    expect(beatSyncopationScore(0.5, 1)).toBe(3);
    expect(beatSyncopationScore(0.25, 1)).toBe(6);
  });
});

describe('candidateBeats', () => {
  it('excludes beats that would overlap already-placed notes', () => {
    const cands = candidateBeats(1, [{ start: 0, end: 1 }], 4, 0.5);
    expect(cands).not.toContain(0);
    expect(cands).not.toContain(0.5);
    expect(cands).toContain(1);
  });
});

describe('pickWeightedBeat', () => {
  it('returns 0 for an empty candidate list', () => {
    expect(pickWeightedBeat([], 'heavy', 1)).toBe(0);
  });

  it('with syncopation "off" (no boost), draws uniformly via random()', () => {
    setRng(() => 0);
    expect(pickWeightedBeat([0, 1, 2], 'off', 1)).toBe(0);
    setRng(() => 0.99);
    expect(pickWeightedBeat([0, 1, 2], 'off', 1)).toBe(2);
  });

  it('with a syncopation boost, still returns one of the candidates', () => {
    setRng(() => 0.5);
    expect([0, 1, 2]).toContain(pickWeightedBeat([0, 1, 2], 'heavy', 1));
  });
});

describe('placeSequential', () => {
  it('places durations back-to-back from beat 0, honoring the rest chance', () => {
    setRng(() => 0); // < any positive restChanceVal -> every note is a rest
    const notes = placeSequential([1, 1], 0.5);
    expect(notes).toEqual([
      { duration: 1, isRest: true, beat: 0 },
      { duration: 1, isRest: true, beat: 1 },
    ]);
  });

  it('restChanceVal 0 never produces a rest', () => {
    const notes = placeSequential([1, 0.5], 0);
    expect(notes.every((n) => !n.isRest)).toBe(true);
  });
});

describe('placeSyncopated', () => {
  it('always fills the bar exactly, falling back to sequential placement if needed', () => {
    for (let i = 0; i < 20; i++) {
      const notes = placeSyncopated([1, 1, 1, 1], 0.2, 4, 0.25, 'heavy', 1);
      expect(notes.reduce((s, n) => s + n.duration, 0)).toBeCloseTo(4, 5);
    }
  });
});

describe('getActiveDurations', () => {
  it('excludes triplet durations when triplets are off', () => {
    const durs = getActiveDurations([1, 0.5, 0.333, 0.667], false, 4);
    expect(durs).not.toContain(0.333);
    expect(durs).not.toContain(0.667);
  });

  it('includes triplet durations when triplets are on', () => {
    const durs = getActiveDurations([1, 0.5], true, 4);
    expect(durs).toContain(0.333);
    expect(durs).toContain(0.667);
  });

  it('excludes durations that do not fit the bar', () => {
    const durs = getActiveDurations([4, 2, 1], false, 2);
    expect(durs).not.toContain(4);
    expect(durs).toContain(2);
    expect(durs).toContain(1);
  });
});
