import { Barline, Dot, Renderer, Stave, StaveNote } from 'vexflow';
import { PREVIEW_COLOR, VICTIM_COLOR } from '../notation/colors';
import type { MeasureGeometry } from '../notation/geometry';
import { drawMeasureVoice, type MeasureVoiceAdapter } from '../notation/measureVoice';
import { drawTies } from '../notation/ties';
import { computeSystemLayout } from '../notation/systemLayout';
import { durationClose, type Measure, type RhythmNote } from '../rhythm/time';
import { vexDurationFor } from './vexDuration';

// Rhythm staff rendering via VexFlow (replaces the legacy hand-drawn SVG
// glyphs — professional engraving instead of hand-built ellipse/line paths).
// Model-parameterized imperative render: renderStaff(container, model)
// rebuilds the whole scene from scratch each call (04-notation-engine.md
// Part A's imperative-island pattern; Part B4's reveal-as-second-voice
// convention reused here for consistency). Per-measure rendering itself is
// the shared lib/notation framework (see lib/notation/index.ts) — this file
// only supplies the RhythmNote adapter and the parts genuinely specific to
// rhythm dictation (fixed-pitch percussion noteheads, no clef/key/pitch).

export interface RhythmHoverPreview {
  measureIndex: number;
  /** Already resolved (snapped to the nearest valid slot / direct hit) — see lib/notation/placement.ts. */
  beat: number;
  duration: number;
  isRest: boolean;
  /** Tie armed — the ghost itself previews as a tied note, its curve leading right to the next note (or a pending partial tie). */
  tied?: boolean;
}

export interface RhythmStaffModel {
  beatsPerBar: number;
  beatValue: number;
  numMeasures: number;
  measures: Measure[];
  hasSubmitted: boolean;
  measureResults: boolean[];
  correctPattern: Measure[];
  flashMeasure: number | null;
  /** 0..1 playback cursor position across the whole staff, or null when not playing. */
  playbackFraction: number | null;
  /** Measure the keyboard insertion cursor is in (usually the active measure). */
  cursorMeasureIndex: number;
  /** Beat position of the keyboard insertion cursor within cursorMeasureIndex, or null when the staff doesn't have keyboard focus (04-accessibility §14.1). */
  cursorBeat: number | null;
  /** Ghost preview of where a mouse placement would land, or null when not hovering — mirrors Melodic Dictation's MelodyStaffModel.hover (docs/12 MD-4). */
  hover: RhythmHoverPreview | null;
}

const MARGIN_LEFT = 10;
const MARGIN_RIGHT = 10;
const STAVE_Y = 40;
/** Vertical span reserved per stacked staff row (stave + stems + badges). */
const ROW_HEIGHT = 130;
/** Each measure keeps at least this rendered width before wrapping to a new row. */
const MIN_MEASURE_PX = 290;
const REST_KEY = 'b/4';

export const WRONG_COLOR = '#b3261e';
export const OK_COLOR = '#000000';
export const CURSOR_COLOR = '#005f6b';
/** User's own (wrong) notes in a reveal, greyed so the red correct pattern reads as the answer, not a competing voice at the same y. */
export const MUTED_COLOR = '#8a8a8a';
/** Keyboard insertion-cursor highlight (distinct from the teal playback cursor). */
export const KEYBOARD_CURSOR_COLOR = '#8a2be2';
/** Mouse-hover placement ghost — shared preview colour, see lib/notation/colors.ts. */
export const HOVER_COLOR = PREVIEW_COLOR;
/** Ghost outline of a real note a hover would displace — see lib/notation/colors.ts. */
export { VICTIM_COLOR };

// Rhythm dictation is single-pitch (percussion-style) — every note sits on
// the same line, unlike melodic dictation's real MIDI-to-staff-line spelling.
const rhythmAdapter: MeasureVoiceAdapter<RhythmNote> = {
  beat: (n) => n.beat,
  duration: (n) => n.duration,
  isRest: (n) => n.isRest,
  makeRest: (beat, duration) => ({ beat, duration, isRest: true }),
  buildNote: (n) => {
    const { duration, dots } = vexDurationFor(n.duration);
    const staveNote = new StaveNote({
      keys: [REST_KEY],
      duration: n.isRest ? `${duration}r` : duration,
      autoStem: !n.isRest,
    });
    if (dots > 0) Dot.buildAndAttach([staveNote], { all: true });
    return staveNote;
  },
};

const TRIPLET_EIGHTH_DUR = 0.333;
const TRIPLET_QUARTER_DUR = 0.667;

