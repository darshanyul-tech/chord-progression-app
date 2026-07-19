import { StaveTie, type Renderer, type StaveNote } from 'vexflow';
import { findFollowingNote } from './placement';

export interface TieAdapter<T> {
  beat(n: T): number;
  duration(n: T): number;
  isRest(n: T): boolean;
  isTied(n: T): boolean;
}

/**
 * Draws a VexFlow tie curve from every tied note to the note in front of it
 * (lib/notation/placement.ts's `findFollowingNote`: same measure's next
 * note, or the next measure's first note for a tie across the barline).
 * When nothing valid follows yet — only rests, or nothing at all — a
 * *partial* tie is drawn instead (VexFlow's firstNote-only form, a curve
 * opening rightward), so a freshly placed tied note shows its pending tie
 * immediately rather than the tie only appearing once the next note exists.
 *
 * Call once per staff, after every measure has already been drawn via
 * `drawMeasureVoice` — a tie can span the boundary `drawMeasureVoice`'s own
 * per-measure call has no visibility into, so this needs the whole staff's
 * note→StaveNote mapping (merge each call's own return value) plus the
 * per-measure note arrays to know which note comes after which. Callers may
 * fold the hover ghost into `measures` before calling (the same overlap
 * substitution drawMeasureVoice applies) so a preview participates in ties
 * exactly like the committed placement would.
 */
export function drawTies<T extends { beat: number; duration: number }>(
  context: ReturnType<Renderer['getContext']>,
  measures: readonly (readonly T[])[],
  noteToStave: ReadonlyMap<T, StaveNote>,
  adapter: TieAdapter<T>,
): void {
  measures.forEach((measure, measureIndex) => {
    measure.forEach((note) => {
      if (adapter.isRest(note) || !adapter.isTied(note)) return;
      const firstNote = noteToStave.get(note);
      if (!firstNote) return;
      const next = findFollowingNote(measures, measureIndex, adapter.beat(note), adapter.duration(note));
      const lastNote = next && !adapter.isRest(next.note) ? noteToStave.get(next.note) : undefined;
      if (lastNote) {
        new StaveTie({ firstNote, lastNote }).setContext(context).draw();
      } else {
        new StaveTie({ firstNote }).setContext(context).draw();
      }
    });
  });
}
