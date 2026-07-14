import { describe, expect, it } from 'vitest';
import {
  INTERVAL_TYPES,
  buildIntervalExamQuestion,
  buildIntervalPracticePool,
  defaultIntervalRecognitionSettings,
  getIntervalChoiceDefsForPractice,
  intervalPlaybackNotes,
  pickIntervalQuestion,
} from './intervals';

describe('defaultIntervalRecognitionSettings', () => {
  it('enables intervals of a 5th or narrower by default, both directions', () => {
    const defaults = defaultIntervalRecognitionSettings();
    expect(defaults.direction).toBe('both');
    expect(defaults.enabledIntervals['m2']).toEqual({ asc: true, desc: true });
    expect(defaults.enabledIntervals['P5']).toEqual({ asc: true, desc: true });
    expect(defaults.enabledIntervals['m6']).toEqual({ asc: false, desc: false });
    expect(defaults.enabledIntervals['M9']).toEqual({ asc: false, desc: false });
  });
});

describe('buildIntervalPracticePool', () => {
  it('restricts to a single enabled interval', () => {
    const settings = defaultIntervalRecognitionSettings();
    Object.keys(settings.enabledIntervals).forEach((id) => {
      settings.enabledIntervals[id] = { asc: id === 'P4', desc: id === 'P4' };
    });
    const pool = buildIntervalPracticePool(settings);
    expect(pool.pool.every((e) => e.id === 'P4')).toBe(true);
    expect(pool.pool.length).toBe(2); // asc + desc
  });

  it('filters the pool by direction mode', () => {
    const settings = defaultIntervalRecognitionSettings();
    settings.direction = 'asc';
    const pool = buildIntervalPracticePool(settings);
    expect(pool.pool.every((e) => e.direction === 'asc')).toBe(true);
    expect(pool.pool.length).toBeGreaterThan(0);
  });

  it('produces an empty pool when nothing is enabled', () => {
    const settings = defaultIntervalRecognitionSettings();
    Object.keys(settings.enabledIntervals).forEach((id) => {
      settings.enabledIntervals[id] = { asc: false, desc: false };
    });
    const pool = buildIntervalPracticePool(settings);
    expect(pool.pool).toHaveLength(0);
  });
});

describe('pickIntervalQuestion / buildIntervalExamQuestion', () => {
  it('returns null for an empty pool', () => {
    const pool = { directionMode: 'both' as const, pool: [], noteLen: 0.55, gap: 0.12 };
    expect(pickIntervalQuestion(pool)).toBeNull();
    expect(buildIntervalExamQuestion(pool)).toBeNull();
  });

  it('always draws from the pool and keeps the root+interval within MIDI bounds', () => {
    const settings = defaultIntervalRecognitionSettings();
    const pool = buildIntervalPracticePool(settings);
    for (let i = 0; i < 50; i++) {
      const q = pickIntervalQuestion(pool);
      expect(q).not.toBeNull();
      if (!q) continue;
      expect(pool.pool.some((e) => e.id === q.id && e.direction === q.direction)).toBe(true);
      expect(q.rootMidi).toBeGreaterThanOrEqual(48);
      expect(q.rootMidi + q.semitones).toBeLessThanOrEqual(72);
    }
  });

  it('includes exactly one choice per enabled interval type, sorted by semitones', () => {
    const settings = defaultIntervalRecognitionSettings();
    const pool = buildIntervalPracticePool(settings);
    const defs = getIntervalChoiceDefsForPractice(pool);
    const expectedIds = INTERVAL_TYPES.filter((t) => t.semitones <= 7).map((t) => t.id);
    expect(defs.map((d) => d.id)).toEqual(expectedIds);
  });
});

describe('intervalPlaybackNotes', () => {
  it('orders low-to-high for ascending, high-to-low for descending', () => {
    expect(intervalPlaybackNotes({ rootMidi: 60, semitones: 7, direction: 'asc' })).toEqual([60, 67]);
    expect(intervalPlaybackNotes({ rootMidi: 60, semitones: 7, direction: 'desc' })).toEqual([67, 60]);
  });
});