function isTripletDuration(d: number): boolean {
  return durationClose(d, TRIPLET_EIGHTH_DUR) || durationClose(d, TRIPLET_QUARTER_DUR);
}

/**
 * Groups consecutive, contiguous triplet-duration notes (0.333/0.667) that
 * together complete exactly one beat into one Tuplet bracket per beat — e.g.
 * three triplet eighths, or a triplet quarter + triplet eighth in either
 * order (docs/15-theory-topics/09 §3's cells 2-4). Notes are matched by
 * identity against `notes` (must already be beat-ascending), so this is safe
 * to run on any RhythmNote sequence, not just Meter Transposition's own
 * generated content — it also retroactively brackets any triplet a user
 * freely draws in Rhythm Dictation.
 */
export function detectTupletGroups(notes: readonly RhythmNote[]): RhythmNote[][] {
  const groups: RhythmNote[][] = [];
  let i = 0;
  while (i < notes.length) {
    const n = notes[i]!;
    if (n.isRest || !isTripletDuration(n.duration)) {
      i++;
      continue;
    }
    const run: RhythmNote[] = [n];
    let sum = n.duration;
    let j = i + 1;
    while (sum < 0.99 && j < notes.length) {
      const next = notes[j]!;
      const prev = run[run.length - 1]!;
      const contiguous = durationClose(next.beat, prev.beat + prev.duration);
      if (!contiguous || next.isRest || !isTripletDuration(next.duration)) break;
      run.push(next);
      sum += next.duration;
      j++;
    }
    if (durationClose(sum, 1)) {
      groups.push(run);
      i = j;
    } else {
      // Not a clean beat-completing run (shouldn't happen with valid v1
      // cells, but a freehand Rhythm Dictation bar could produce an odd
      // leftover) — skip past this note rather than bracket a partial group.
      i++;
    }
  }
  return groups;
}

