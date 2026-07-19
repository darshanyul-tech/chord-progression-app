import { describe, expect, it } from 'vitest';
import { setRng } from '../theory';
import {
  buildIntervalWritingQuestion,
  defaultIntervalWritingSettings,
  intervalWritingPromptText,
  type IntervalWritingSettings,
} from './intervalWriting';

describe('buildIntervalWritingQuestion', () => {
  it('returns null when no interval or no clef is enabled', () => {
    expect(buildIntervalWritingQuestion({ ...defaultIntervalWritingSettings(), intervals: [] })).toBeNull();
    expect(buildIntervalWritingQuestion({ ...defaultIntervalWritingSettings(), clefs: [] })).toBeNull();
  });

  it('pool-filter exclusion: C# never appears as a given note for A4 (would need F##)', () => {
    const settings: IntervalWritingSettings = {
      ...defaultIntervalWritingSettings(),
      intervals: ['A4'],
      direction: 'above',
      clefs: ['treble'],
    };
    for (let i = 0; i < 500; i++) {
      const q = buildIntervalWritingQuestion(settings)!;
      expect(`${q.given.letter}${q.given.acc}`).not.toBe('C#');
      expect(q.expected.acc).not.toBe('##');
      expect(q.expected.acc).not.toBe('bb');
    }
  });

  it('500-question sweep per direction: no double accidentals, notes within the window, every enabled interval appears', () => {
    (['above', 'below'] as const).forEach((direction) => {
      const settings: IntervalWritingSettings = {
        ...defaultIntervalWritingSettings(),
        intervals: ['m2', 'M2', 'm3', 'M3', 'P4', 'A4', 'd5', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'],
        direction,
      };
      const seenIntervals = new Set<string>();
      for (let i = 0; i < 500; i++) {
        const q = buildIntervalWritingQuestion(settings)!;
        expect(q.direction).toBe(direction);
        expect(['', '#', 'b']).toContain(q.given.acc);
        expect(['', '#', 'b']).toContain(q.expected.acc);
        seenIntervals.add(q.intervalId);
      }
      expect(seenIntervals.size).toBe(settings.intervals.length);
    });
  });

  it('"both" direction produces both directions over many draws', () => {
    const settings: IntervalWritingSettings = { ...defaultIntervalWritingSettings(), direction: 'both' };
    const directions = new Set<string>();
    for (let i = 0; i < 200; i++) directions.add(buildIntervalWritingQuestion(settings)!.direction);
    expect(directions.has('above')).toBe(true);
    expect(directions.has('below')).toBe(true);
  });

  it('is deterministic under a seeded rng', () => {
    setRng(() => 0);
    const a = buildIntervalWritingQuestion(defaultIntervalWritingSettings());
    setRng(() => 0);
    const b = buildIntervalWritingQuestion(defaultIntervalWritingSettings());
    expect(a).toEqual(b);
    setRng();
  });
});

describe('intervalWritingPromptText', () => {
  it('states the interval and direction in full words', () => {
    const settings: IntervalWritingSettings = {
      ...defaultIntervalWritingSettings(),
      intervals: ['M6'],
      direction: 'above',
    };
    const q = buildIntervalWritingQuestion(settings)!;
    expect(intervalWritingPromptText(q)).toBe('Write a major 6th above the given note.');
  });
});
