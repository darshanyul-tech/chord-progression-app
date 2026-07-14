import { describe, expect, it } from 'vitest';
import { getActiveDurations, fillMeasure, type RhythmGenSettings } from './generator';
import { gridStep, metricPulseBeats } from './time';

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
