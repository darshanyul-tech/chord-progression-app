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

export interface AppliedPlacement<T> {
  /** The full resulting measure — `newNote` plus whatever survived it, gap-filled with rests. */
  notes: T[];
  /**
   * Every entry in `notes` that's new as a result of this placement —
   * `newNote` itself, plus any rest fillGaps had to insert to cover a span
   * that isn't `newNote`'s own but is no longer covered by whatever it
   * displaced (e.g. placing a quaver over half of a crotchet rest leaves the
   * other half needing a fresh quaver rest). Everything else in `notes` is
   * the same object (by reference) as it was in `measure` — untouched by
   * this placement. This is what a hover preview colors; a commit ignores it.
   */
  added: T[];
}

/**
 * Applies a single placement to a measure: drops whatever `newNote`'s span
 * overlaps (a rest or a real note alike — both are equally displaceable,
 * lib/notation/placement.ts's resolver never distinguishes them), adds
 * `newNote`, and re-fills any span that's left uncovered with rests, same as
 * a fresh/cleared measure. This is the one place that turns "a note has been
 * placed" into "here is the new state of the bar" — both the commit path
 * (usePractice's placeNoteAt) and the hover preview call it with the same
 * inputs, so the preview can never show a result the click wouldn't actually
 * produce.
 */
export function applyPlacement<T>(
  measure: readonly T[],
  newNote: T,
  measureTotalBeats: number,
  pulseBeats: number,
  adapter: RestAdapter<T>,
): AppliedPlacement<T> {
  const newBeat = adapter.beat(newNote);
  const newEnd = newBeat + adapter.duration(newNote);
  const overlaps = (n: T) => newBeat < adapter.beat(n) + adapter.duration(n) - 0.001 && newEnd > adapter.beat(n) + 0.001;
  const survivors = measure.filter((n) => !overlaps(n));
  const notes = fillGaps([...survivors, newNote], measureTotalBeats, pulseBeats, adapter);
  const added = notes.filter((n) => !survivors.includes(n));
  return { notes, added };
}

// Re-exported so callers only need one import path for the whole gap-filling
// family — decomposeGap/pulseRestSpans stay defined in lib/rhythm/time.ts
// (they're pure beat-duration math, not notation-rendering specific).
export { decomposeGap, pulseRestSpans };