export function renderStaff(container: HTMLDivElement, model: RhythmStaffModel): MeasureGeometry[] {
  container.innerHTML = '';
  const {
    beatsPerBar,
    beatValue,
    numMeasures,
    measures,
    hasSubmitted,
    measureResults,
    correctPattern,
    flashMeasure,
    playbackFraction,
    cursorMeasureIndex,
    cursorBeat,
    hover,
  } = model;
  const measureTotalBeats = beatsPerBar * (4 / beatValue);

  // Wrap measures onto stacked rows so each keeps a readable width instead of
  // shrinking to fit them all on one line (see systemLayout.ts). fallbackPerRow
  // = numMeasures preserves the legacy single-row layout when the container
  // width is unknown (jsdom render tests).
  const { measuresPerRow, numRows, canvasWidth } = computeSystemLayout(numMeasures, container.clientWidth, {
    minMeasurePx: MIN_MEASURE_PX,
    marginLeft: MARGIN_LEFT,
    marginRight: MARGIN_RIGHT,
    fallbackPerRow: numMeasures,
    fallbackCanvasWidth: 1000,
  });
  const canvasHeight = numRows * ROW_HEIGHT + 20;

  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(canvasWidth, canvasHeight);
  const context = renderer.getContext();

  const staveWidth = (canvasWidth - MARGIN_LEFT - MARGIN_RIGHT) / measuresPerRow;
  const staves: Stave[] = [];
  const geometry: MeasureGeometry[] = [];
  // Merged across every measure's own drawMeasureVoice call so ties (which
  // can span a barline into the next measure) can look up either side's
  // built StaveNote after the whole staff is drawn — see drawTies below.
  const noteToStave = new Map<RhythmNote, StaveNote>();
  // Populated per-measure below with whatever drawMeasureVoice actually
  // rendered (the plain committed notes, or the hover-preview-folded list
  // when hovering) — drawTies uses this instead of `measures` directly so a
  // tied hover ghost participates in ties exactly like the committed
  // placement would.
  const tieMeasures: RhythmNote[][] = [];

  for (let mi = 0; mi < numMeasures; mi++) {
    const row = Math.floor(mi / measuresPerRow);
    const col = mi % measuresPerRow;
    const x = MARGIN_LEFT + col * staveWidth;
    const staveY = STAVE_Y + row * ROW_HEIGHT;
    // Keep the real 5-line geometry (barline height, getYForLine(0)/(4) used
    // below for the cursor/playback markers, the b/4 notehead position every
    // rhythm note sits on) but only draw the single line that notehead
    // actually sits on — a true rhythmic/percussion staff look, unlike
    // Melodic Dictation's full 5-line pitch staff. A genuine numLines: 1
    // stave gives VexFlow's barlines zero height to span (measure boundaries
    // would be invisible) and shifts the line-index geometry other code here
    // relies on, so line visibility is toggled per-line instead of shrinking
    // the line count itself. Stave's own constructor always overwrites a
    // `lineConfig` passed to it (resetLines() forces every line visible right
    // after assigning options), so this has to be set via setConfigForLines
    // afterward instead of in the constructor options.
    const stave = new Stave(x, staveY, staveWidth);
    stave.setConfigForLines([
      { visible: false },
      { visible: false },
      { visible: true },
      { visible: false },
      { visible: false },
    ]);
    // Clef repeats at the start of every row (system); the time signature only
    // at the very first measure.
    if (col === 0) {
      stave.addClef('percussion');
      if (mi === 0) stave.addTimeSignature(`${beatsPerBar}/${beatValue}`);
    }
    if (mi === numMeasures - 1) {
      stave.setEndBarType(Barline.type.END);
    }
    // Stave.draw() never applies setStyle() to its own line-drawing (only
    // drawWithStyle()'s Element.applyStyle wrapper does, which Stave.draw
    // bypasses) — so tint the raw context around the call instead.
    if (flashMeasure === mi) {
      context.save();
      context.setStrokeStyle(WRONG_COLOR);
      context.setFillStyle(WRONG_COLOR);
      stave.setContext(context).draw();
      context.restore();
    } else {
      stave.setContext(context).draw();
    }
    staves.push(stave);

    const userNotes = measures[mi] ?? [];
    const ok = hasSubmitted ? measureResults[mi] : undefined;
    // Populated below with whatever's actually drawn for this measure, so
    // click hit-testing (lib/notation/placement.ts's xToBeat) can interpolate
    // against real positions instead of assuming the note area is evenly
    // spaced by beat.
    let breakpointNotes: readonly RhythmNote[] = userNotes;
    let breakpointMap: ReadonlyMap<RhythmNote, StaveNote> = new Map();

    if (hasSubmitted && !ok) {
      // Reveal: user's (wrong) answer greyed out + correct pattern in red on
      // top, both on the same stave — greying the user voice keeps it from
      // reading as a second competing answer at the same y (Part B4). Only
      // the user's own voice can carry ties (the generator never produces
      // any), so only its map feeds drawTies below.
      const { noteToStave: userMap } = drawMeasureVoice(context, stave, userNotes, measureTotalBeats, beatsPerBar, beatValue, rhythmAdapter, {
        style: { fillStyle: MUTED_COLOR, strokeStyle: MUTED_COLOR },
        hoverColor: HOVER_COLOR,
        tupletGroups: detectTupletGroups,
      });
      userMap.forEach((v, k) => noteToStave.set(k, v));
      drawMeasureVoice(context, stave, correctPattern[mi] ?? [], measureTotalBeats, beatsPerBar, beatValue, rhythmAdapter, {
        style: { fillStyle: WRONG_COLOR, strokeStyle: WRONG_COLOR },
        hoverColor: HOVER_COLOR,
        tupletGroups: detectTupletGroups,
      });
      tieMeasures.push(userNotes);
      breakpointMap = userMap;
    } else {
      const hoverNote: RhythmNote | null =
        !hasSubmitted && hover && hover.measureIndex === mi
          ? { beat: hover.beat, duration: hover.duration, isRest: hover.isRest, tied: hover.tied && !hover.isRest ? true : undefined }
          : null;
      if (hoverNote) {
        const hb = hoverNote.beat;
        const he = hb + hoverNote.duration;
        // A real note the hover would displace stays visible underneath the
        // preview, dimmed — drawn as its own independent voice pass (same
        // trick the reveal branch above uses for two voices on one stave) so
        // replacing a note doesn't make it vanish before the swap commits.
        // Rests aren't shown this way — there's nothing meaningful to compare.
        const victims = userNotes.filter((n) => !n.isRest && hb < n.beat + n.duration - 0.001 && he > n.beat + 0.001);
        if (victims.length) {
          drawMeasureVoice(context, stave, victims, measureTotalBeats, beatsPerBar, beatValue, rhythmAdapter, {
            style: { fillStyle: VICTIM_COLOR, strokeStyle: VICTIM_COLOR },
            hoverColor: VICTIM_COLOR,
            tupletGroups: detectTupletGroups,
          });
        }
      }
      const { noteToStave: userMap, notes: renderedNotes } = drawMeasureVoice(
        context, stave, userNotes, measureTotalBeats, beatsPerBar, beatValue, rhythmAdapter,
        { hoverNote, hoverColor: HOVER_COLOR, tupletGroups: detectTupletGroups },
      );
      userMap.forEach((v, k) => noteToStave.set(k, v));
      tieMeasures.push(renderedNotes);
      breakpointNotes = renderedNotes;
      breakpointMap = userMap;
    }

    geometry.push({
      index: mi,
      noteStartX: stave.getNoteStartX(),
      noteEndX: stave.getNoteEndX(),
      topLineY: stave.getYForLine(0),
      spacing: stave.getSpacingBetweenLines(),
      breakpoints: breakpointNotes
        .map((n) => {
          const sn = breakpointMap.get(n);
          return sn ? { beat: n.beat, x: sn.getAbsoluteX() } : null;
        })
        .filter((b): b is { beat: number; x: number } => b !== null)
        .sort((a, b) => a.beat - b.beat),
    });

    if (hasSubmitted) {
      const cx = stave.getNoteEndX() - 10;
      const topY = stave.getYForLine(0);
      context.save();
      context.setFillStyle(ok ? OK_COLOR : WRONG_COLOR);
      context.beginPath();
      context.arc(cx, topY - 14, 7, 0, Math.PI * 2, false);
      context.fill();
      context.setFillStyle('#fff');
      context.setFont('Arial', 10, 'bold');
      context.fillText(ok ? '✓' : '✗', cx - 4, topY - 10);
      context.restore();
    }
  }

  // Ties are drawn over what drawMeasureVoice actually rendered for each
  // measure (tieMeasures, built above) — with the hover ghost folded in via
  // applyPlacement exactly like a committed placement would be, a tied ghost
  // previews its own curve leading right (full to the next note, or a
  // pending partial tie), and a committed tied note previews its curve
  // completing into the ghost that follows it.
  drawTies(context, tieMeasures, noteToStave, {
    beat: (n) => n.beat,
    duration: (n) => n.duration,
    isRest: (n) => n.isRest,
    isTied: (n) => !!n.tied,
  });

  if (cursorBeat !== null && staves[cursorMeasureIndex]) {
    const stave = staves[cursorMeasureIndex]!;
    const rel = Math.max(0, Math.min(1, cursorBeat / measureTotalBeats));
    const cx = stave.getNoteStartX() + rel * (stave.getNoteEndX() - stave.getNoteStartX());
    const topY = stave.getYForLine(0);
    context.save();
    context.setFillStyle(KEYBOARD_CURSOR_COLOR);
    context.beginPath();
    context.moveTo(cx - 5, topY - 12);
    context.lineTo(cx + 5, topY - 12);
    context.lineTo(cx, topY - 4);
    context.closePath();
    context.fill();
    context.restore();
  }

  // Playback cursor: locate which measure (and therefore which row) the
  // fraction lands in, then position within that stave — the same row-aware
  // approach as melodic dictation, so it works across stacked rows.
  if (playbackFraction !== null && numMeasures > 0) {
    const globalBeat = playbackFraction * numMeasures * measureTotalBeats;
    const mi = Math.min(numMeasures - 1, Math.floor(globalBeat / measureTotalBeats));
    const beatInMeasure = globalBeat - mi * measureTotalBeats;
    const stave = staves[mi];
    if (stave) {
      const rel = beatInMeasure / measureTotalBeats;
      const cx = stave.getNoteStartX() + rel * (stave.getNoteEndX() - stave.getNoteStartX());
      const topY = stave.getYForLine(0);
      const bottomY = stave.getYForLine(4);
      context.save();
      context.setStrokeStyle(CURSOR_COLOR);
      context.setLineWidth(1.5);
      context.beginPath();
      context.moveTo(cx, topY - 10);
      context.lineTo(cx, bottomY + 10);
      context.stroke();
      context.restore();
    }
  }

  const svg = container.querySelector('svg');
  if (svg) {
    svg.setAttribute('viewBox', `0 0 ${canvasWidth} ${canvasHeight}`);
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    // VexFlow's Renderer.resize() sets inline width/height styles, which
    // beat any external stylesheet rule regardless of specificity — clear
    // them so the CSS responsive sizing (width:100%; height:auto) applies.
    svg.style.removeProperty('width');
    svg.style.removeProperty('height');
  }

  return geometry;
}
