import { describe, expect, it } from 'vitest';
import {
  decomposeGap,
  durationClose,
  durationFitsBar,
  durationTicks,
  gcdInt,
  gridStep,
  maxNotesOfDuration,
  measuresEqual,
  metricPulseBeats,
  metricPulseCount,
  noteOverlaps,
  parseTimeSig,
  snapBeat,
  sortNotes,
  tieSplitMeasure,
  type RhythmNote,
  type TieSplitAdapter,
} from './time';

const rhythmTieAdapter: TieSplitAdapter<RhythmNote> = {
  beat: (n) => n.beat,
  duration: (n) => n.duration,
  isRest: (n) => n.isRest,
  withSpan: (n, beat, duration, tied) => ({ ...n, beat, duration, tied: tied ? true : undefined }),
};

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

// docs/12-melodic-dictation-fixes.md MD-3: gap-decomposition feeds the
// GhostNote padding both staff renderers use to make placed-note x-position
// proportional to beat.
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

  it('sums exactly for a triplet-grid gap', () => {
    const chunks = decomposeGap(0.667);
    expect(chunks.reduce((s, d) => s + d, 0)).toBeCloseTo(0.667, 3);
  });
});

// Rhythmic-notation convention: a note that straddles the exact centre of
// the bar must never cross it unsplit — e.g. a crotchet starting on the
// "and" of beat 2 in 4/4 (centre = beat 2, i.e. where beat 3 begins)
// obscures the bar's middle, and must instead be written as tied pieces
// either side of it. Only the bar's own centre is protected, not every
// beat — a note is free to cross any *other* boundary unsplit.
describe('tieSplitMeasure', () => {
  it('leaves a note alone when it starts on the centre, even though it then crosses other beats', () => {
    const measure: RhythmNote[] = [{ beat: 2, duration: 2, isRest: false }]; // half note starting exactly on the 4/4 centre
    expect(tieSplitMeasure(measure, 2, rhythmTieAdapter)).toEqual(measure);
  });

  it('leaves a note alone when it stays entirely before the centre', () => {
    const measure: RhythmNote[] = [{ beat: 0.5, duration: 1, isRest: false }]; // crotchet on the "and" of beat 1, ends at 1.5 — never reaches the centre (2)
    expect(tieSplitMeasure(measure, 2, rhythmTieAdapter)).toEqual(measure);
  });

  it('leaves a note alone when it crosses a non-centre beat boundary (only the centre is protected)', () => {
    const measure: RhythmNote[] = [{ beat: 0.5, duration: 1, isRest: false }]; // crosses beat 1 (0.5→1.5), not the centre at 2
    expect(tieSplitMeasure(measure, 2, rhythmTieAdapter)).toEqual(measure);
  });

  it('splits a crotchet starting on the "and" of beat 2 into two tied quavers either side of the centre', () => {
    const measure: RhythmNote[] = [{ beat: 1.5, duration: 1, isRest: false }];
    const out = tieSplitMeasure(measure, 2, rhythmTieAdapter);
    expect(out).toEqual([
      { beat: 1.5, duration: 0.5, isRest: false, tied: true },
      { beat: 2, duration: 0.5, isRest: false, tied: undefined },
    ]);
  });

  it('splits a dotted-crotchet straddling the centre into a tied quaver + crotchet', () => {
    const measure: RhythmNote[] = [{ beat: 1.5, duration: 1.5, isRest: false }]; // spans 1.5→3, crossing the centre at 2
    const out = tieSplitMeasure(measure, 2, rhythmTieAdapter);
    expect(out).toEqual([
      { beat: 1.5, duration: 0.5, isRest: false, tied: true },
      { beat: 2, duration: 1, isRest: false, tied: undefined },
    ]);
  });

  it('splits into exactly two pieces even for a note spanning several beats either side of the centre', () => {
    const measure: RhythmNote[] = [{ beat: 0.5, duration: 3, isRest: false }]; // spans 0.5→3.5, crossing the centre at 2 once
    const out = tieSplitMeasure(measure, 2, rhythmTieAdapter);
    expect(out).toHaveLength(2);
    expect(out.reduce((s, n) => s + n.duration, 0)).toBeCloseTo(3, 6);
    expect(out[0]).toEqual({ beat: 0.5, duration: 1.5, isRest: false, tied: true });
    expect(out[1]).toEqual({ beat: 2, duration: 1.5, isRest: false, tied: undefined });
  });

  it('never splits rests', () => {
    const measure: RhythmNote[] = [{ beat: 1.5, duration: 1, isRest: true }];
    expect(tieSplitMeasure(measure, 2, rhythmTieAdapter)).toEqual(measure);
  });

  it('respects a compound-meter dotted-crotchet centre (6/8, where the centre coincides with the single main pulse)', () => {
    // A crotchet+quaver starting on the "and" of the first dotted-crotchet
    // pulse (beat 0.5) spans [0.5, 2), crossing the bar's centre at 1.5.
    const measure: RhythmNote[] = [{ beat: 0.5, duration: 1.5, isRest: false }];
    const out = tieSplitMeasure(measure, 1.5, rhythmTieAdapter);
    expect(out).toEqual([
      { beat: 0.5, duration: 1, isRest: false, tied: true },
      { beat: 1.5, duration: 0.5, isRest: false, tied: undefined },
    ]);
  });

  it('is a no-op for a measure that never crosses the centre (leaves note count unchanged)', () => {
    const measure: RhythmNote[] = [
      { beat: 0, duration: 1, isRest: false },
      { beat: 1, duration: 1, isRest: false },
      { beat: 2, duration: 2, isRest: false },
    ];
    expect(tieSplitMeasure(measure, 2, rhythmTieAdapter)).toEqual(measure);
  });

  it('preserves other fields on split pieces (e.g. a pitch-bearing note type)', () => {
    interface PitchedLike {
      beat: number;
      duration: number;
      rest: boolean;
      midi: number;
    }
    const adapter: TieSplitAdapter<PitchedLike> = {
      beat: (n) => n.beat,
      duration: (n) => n.duration,
      isRest: (n) => n.rest,
      withSpan: (n, beat, duration) => ({ ...n, beat, duration }),
    };
    const measure: PitchedLike[] = [{ beat: 2.5, duration: 1, rest: false, midi: 67 }]; // spans 2.5→3.5, crossing a centre at 3
    const out = tieSplitMeasure(measure, 3, adapter);
    expect(out).toHaveLength(2);
    out.forEach((n) => expect(n.midi).toBe(67));
  });
});
