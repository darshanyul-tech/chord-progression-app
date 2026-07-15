import type { IntervalDirectionMode, IntervalEnabledEntry } from '../recognition/intervals';
import { INTERVAL_TYPES } from '../recognition/intervals';
import type { RootRangePreset } from './question';

// Persisted settings shape for Interval Singing (docs/09-improvement-plan.md
// §16.1). enabledIntervals/direction mirror Interval Recognition's shape
// exactly (same INTERVAL_TYPES pool, same matrix UI) but this is its own
// settings slice — singing has no exam type and several fields recognition
// doesn't (tolerance, octave equivalence, hold time, root range).

export type ToleranceLevel = 'strict' | 'default' | 'relaxed';

export const TOLERANCE_CENTS: Record<ToleranceLevel, number> = {
  strict: 30,
  default: 50,
  relaxed: 75,
};

export interface IntervalSingingSettings extends Record<string, unknown> {
  direction: IntervalDirectionMode;
  enabledIntervals: Record<string, IntervalEnabledEntry>;
  rootRange: RootRangePreset;
  tolerance: ToleranceLevel;
  octaveEquivalence: boolean;
  holdTimeSec: number;
  autoAdvance: boolean;
}

export function defaultIntervalSingingSettings(): IntervalSingingSettings {
  const enabledIntervals: Record<string, IntervalEnabledEntry> = {};
  INTERVAL_TYPES.forEach((t) => {
    const on = t.semitones <= 7;
    enabledIntervals[t.id] = { asc: on, desc: on };
  });
  return {
    direction: 'both',
    enabledIntervals,
    rootRange: 'auto',
    tolerance: 'default',
    octaveEquivalence: true,
    holdTimeSec: 0.5,
    autoAdvance: false,
  };
}
