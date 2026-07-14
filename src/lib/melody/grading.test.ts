import { describe, expect, it } from 'vitest';
import { firstDifferingMeasure, pitchedMeasuresEqual } from './grading';
import type { PitchedMeasure } from './theory';

function note(beat: number, duration: number, midi: number | null, rest = false): PitchedMeasure[number] {
  return { beat, duration, rest, midi };
}

describe('pitchedMeasuresEqual', () => {
  it('matches identical melodies', () => {
    const a: PitchedMeasure[] = [[note(0, 1, 60), note(1, 1, 62)]];
    const b: PitchedMeasure[] = [[note(0, 1, 60), note(1, 1, 62)]];
    expect(pitchedMeasuresEqual(a, b)).toBe(true);
  });

  it('does not match a transposed melody (same rhythm, different pitches)', () => {
    const a: PitchedMeasure[] = [[note(0, 1, 60), note(1, 1, 62)]];
    const b: PitchedMeasure[] = [[note(0, 1, 62), note(1, 1, 64)]];
    expect(pitchedMeasuresEqual(a, b)).toBe(false);
  });

  it('accepts enharmonic spellings implicitly (model has no spelling — same MIDI always matches)', () => {
    // c#/4 and db/4 are the same midi (61) in our model — nothing to compare here beyond midi equality.
    const a: PitchedMeasure[] = [[note(0, 1, 61)]];
    const b: PitchedMeasure[] = [[note(0, 1, 61)]];
    expect(pitchedMeasuresEqual(a, b)).toBe(true);
  });

  it('does not match on a single duration difference alone', () => {
    const a: PitchedMeasure[] = [[note(0, 1, 60), note(1, 1, 62)]];
    const b: PitchedMeasure[] = [[note(0, 1, 60), note(1, 0.5, 62)]];
    expect(pitchedMeasuresEqual(a, b)).toBe(false);
  });

  it('order-independent within a measure (sorts by beat first)', () => {
    const a: PitchedMeasure[] = [[note(1, 1, 62), note(0, 1, 60)]];
    const b: PitchedMeasure[] = [[note(0, 1, 60), note(1, 1, 62)]];
    expect(pitchedMeasuresEqual(a, b)).toBe(true);
  });

  it('rest flag mismatches even with identical timing fail to match', () => {
    const a: PitchedMeasure[] = [[note(0, 1, null, true)]];
    const b: PitchedMeasure[] = [[note(0, 1, 60, false)]];
    expect(pitchedMeasuresEqual(a, b)).toBe(false);
  });
});

describe('firstDifferingMeasure', () => {
  it('returns null when every measure matches', () => {
    const a: PitchedMeasure[] = [[note(0, 1, 60)], [note(0, 1, 62)]];
    const b: PitchedMeasure[] = [[note(0, 1, 60)], [note(0, 1, 62)]];
    expect(firstDifferingMeasure(a, b)).toBeNull();
  });

  it('returns the index of the first differing measure', () => {
    const a: PitchedMeasure[] = [[note(0, 1, 60)], [note(0, 1, 99)]];
    const b: PitchedMeasure[] = [[note(0, 1, 60)], [note(0, 1, 62)]];
    expect(firstDifferingMeasure(a, b)).toBe(1);
  });
});
