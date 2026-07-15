import { describe, expect, it } from 'vitest';
import {
  beatFromClickX,
  durationClose,
  durationFitsBar,
  durationTicks,
  gcdInt,
  gridStep,
  maxNotesOfDuration,
  measuresEqual,
  measureWidth,
  metricPulseBeats,
  metricPulseCount,
  noteOverlaps,
  noteX,
  parseTimeSig,
  snapBeat,
  sortNotes,
} from './time';

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

describe('metricPulseCount', () => {
  it('rounds the measure/pulse ratio, with a floor of 1', () => {
    expect(metricPulseCount(4, 1)).toBe(4);
    expect(metricPulseCount(3, 1.5)).toBe(2);
    expect(metricPulseCount(0.4, 1)).toBe(1);
  });
});

describe('gcdInt', () => {
  it('computes the greatest common divisor of two integers', () => {
    expect(gcdInt(12, 8)).toBe(4);
    expect(gcdInt(7, 5)).toBe(1);
  });

  it('falls back to 1 when both inputs are 0', () => {
    expect(gcdInt(0, 0)).toBe(1);
  });
});

describe('durationClose', () => {
  it('treats values within 0.01 as equal', () => {
    expect(durationClose(1, 1.005)).toBe(true);
    expect(durationClose(1, 1.02)).toBe(false);
  });
});

describe('maxNotesOfDuration', () => {
  it('floors how many of a duration fit in a bar', () => {
    expect(maxNotesOfDuration(1, 4)).toBe(4);
    expect(maxNotesOfDuration(1.5, 4)).toBe(2);
  });

  it('returns 0 for a non-positive duration', () => {
    expect(maxNotesOfDuration(0, 4)).toBe(0);
    expect(maxNotesOfDuration(-1, 4)).toBe(0);
  });
});

describe('durationFitsBar', () => {
  it('accepts durations up to the bar capacity and rejects non-positive/oversized ones', () => {
    expect(durationFitsBar(4, 4)).toBe(true);
    expect(durationFitsBar(4.5, 4)).toBe(false);
    expect(durationFitsBar(0, 4)).toBe(false);
  });
});

describe('sortNotes', () => {
  it('sorts by beat and treats undefined as an empty measure', () => {
    const notes = [
      { beat: 2, duration: 1, isRest: false },
      { beat: 0, duration: 1, isRest: false },
    ];
    expect(sortNotes(notes).map((n) => n.beat)).toEqual([0, 2]);
    expect(sortNotes(undefined)).toEqual([]);
  });
});

describe('gridStep', () => {
  it('is the GCD (in ticks) of the active durations, converted back to beat units', () => {
    expect(gridStep([1, 0.5])).toBeCloseTo(0.5);
    expect(gridStep([1, 0.25])).toBeCloseTo(0.25);
  });

  it('falls back to a sixteenth when no active durations are given', () => {
    expect(gridStep([])).toBe(0.25);
  });
});

describe('snapBeat', () => {
  it('snaps to the nearest grid step and clamps to [0, maxBeat]', () => {
    expect(snapBeat(0.4, 4, 0.5)).toBeCloseTo(0.5);
    expect(snapBeat(-1, 4, 0.5)).toBe(0);
    expect(snapBeat(10, 4, 0.5)).toBe(4);
  });
});

describe('noteOverlaps', () => {
  it('detects overlap with any existing note in the measure', () => {
    const measure = [{ beat: 0, duration: 1, isRest: false }];
    expect(noteOverlaps(measure, 0.5, 1)).toBe(true);
    expect(noteOverlaps(measure, 1, 1)).toBe(false);
  });
});

describe('measureWidth', () => {
  it('divides the staff span evenly across measures', () => {
    expect(measureWidth(4)).toBeCloseTo((960 - 128) / 4);
  });
});

describe('beatFromClickX / noteX', () => {
  it('round-trips approximately: noteX(beatFromClickX(x)) is close to x', () => {
    const numMeasures = 2;
    const measureTotalBeats = 4;
    const gridStepVal = 0.5;
    const mw = measureWidth(numMeasures);
    const targetX = mw / 2; // click near the middle of measure 0
    const beat = beatFromClickX(targetX, 0, 1, numMeasures, measureTotalBeats, gridStepVal);
    expect(beat).toBeGreaterThanOrEqual(0);
    expect(beat).toBeLessThanOrEqual(measureTotalBeats);
    const x = noteX(0, beat, numMeasures, measureTotalBeats);
    expect(Math.abs(x - targetX)).toBeLessThan(mw / 2);
  });

  it('clamps the resulting beat so the note still fits before the bar end', () => {
    const beat = beatFromClickX(10000, 0, 4, 1, 4, 1); // click far past the bar, whole note
    expect(beat).toBe(0); // maxBeat = measureTotalBeats - duration = 0
  });
});
