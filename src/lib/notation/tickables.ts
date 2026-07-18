import { GhostNote, type StaveNote, type StemmableNote } from 'vexflow';
import { decomposeGap } from '../rhythm/time';
import { vexDurationFor } from '../rhythm-staff/vexDuration';

export interface TickableAdapter<T> {
  beat(n: T): number;
  duration(n: T): number;
  buildNote(n: T): StaveNote;
}

/** An invisible spacer note — used to pad gaps so the Formatter spaces real notes proportionally to their actual beat position, not packed sequentially with no regard for empty beats. */
export function buildGhostNote(durationBeats: number): GhostNote {
  const { duration, dots } = vexDurationFor(durationBeats);
  return new GhostNote({ duration, dots });
}

export interface GapPaddedTickables<T> {
  tickables: StemmableNote[];
  noteToStave: Map<T, StaveNote>;
}

/**
 * Builds the full-bar tickable list for a Voice: real notes (styled per
 * `style`, or `hoverColor` for whichever one is `ghostRef` — the mouse-hover
 * placement preview) plus invisible GhostNotes filling every gap — before
 * the first note, between notes, and up to the bar end — so the Formatter
 * spaces everything proportionally to beat position instead of packing
 * placed notes with no regard for the empty space around them (docs/12
 * RC-3). `sorted` must already be beat-ascending.
 */
export function buildGapPaddedTickables<T>(
  sorted: readonly T[],
  measureTotalBeats: number,
  adapter: TickableAdapter<T>,
  ghostRef: T | null,
  style: { fillStyle: string; strokeStyle: string } | undefined,
  hoverColor: string,
): GapPaddedTickables<T> {
  const tickables: StemmableNote[] = [];
  const noteToStave = new Map<T, StaveNote>();
  let cursor = 0;
  sorted.forEach((n) => {
    const gap = adapter.beat(n) - cursor;
    if (gap > 0.001) decomposeGap(gap).forEach((d) => tickables.push(buildGhostNote(d)));
    const staveNote = adapter.buildNote(n);
    if (n === ghostRef) {
      staveNote.setStyle({ fillStyle: hoverColor, strokeStyle: hoverColor });
    } else if (style) {
      staveNote.setStyle(style);
    }
    tickables.push(staveNote);
    noteToStave.set(n, staveNote);
    cursor = adapter.beat(n) + adapter.duration(n);
  });
  const tailGap = measureTotalBeats - cursor;
  if (tailGap > 0.001) decomposeGap(tailGap).forEach((d) => tickables.push(buildGhostNote(d)));
  return { tickables, noteToStave };
}
