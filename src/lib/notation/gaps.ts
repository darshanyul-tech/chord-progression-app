import { decomposeGap, pulseRestSpans } from '../rhythm/time';

/**
 * The minimal per-topic plug-in `fillGaps`/`defaultRestMeasure` need: how to
 * read a beat/rest position out of the topic's own note shape, and how to
 * build a rest in that same shape. RhythmNote (`isRest`) and PitchedNote
 * (`rest`+`midi`) both satisfy this with a two-line object literal — see
 * rhythm-dictation/usePractice.ts and melodic-dictation/usePractice.ts.
 */
export interface RestAdapter<T> {
  beat(n: T): number;
  duration(n: T): number;
  isRest(n: T): boolean;
  makeRest(beat: number, duration: number): T;
}

/**
 * A bar should never have unaccounted-for space. Given a (possibly sparse,
 * possibly unsorted) measure, returns a beat-ascending measure where every
 * gap — before the first note, between notes, after the last note, or a
 * whole empty measure — is filled with rests at the meter's natural pulse
 * (quarter rests in simple meters, dotted-quarter/eighth in compound ones).
 *
 * Both dictation topics run every mutation that can leave a hole — a fresh/
 * cleared/undone measure, or a direct-hit replace whose new (possibly
 * smaller) duration only partially covers whatever it cleared, e.g. an
 * eighth note replacing one beat of a quarter rest and leaving the other
 * half uncovered — through this before committing it to state.
 */
export function fillGaps<T>(measure: readonly T[], measureTotalBeats: number, pulseBeats: number, adapter: RestAdapter<T>): T[] {
  const sorted = [...measure].sort((a, b) => adapter.beat(a) - adapter.beat(b));
  const out: T[] = [];
  let cursor = 0;
  sorted.forEach((n) => {
    const gap = adapter.beat(n) - cursor;
    if (gap > 0.001) {
      pulseRestSpans(cursor, gap, pulseBeats).forEach((s) => out.push(adapter.makeRest(s.beat, s.duration)));
    }
    out.push(n);
    cursor = adapter.beat(n) + adapter.duration(n);
  });
  const tail = measureTotalBeats - cursor;
  if (tail > 0.001) {
    pulseRestSpans(cursor, tail, pulseBeats).forEach((s) => out.push(adapter.makeRest(s.beat, s.duration)));
  }
  return out;
}

/** A fresh measure, fully covered by rests at the meter's pulse — e.g. four crotchet rests for 4/4. */
export function defaultRestMeasure<T>(measureTotalBeats: number, pulseBeats: number, adapter: RestAdapter<T>): T[] {
  return fillGaps([], measureTotalBeats, pulseBeats, adapter);
}

// Re-exported so callers only need one import path for the whole gap-filling
// family — decomposeGap/pulseRestSpans stay defined in lib/rhythm/time.ts
// (they're pure beat-duration math, not notation-rendering specific).
export { decomposeGap, pulseRestSpans };
