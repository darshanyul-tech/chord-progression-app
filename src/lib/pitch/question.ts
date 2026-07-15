import { pick, random } from '../theory';
import { INTERVAL_TYPES, type IntervalDirectionMode, type IntervalEnabledEntry, type IntervalPoolEntry } from '../recognition/intervals';

// Question-building for Interval Singing (docs/09-improvement-plan.md §16.1) —
// reuses INTERVAL_TYPES from lib/recognition/intervals.ts (same interval
// pool/matrix as Interval Recognition) rather than duplicating the table,
// but singing needs its own root-note selection (constrained to a
// comfortable vocal range) that recognition never needed.

/** Filters INTERVAL_TYPES by which asc/desc cells are enabled and the practice direction, same semantics as recognition's buildIntervalPracticePool. */
export function buildSingingPool(
  direction: IntervalDirectionMode,
  enabledIntervals: Record<string, IntervalEnabledEntry>,
): IntervalPoolEntry[] {
  const enabled: IntervalPoolEntry[] = [];
  INTERVAL_TYPES.forEach((def) => {
    const entry = enabledIntervals[def.id];
    if (!entry) return;
    if (entry.asc) enabled.push({ id: def.id, label: def.label, semitones: def.semitones, direction: 'asc' });
    if (entry.desc) enabled.push({ id: def.id, label: def.label, semitones: def.semitones, direction: 'desc' });
  });
  if (direction === 'asc') return enabled.filter((e) => e.direction === 'asc');
  if (direction === 'desc') return enabled.filter((e) => e.direction === 'desc');
  return enabled;
}

export interface RootRangeWindow {
  lowMidi: number;
  highMidi: number;
}

export type RootRangePreset = 'male' | 'female' | 'auto';

/** Comfortable-singing MIDI windows (§16.1) — auto is the union, a safe default before the user picks their own. */
export const ROOT_RANGE_PRESETS: Record<RootRangePreset, RootRangeWindow> = {
  male: { lowMidi: 48, highMidi: 62 }, // C3-D4
  female: { lowMidi: 55, highMidi: 69 }, // G3-A4
  auto: { lowMidi: 48, highMidi: 69 },
};

export interface SingingQuestion {
  rootMidi: number;
  intervalId: string;
  intervalLabel: string;
  /** Signed: positive = target above the root, negative = below — direction is just this number's sign. */
  targetSemitones: number;
}

/**
 * Picks a random enabled interval + a root note such that both the root and
 * the resulting target note fit inside `rootRange`. Falls back to anchoring
 * at the range's low end if the interval is wide enough that no root in the
 * window keeps both ends inside it (e.g. a 9th in a narrow custom range).
 */
export function buildSingingQuestion(pool: IntervalPoolEntry[], rootRange: RootRangeWindow): SingingQuestion | null {
  if (!pool.length) return null;
  const entry = pick(pool);
  const targetSemitones = entry.direction === 'asc' ? entry.semitones : -entry.semitones;

  const minRoot = rootRange.lowMidi - Math.min(0, targetSemitones);
  const maxRoot = rootRange.highMidi - Math.max(0, targetSemitones);
  const rootMidi =
    maxRoot >= minRoot ? minRoot + Math.floor(random() * (maxRoot - minRoot + 1)) : rootRange.lowMidi;

  return { rootMidi, intervalId: entry.id, intervalLabel: entry.label, targetSemitones };
}
