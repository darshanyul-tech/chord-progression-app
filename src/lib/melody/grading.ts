import { durationClose } from '../rhythm/time';
import type { PitchedMeasure } from './theory';

// Ported grading rule (docs/04-notation-engine.md §B6): tick-exact onsets/
// durations/rests + MIDI-equal pitches — enharmonic spellings are
// automatically accepted since the model never stores spelling, only MIDI.
// Never compares spellings or VexFlow output.

function sortByBeat(measure: PitchedMeasure): PitchedMeasure {
  return measure.slice().sort((a, b) => a.beat - b.beat);
}

export function pitchedMeasureEqual(a: PitchedMeasure, b: PitchedMeasure): boolean {
  const na = sortByBeat(a);
  const nb = sortByBeat(b);
  if (na.length !== nb.length) return false;
  for (let i = 0; i < na.length; i++) {
    const x = na[i]!;
    const y = nb[i]!;
    if (!durationClose(x.beat, y.beat)) return false;
    if (!durationClose(x.duration, y.duration)) return false;
    if (!!x.rest !== !!y.rest) return false;
    if (!x.rest && x.midi !== y.midi) return false;
  }
  return true;
}

export function pitchedMeasuresEqual(a: PitchedMeasure[], b: PitchedMeasure[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((bar, i) => pitchedMeasureEqual(bar, b[i]!));
}

/** Index of the first measure that differs, or null if every measure matches (§6 feedback strip). */
export function firstDifferingMeasure(a: PitchedMeasure[], b: PitchedMeasure[]): number | null {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (!pitchedMeasureEqual(a[i] ?? [], b[i] ?? [])) return i;
  }
  return null;
}
