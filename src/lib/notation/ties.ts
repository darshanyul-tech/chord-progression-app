import { StaveTie, type Renderer, type StaveNote } from 'vexflow';
import { findFollowingNote } from './placement';

export interface TieAdapter<T> {
  beat(n: T): number;
  duration(n: T): number;
  isRest(n: T): boolean;
  isTied(n: T): boolean;
}

/**
 * Length (in VexFlow px, before any page zoom) of the pending-tie loop drawn
 * from a tied note that has no follower yet — a short stub leading rightward
 * toward where the next note will land, instead of VexFlow's default partial
 * tie that stretches all the way to the barline. Kept small so it reads as
 * "this note ties into the next one" without dominating the empty bar.
 */
const PENDING_TIE_LOOP_PX = 16;

/**
 * Draws a short pending-tie loop from `firstNote`. VexFlow's own partial tie
 * (firstNote with no lastNote) ends at `stave.getTieEndX()` — the barline — so
 * we override `getLastX` to end a fixed short distance past the note instead.
 */
function drawPendingTieLoop(
  context: ReturnType<Renderer['getContext']>,
  firstNote: StaveNote,
): void {
  const tie = new StaveTie({ firstNote });
  const startX = firstNote.getTieRightX();
  // draw() reads getLastX() for the curve's end point; pin it just past the note.
  tie.getLastX = () => startX + PENDING_TIE_LOOP_PX;
  tie.setContext(context).draw();
}

/**
 * True when two tied notes sit on different staff rows (their staves start at
 * different y). Ties within a row — including across a barline — draw fine; only
 * a tie that jumps to the next row needs splitting into two partial ties.
 */
export function tieSpansSystemBreak(firstNote: StaveNote, lastNote: StaveNote): boolean {
  const firstStave = firstNote.getStave();
  const lastStave = lastNote.getStave();
  if (!firstStave || !lastStave) return false;
  return firstStave.getYForLine(0) !== lastStave.getYForLine(0);
}

/**
 * Draws a VexFlow tie curve from every tied note to the note in front of it
 * (lib/notation/placement.ts's `findFollowingNote`: same measure's next
 * note, or the next measure's first note for a tie across the barline).
 * When nothing valid follows yet — only rests, or nothing at all — a short
 * pending-tie loop is drawn instead (see `drawPendingTieLoop`): a small stub
 * leading rightward toward where the next note will land, so a freshly placed
 * tied note shows its pending tie immediately rather than the tie only
 * appearing once the next note exists — and without stretching to the barline.
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
        if (tieSpansSystemBreak(firstNote, lastNote)) {
          // The two notes are on different rows. A single tie would slash
          // diagonally across the page, so split it at the system break: a
          // fragment from this note out to the barline ending its row, and a
          // matching fragment from the start of the next row in to the
          // following note — the barline acts as a "portal" to the next line.
          new StaveTie({ firstNote }).setContext(context).draw();
          new StaveTie({ lastNote }).setContext(context).draw();
        } else {
          new StaveTie({ firstNote, lastNote }).setContext(context).draw();
        }
      } else {
        drawPendingTieLoop(context, firstNote);
      }
    });
  });
}
