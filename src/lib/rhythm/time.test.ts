import { describe, expect, it } from 'vitest';
import { durationTicks, measuresEqual, metricPulseBeats, parseTimeSig } from './time';

describe('parseTimeSig', () => {
  it('parses simple meters', () => {
    expect(parseTimeSig('4/4')).toEqual({ beatsPerBar: 4, beatValue: 4, measureBeats: 4 });
    expect(parseTimeSig('3/4')).toEqual({ beatsPerBar: 3, beatValue: 4, measureBeats: 3 });
    expect(parseTimeSig('2/4')).toEqual({ beatsPerBar: 2, beatValue: 4, measureBeats: 2 });
  });

  it('parses compound /8 meters into quarter-beat units', () => {
    expect(parseTimeSig('6/8')).toEqual({ beatsPerBar: 6, beatValue: 8, measureBeats: 3 });
    expect(parseTimeSig('9/8')).toEqual({ beatsPerBar: 9, beatValue: 8, measureBeats: 4.5 });
    expect(parseTimeSig('12/8')).toEqual({ beatsPerBar: 12, beatValue: 8, measureBeats: 6 });
  });
});

describe('metricPulseBeats', () => {
  it('simple meters pulse on the quarter', () => {
    expect(metricPulseBeats(4, 4)).toBe(1);
    expect(metricPulseBeats(4, 3)).toBe(1);
  });

  it('compound /8 meters pulse on the dotted quarter', () => {
    expect(metricPulseBeats(8, 6)).toBe(1.5);
    expect(metricPulseBeats(8, 9)).toBe(1.5);
    expect(metricPulseBeats(8, 12)).toBe(1.5);
  });

  it('non-multiple-of-3 /8 meters pulse on the eighth', () => {
    expect(metricPulseBeats(8, 5)).toBe(0.5);
  });
});

describe('durationTicks', () => {
  it('converts duration units to integer ticks (12 per quarter)', () => {
    expect(durationTicks(1)).toBe(12);
    expect(durationTicks(0.5)).toBe(6);
    expect(durationTicks(0.25)).toBe(3);
    expect(durationTicks(1.5)).toBe(18);
    expect(durationTicks(0.333)).toBe(4);
  });
});

describe('measuresEqual', () => {
  it('is true for identical measures regardless of input order', () => {
    const a = [
      { beat: 0, duration: 1, isRest: false },
      { beat: 1, duration: 1, isRest: true },
    ];
    const b = [
      { beat: 1, duration: 1, isRest: true },
      { beat: 0, duration: 1, isRest: false },
    ];
    expect(measuresEqual(a, b)).toBe(true);
  });

  it('is false when rest-ness differs', () => {
    const a = [{ beat: 0, duration: 1, isRest: false }];
    const b = [{ beat: 0, duration: 1, isRest: true }];
    expect(measuresEqual(a, b)).toBe(false);
  });

  it('is false when lengths differ', () => {
    expect(measuresEqual([{ beat: 0, duration: 1, isRest: false }], [])).toBe(false);
  });
});
