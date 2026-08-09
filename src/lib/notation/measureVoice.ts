import { Formatter, Tuplet, Voice, type Renderer, type Stave, type StaveNote } from 'vexflow';
import { generateBeamedRuns } from './beaming';
import { applyPlacement, type RestAdapter } from './gaps';
import { buildGapPaddedTickables, type TickableAdapter } from './tickables';
import { metricPulseBeats } from '../rhythm/time';

export interface MeasureVoiceAdapter<T> extends TickableAdapter<T>, RestAdapter<T> {}

export interface DrawMeasureVoiceOptions<T> {
  style?: { fillStyle: string; strokeStyle: string };
  /**
   * Ghost preview of where a mouse placement would land, or null/omitted
   * when not hovering (docs/12 MD-4). This is the *raw* candidate note
   * (armed duration/pitch at its resolved beat) — drawMeasureVoice runs it
   * through applyPlacement itself (gaps.ts) so the preview always shows the
   * *whole* resulting bar, not just the note under the cursor: placing a
   * quaver over half of a rest previews the quaver's own rest neighbour too,
   * not silence where fillGaps would put one.
   */
  hoverNote?: T | null;
  hoverColor: string;
  /** Runs once the tickables are in the voice, before formatting — melodic dictation hooks in Accidental.applyAccidentals() here. */
  beforeFormat?: (voice: Voice) => void;
  /**
   * Groups of real notes (identity-matched against `notes`) that should be
   * bracketed as a tuplet — every group in this app is a straight 3-in-the-
   * time-of-2 triplet (the only ratio lib/rhythm ever produces), so that
   * ratio is hardcoded here rather than threaded through as an option.
   * Constructed *before* the Voice/Formatter run (VexFlow's Tuplet applies a
   * tick-multiplier to its notes on construction, which the Formatter must
   * see to space them proportionally — docs/15-theory-topics/09's prereq
   * display fix) and drawn after voice.draw(), same ordering as beams below.
   */
  tupletGroups?: (sorted: readonly T[]) => T[][];
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
 * Returns the built note→StaveNote mapping (real notes plus whatever the
 * hover preview added) *and* the effective note list actually drawn, so a
 * caller can draw ties across this call's own measure boundary afterward
 * (lib/notation/ties.ts, using the same preview-folded list this function
 * rendered) — this function only draws one measure at a time and has no
 * notion of "the previous measure's note" itself.
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
): { noteToStave: Map<T, StaveNote>; notes: T[] } {
  const { style, hoverNote = null, hoverColor, beforeFormat, tupletGroups } = options;

  // A hover ghost is rendered as real tickables in this same voice, not a
  // hand-drawn overlay — that's what makes its position and glyph exact
  // (flags, dots, rest shape, full note size) instead of an approximated
  // marker sitting wherever a raw beat-proportional formula lands, which is
  // *not* where the Formatter actually places a real note. applyPlacement
  // (gaps.ts) is the same function the commit path runs, so the preview
  // always shows the *whole* resulting bar — the placed note, whatever it
  // displaced removed, and any rest needed to cover what's left uncovered —
  // never just the one note under the cursor.
  let effectiveNotes: readonly T[] = notes;
  let ghostRefs: ReadonlySet<T> = new Set();
  if (hoverNote) {
    const pulseBeats = metricPulseBeats(beatValue, beatsPerBar);
    const { notes: preview, added } = applyPlacement(notes, hoverNote, measureTotalBeats, pulseBeats, adapter);
    effectiveNotes = preview;
    ghostRefs = new Set(added);
  }
  if (!effectiveNotes.length) return { noteToStave: new Map(), notes: [] };
  const sorted = [...effectiveNotes].sort((a, b) => adapter.beat(a) - adapter.beat(b));

  const { tickables, noteToStave } = buildGapPaddedTickables(sorted, measureTotalBeats, adapter, ghostRefs, style, hoverColor);

  // Tuplets must be constructed before the Voice/Formatter run below — the
  // constructor is what applies VexFlow's tick-multiplier to each note
  // (numNotes:3, notesOccupied:2 for a straight triplet), and the Formatter
  // reads that multiplier to space the group as 2 beats' worth of room
  // instead of the 3 its raw eighth/quarter durations would otherwise claim.
  const tuplets = tupletGroups
    ? tupletGroups(sorted)
        .filter((group) => group.length > 0)
        .map((group) => new Tuplet(group.map((n) => noteToStave.get(n)!).filter((n): n is StaveNote => !!n), { numNotes: 3, notesOccupied: 2 }))
    : [];

  const voice = new Voice({ numBeats: measureTotalBeats, beatValue: 4 });
  voice.setMode(Voice.Mode.SOFT);
  voice.addTickables(tickables);
  beforeFormat?.(voice);
  new Formatter().joinVoices([voice]).format([voice], Math.max(20, stave.getNoteEndX() - stave.getNoteStartX() - 20));

  // Beams must be generated — and their notes' stems prepared — *before*
  // draw(), per VexFlow's own documented order; generating them afterward
  // causes doubled flags / stems that don't reach the beam (docs/12 RC-2).
  const beams = generateBeamedRuns(sorted, noteToStave, adapter.isRest, beatsPerBar, beatValue, ghostRefs, style, hoverColor);

  voice.draw(context, stave);
  beams.forEach((b) => b.setContext(context).draw());
  // Tuplet brackets read note x-positions (getStemX/getTieLeftX), which only
  // exist once the Formatter/voice.draw() above have positioned the notes —
  // same after-draw ordering as beams.
  tuplets.forEach((t) => t.setContext(context).draw());
  return { noteToStave, notes: sorted };
}
