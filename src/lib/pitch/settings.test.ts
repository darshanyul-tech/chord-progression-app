import { describe, expect, it } from 'vitest';
import { defaultIntervalSingingSettings, TOLERANCE_CENTS } from './settings';
import { INTERVAL_TYPES } from '../recognition/intervals';

describe('defaultIntervalSingingSettings', () => {
  it('enables every interval up to a perfect 5th by default, matching Interval Recognition', () => {
    const s = defaultIntervalSingingSettings();
    INTERVAL_TYPES.forEach((t) => {
      const expected = t.semitones <= 7;
      expect(s.enabledIntervals[t.id]).toEqual({ asc: expected, desc: expected });
    });
  });

  it('defaults to sensible, singer-friendly values', () => {
    const s = defaultIntervalSingingSettings();
    expect(s.direction).toBe('both');
    expect(s.rootRange).toBe('auto');
    expect(s.tolerance).toBe('default');
    expect(s.octaveEquivalence).toBe(true);
    expect(s.holdTimeSec).toBe(0.5);
    expect(s.autoAdvance).toBe(false);
  });
});

describe('TOLERANCE_CENTS', () => {
  it('maps each tolerance level to its cents value, strict < default < relaxed', () => {
    expect(TOLERANCE_CENTS.strict).toBe(30);
    expect(TOLERANCE_CENTS.default).toBe(50);
    expect(TOLERANCE_CENTS.relaxed).toBe(75);
    expect(TOLERANCE_CENTS.strict).toBeLessThan(TOLERANCE_CENTS.default);
    expect(TOLERANCE_CENTS.default).toBeLessThan(TOLERANCE_CENTS.relaxed);
  });
});
