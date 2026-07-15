import { Beam, Dot, Formatter, Renderer, Stave, StaveNote, Voice } from 'vexflow';
import { sortNotes, type Measure } from '../rhythm/time';
import { vexDurationFor } from './vexDuration';

// Rhythm staff rendering via VexFlow (replaces the legacy hand-drawn SVG
// glyphs — professional engraving instead of hand-built ellipse/line paths).
// Model-parameterized imperative render: renderStaff(container, model)
// rebuilds the whole scene from scratch each call (04-notation-engine.md
// Part A's imperative-island pattern; Part B4's reveal-as-second-voice
// convention reused here for consistency).

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

function buildStaveNotes(notes: Measure): StaveNote[] {
  const sorted = sortNotes(notes);
  return sorted.map((n) => {
    const { duration, dots } = vexDurationFor(n.duration);
    const note = new StaveNote({
      keys: [REST_KEY],
      duration: n.isRest ? `${duration}r` : duration,
      autoStem: !n.isRest,
    });
    if (dots > 0) Dot.buildAndAttach([note], { all: true });
    return note;
  });
}

function drawMeasureVoice(
  context: ReturnType<Renderer['getContext']>,
  stave: Stave,
  notes: Measure,
  measureTotalBeats: number,
  style?: { fillStyle: string; strokeStyle: string },
): void {
  if (!notes.length) return;
  const staveNotes = buildStaveNotes(notes);
  if (style) staveNotes.forEach((n) => n.setStyle(style));
  const voice = new Voice({ numBeats: measureTotalBeats, beatValue: 4 });
  voice.setMode(Voice.Mode.SOFT);
  voice.addTickables(staveNotes);
  new Formatter().joinVoices([voice]).format([voice], Math.max(20, stave.getNoteEndX() - stave.getNoteStartX() - 20));
  voice.draw(context, stave);
  const beamable = staveNotes.filter((n) => !n.isRest());
  if (beamable.length > 1) {
    Beam.generateBeams(beamable).forEach((b) => {
      if (style) b.setStyle(style);
      b.setContext(context).draw();
    });
  }
}

export function renderStaff(container: HTMLDivElement, model: RhythmStaffModel): void {
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
  } = model;
  const measureTotalBeats = beatsPerBar * (4 / beatValue);

  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(CANVAS_WIDTH, CANVAS_HEIGHT);
  const context = renderer.getContext();

  const staveWidth = (CANVAS_WIDTH - MARGIN_LEFT - MARGIN_RIGHT) / numMeasures;
  const staves: Stave[] = [];

  for (let mi = 0; mi < numMeasures; mi++) {
    const x = MARGIN_LEFT + mi * staveWidth;
    const stave = new Stave(x, STAVE_Y, staveWidth, { numLines: 1 });
    if (mi === 0) {
      stave.addTimeSignature(`${beatsPerBar}/${beatValue}`);
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

    if (hasSubmitted && !ok) {
      // Reveal: user's (wrong) answer greyed out + correct pattern in red on
      // top, both on the same stave — greying the user voice keeps it from
      // reading as a second competing answer at the same y (Part B4).
      drawMeasureVoice(context, stave, userNotes, measureTotalBeats, {
        fillStyle: MUTED_COLOR,
        strokeStyle: MUTED_COLOR,
      });
      drawMeasureVoice(context, stave, correctPattern[mi] ?? [], measureTotalBeats, {
        fillStyle: WRONG_COLOR,
        strokeStyle: WRONG_COLOR,
      });
    } else {
      drawMeasureVoice(context, stave, userNotes, measureTotalBeats);
    }

    if (hasSubmitted) {
      const cx = stave.getNoteEndX() - 10;
      context.save();
      context.setFillStyle(ok ? OK_COLOR : WRONG_COLOR);
      context.beginPath();
      context.arc(cx, STAVE_Y - 14, 7, 0, Math.PI * 2, false);
      context.fill();
      context.setFillStyle('#fff');
      context.setFont('Arial', 10, 'bold');
      context.fillText(ok ? '✓' : '✗', cx - 4, STAVE_Y - 10);
      context.restore();
    }
  }

  if (cursorBeat !== null && staves[cursorMeasureIndex]) {
    const stave = staves[cursorMeasureIndex]!;
    const rel = Math.max(0, Math.min(1, cursorBeat / measureTotalBeats));
    const cx = stave.getNoteStartX() + rel * (stave.getNoteEndX() - stave.getNoteStartX());
    context.save();
    context.setFillStyle(KEYBOARD_CURSOR_COLOR);
    context.beginPath();
    context.moveTo(cx - 5, STAVE_Y - 12);
    context.lineTo(cx + 5, STAVE_Y - 12);
    context.lineTo(cx, STAVE_Y - 4);
    context.closePath();
    context.fill();
    context.restore();
  }

  if (playbackFraction !== null) {
    const cx = MARGIN_LEFT + playbackFraction * (CANVAS_WIDTH - MARGIN_LEFT - MARGIN_RIGHT);
    context.save();
    context.setStrokeStyle(CURSOR_COLOR);
    context.setLineWidth(1.5);
    context.beginPath();
    context.moveTo(cx, STAVE_Y - 10);
    context.lineTo(cx, STAVE_Y + 50);
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
}
