import { Barline, Dot, Renderer, Stave, StaveNote } from 'vexflow';
import type { MeasureGeometry } from '../notation/geometry';
import { drawMeasureVoice, type MeasureVoiceAdapter } from '../notation/measureVoice';
import { drawTies } from '../notation/ties';
import type { Measure, RhythmNote } from '../rhythm/time';
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

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 200;
const MARGIN_LEFT = 10;
const MARGIN_RIGHT = 10;
const STAVE_Y = 40;
const REST_KEY = 'b/4';

export const WRONG_COLOR = '#b3261e';
export const OK_COLOR = '#000000';
export const CURSOR_COLOR = '#005f6b';
/** User's own (wrong) notes in a reveal, greyed so the red correct pattern reads as the answer, not a competing voice at the same y. */
export const MUTED_COLOR = '#8a8a8a';
/** Keyboard insertion-cursor highlight (distinct from the teal playback cursor). */
export const KEYBOARD_CURSOR_COLOR = '#8a2be2';
/** Mouse-hover placement ghost — same color as Melodic Dictation's HOVER_COLOR (lib/melody/vexscore.ts), translucent teal. */
export const HOVER_COLOR = 'rgba(0, 95, 107, 0.4)';

// Rhythm dictation is single-pitch (percussion-style) — every note sits on
// the same line, unlike melodic dictation's real MIDI-to-staff-line spelling.
const rhythmAdapter: MeasureVoiceAdapter<RhythmNote> = {
  beat: (n) => n.beat,
  duration: (n) => n.duration,
  isRest: (n) => n.isRest,
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

  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(CANVAS_WIDTH, CANVAS_HEIGHT);
  const context = renderer.getContext();

  const staveWidth = (CANVAS_WIDTH - MARGIN_LEFT - MARGIN_RIGHT) / numMeasures;
  const staves: Stave[] = [];
  const geometry: MeasureGeometry[] = [];
  // Merged across every measure's own drawMeasureVoice call so ties (which
  // can span a barline into the next measure) can look up either side's
  // built StaveNote after the whole staff is drawn — see drawTies below.
  const noteToStave = new Map<RhythmNote, StaveNote>();
  // Captured when the hover ghost is built below, so the tie-preview pass
  // after the loop can look it up in noteToStave by reference.
  let hoverNoteRef: RhythmNote | null = null;

  for (let mi = 0; mi < numMeasures; mi++) {
    const x = MARGIN_LEFT + mi * staveWidth;
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
    const stave = new Stave(x, STAVE_Y, staveWidth);
    stave.setConfigForLines([
      { visible: false },
      { visible: false },
      { visible: true },
      { visible: false },
      { visible: false },
    ]);
    if (mi === 0) {
      stave.addClef('percussion');
      stave.addTimeSignature(`${beatsPerBar}/${beatValue}`);
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
    geometry.push({
      index: mi,
      noteStartX: stave.getNoteStartX(),
      noteEndX: stave.getNoteEndX(),
      topLineY: stave.getYForLine(0),
      spacing: stave.getSpacingBetweenLines(),
    });

    const userNotes = measures[mi] ?? [];
    const ok = hasSubmitted ? measureResults[mi] : undefined;

    if (hasSubmitted && !ok) {
      // Reveal: user's (wrong) answer greyed out + correct pattern in red on
      // top, both on the same stave — greying the user voice keeps it from
      // reading as a second competing answer at the same y (Part B4). Only
      // the user's own voice can carry ties (the generator never produces
      // any), so only its map feeds drawTies below.
      const userMap = drawMeasureVoice(context, stave, userNotes, measureTotalBeats, beatsPerBar, beatValue, rhythmAdapter, {
        style: { fillStyle: MUTED_COLOR, strokeStyle: MUTED_COLOR },
        hoverColor: HOVER_COLOR,
      });
      userMap.forEach((v, k) => noteToStave.set(k, v));
      drawMeasureVoice(context, stave, correctPattern[mi] ?? [], measureTotalBeats, beatsPerBar, beatValue, rhythmAdapter, {
        style: { fillStyle: WRONG_COLOR, strokeStyle: WRONG_COLOR },
        hoverColor: HOVER_COLOR,
      });
    } else {
      const hoverNote: RhythmNote | null =
        !hasSubmitted && hover && hover.measureIndex === mi
          ? { beat: hover.beat, duration: hover.duration, isRest: hover.isRest, tied: hover.tied && !hover.isRest ? true : undefined }
          : null;
      if (hoverNote) hoverNoteRef = hoverNote;
      const userMap = drawMeasureVoice(context, stave, userNotes, measureTotalBeats, beatsPerBar, beatValue, rhythmAdapter, {
        hoverNote,
        hoverColor: HOVER_COLOR,
      });
      userMap.forEach((v, k) => noteToStave.set(k, v));
    }

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

  // Ties are drawn over the measures *with the hover ghost folded in* (the
  // same replaces-what-it-overlaps substitution drawMeasureVoice applies) so
  // the ghost participates in ties exactly like the committed placement
  // would: a tied ghost previews its own curve leading right (full to the
  // next note, or a pending partial tie), and a committed tied note previews
  // its curve completing into the ghost that follows it.
  const tieMeasures = hoverNoteRef
    ? measures.map((m, mi) => {
        if (mi !== hover!.measureIndex) return m;
        const hb = hover!.beat;
        const he = hb + hover!.duration;
        return [...m.filter((n) => !(hb < n.beat + n.duration - 0.001 && he > n.beat + 0.001)), hoverNoteRef!];
      })
    : measures;
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

  if (playbackFraction !== null && staves[0]) {
    const topY = staves[0]!.getYForLine(0);
    const bottomY = staves[0]!.getYForLine(4);
    const cx = MARGIN_LEFT + playbackFraction * (CANVAS_WIDTH - MARGIN_LEFT - MARGIN_RIGHT);
    context.save();
    context.setStrokeStyle(CURSOR_COLOR);
    context.setLineWidth(1.5);
    context.beginPath();
    context.moveTo(cx, topY - 10);
    context.lineTo(cx, bottomY + 10);
    context.stroke();
    context.restore();
  }

  const svg = container.querySelector('svg');
  if (svg) {
    svg.setAttribute('viewBox', `0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`);
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
