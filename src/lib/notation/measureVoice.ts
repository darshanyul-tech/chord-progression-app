import { Formatter, Voice, type Renderer, type Stave, type StaveNote } from 'vexflow';
import { generateBeamedRuns } from './beaming';
import { buildGapPaddedTickables, type TickableAdapter } from './tickables';

export interface MeasureVoiceAdapter<T> extends TickableAdapter<T> {
  isRest(n: T): boolean;
}

export interface DrawMeasureVoiceOptions<T> {
  style?: { fillStyle: string; strokeStyle: string };
  /** Ghost preview of where a mouse placement would land, or null/omitted when not hovering (docs/12 MD-4). */
  hoverNote?: T | null;
  hoverColor: string;
  /** Runs once the tickables are in the voice, before formatting — melodic dictation hooks in Accidental.applyAccidentals() here. */
  beforeFormat?: (voice: Voice) => void;
}

/**
 * The shared rendering core for any staff/beat-notation topic: sorts the
 * measure (folding in a hover-preview ghost that replaces whatever it would
 * overlap, exactly like a committed placement would — docs/12 MD-4), pads
 * every gap with invisible spacer notes so real notes sit proportionally to
 * their actual beat position (RC-3), formats and draws the Voice, then beams
 * whatever's beamable at the meter's own main-beat boundaries. Both Melodic
 * Dictation (VexStaffHost/vexscore.ts) and Rhythm Dictation
 * (RhythmStaffHost/render.ts) call this per-measure — a future staff-based
 * topic only needs to supply a `MeasureVoiceAdapter` for its own note shape
 * (how to build a StaveNote from it) and doesn't need to re-derive any of
 * gap-padding, hover-ghost substitution, or beat-boundary-aware beaming.
 * Returns the built note→StaveNote mapping (real notes plus the hover ghost,
 * if any) so a caller can draw ties across this call's own measure boundary
 * afterward (lib/notation/ties.ts) — this function only draws one measure at
 * a time and has no notion of "the previous measure's note" itself.
 */
export function drawMeasureVoice<T extends { beat: number; duration: number }>(
  context: ReturnType<Renderer['getContext']>,
  stave: Stave,
  notes: readonly T[],
  measureTotalBeats: number,
  beatsPerBar: number,
  beatValue: number,
  adapter: MeasureVoiceAdapter<T>,
  options: DrawMeasureVoiceOptions<T>,
): Map<T, StaveNote> {
  const { style, hoverNote = null, hoverColor, beforeFormat } = options;

  // A hover ghost is rendered as a real tickable in this same voice, not a
  // hand-drawn overlay — that's what makes its position and glyph exact
  // (flags, dots, rest shape, full note size) instead of an approximated
  // marker sitting wherever a raw beat-proportional formula lands, which is
  // *not* where the Formatter actually places a real note. It replaces
  // whatever it would overlap if committed, mirroring placeNoteAt's own
  // direct-hit-clears-neighbours behaviour, so the preview always matches
  // what clicking would actually do.
  let effectiveNotes: readonly T[] = notes;
  let ghostRef: T | null = null;
  if (hoverNote) {
    const hoverBeat = adapter.beat(hoverNote);
    const hoverEnd = hoverBeat + adapter.duration(hoverNote);
    const overlaps = (n: T) => hoverBeat < adapter.beat(n) + adapter.duration(n) - 0.001 && hoverEnd > adapter.beat(n) + 0.001;
    effectiveNotes = [...notes.filter((n) => !overlaps(n)), hoverNote];
    ghostRef = hoverNote;
  }
  if (!effectiveNotes.length) return new Map();
  const sorted = [...effectiveNotes].sort((a, b) => adapter.beat(a) - adapter.beat(b));

  const { tickables, noteToStave } = buildGapPaddedTickables(sorted, measureTotalBeats, adapter, ghostRef, style, hoverColor);

  const voice = new Voice({ numBeats: measureTotalBeats, beatValue: 4 });
  voice.setMode(Voice.Mode.SOFT);
  voice.addTickables(tickables);
  beforeFormat?.(voice);
  new Formatter().joinVoices([voice]).format([voice], Math.max(20, stave.getNoteEndX() - stave.getNoteStartX() - 20));

  // Beams must be generated — and their notes' stems prepared — *before*
  // draw(), per VexFlow's own documented order; generating them afterward
  // causes doubled flags / stems that don't reach the beam (docs/12 RC-2).
  const beams = generateBeamedRuns(sorted, noteToStave, adapter.isRest, beatsPerBar, beatValue, ghostRef, style, hoverColor);

  voice.draw(context, stave);
  beams.forEach((b) => b.setContext(context).draw());
  return noteToStave;
}
