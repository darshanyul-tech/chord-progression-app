import { Accidental, Beam, Dot, Formatter, GhostNote, Renderer, Stave, StaveNote, Voice, type StemmableNote } from 'vexflow';
import { vexDurationFor } from '../rhythm-staff/vexDuration';
import type { TimeSigInfo } from '../rhythm/time';
import { midiToVexKey, spellMidi } from './spelling';
import { NATURAL_LETTERS, staffLineFor, type Clef, type KeyDef, type PitchedMeasure, type PitchedNote } from './theory';

// Pure builder (docs/04-notation-engine.md §B4) — VexFlow is display-only;
// grading/storage/playback never read these objects. Renders a fresh scene
// from the model every call, same imperative-island convention as the
// rhythm staff (Part A) and the exam-mode reveal-as-second-voice pattern.

export interface MelodyStaffModel {
  key: KeyDef;
  clef: Clef;
  timeSig: TimeSigInfo;
  numMeasures: number;
  measures: PitchedMeasure[];
  hasSubmitted: boolean;
  isCorrect: boolean;
  /** Present only when hasSubmitted && !isCorrect — the correct melody, reveal-styled. */
  revealMeasures: PitchedMeasure[] | null;
  /** Measure index to flash red for a moment (invalid placement), or null. */
  flashMeasure: number | null;
  /** 0..1 playback cursor position across the whole melody, or null when not playing. */
  playbackFraction: number | null;
  /** Measure the keyboard insertion cursor is in (usually the active measure). */
  cursorMeasureIndex: number;
  /** Beat position of the keyboard insertion cursor within cursorMeasureIndex, or null when the staff doesn't have keyboard focus (04-accessibility §14.1). */
  cursorBeat: number | null;
  /** Pitch the keyboard cursor would place at Enter, or null while armed for a rest. */
  cursorMidi: number | null;
  /** Ghost preview of where a mouse placement would land, or null when not hovering (docs/12 MD-4). */
  hover: HoverPreview | null;
}

export interface HoverPreview {
  measureIndex: number;
  /** Already resolved (snapped to the nearest valid slot / direct hit) — see lib/melody/placement.ts. */
  beat: number;
  midi: number | null;
  isRest: boolean;
}

/** Everything the input overlay needs to hit-test clicks, without holding onto VexFlow objects. */
export interface MeasureGeometry {
  index: number;
  noteStartX: number;
  noteEndX: number;
  topLineY: number;
  spacing: number;
}

const CANVAS_WIDTH = 1000;
const ROW_HEIGHT = 150;
const MARGIN_LEFT = 10;
const MARGIN_RIGHT = 10;
const STAVE_Y_TOP = 40;
const MAX_MEASURES_PER_ROW = 2;
const REST_KEY = 'b/4';

export const WRONG_COLOR = '#b3261e';
export const CURSOR_COLOR = '#005f6b';
/** Keyboard insertion-cursor highlight (distinct from the teal playback cursor). */
export const KEYBOARD_CURSOR_COLOR = '#8a2be2';
/** Mouse-hover placement ghost (docs/12 MD-4) — same hue as the keyboard cursor's teal accent, translucent. */
export const HOVER_COLOR = 'rgba(0, 95, 107, 0.4)';

// Only durations that decompose cleanly (§ decomposeGap) appear here; the
// palette only ever offers these seven values plus their multiples/sums, so
// every gap this app can produce is representable without a remainder.
const CANONICAL_GAP_DURATIONS = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.25];

/**
 * Greedily splits a beat-gap into standard note-value chunks (largest first),
 * used to pad measures with invisible GhostNotes so the Formatter spaces
 * *placed* notes proportionally to their real beat position instead of
 * packing them sequentially with no regard for empty beats (docs/12 RC-3) —
 * the mismatch that let a bar accept fewer notes than its capacity.
 */
export function decomposeGap(gapBeats: number): number[] {
  const out: number[] = [];
  let rem = gapBeats;
  let guard = 0;
  while (rem > 0.001 && guard++ < 64) {
    const fit = CANONICAL_GAP_DURATIONS.find((d) => d <= rem + 0.001);
    if (!fit) break;
    out.push(fit);
    rem -= fit;
  }
  return out;
}

function buildGhostNote(durationBeats: number): GhostNote {
  const { duration, dots } = vexDurationFor(durationBeats);
  return new GhostNote({ duration, dots });
}

function buildStaveNote(note: PitchedNote, key: KeyDef, clef: Clef): StaveNote {
  const { duration, dots } = vexDurationFor(note.duration);
  const staveNote = note.rest
    ? new StaveNote({ keys: [REST_KEY], duration: `${duration}r`, dots, clef })
    : new StaveNote({ keys: [midiToVexKey(note.midi!, key)], duration, dots, clef, autoStem: true });
  if (dots > 0) Dot.buildAndAttach([staveNote], { all: true });
  return staveNote;
}

/**
 * Groups time-adjacent, sub-beat, non-rest notes into beamable runs. `sorted`
 * must already be beat-ascending. A run needs 2+ notes with no gap or rest
 * between them — VexFlow only draws flags on lone notes and on notes broken
 * apart by a rest or a silent gap; beaming across either looks wrong and
 * used to happen because beams were generated after the notes had already
 * drawn their own flags/stems (docs/12 RC-2).
 */
export function beamableRuns(sorted: PitchedNote[]): PitchedNote[][] {
  const runs: PitchedNote[][] = [];
  let current: PitchedNote[] = [];
  let cursor: number | null = null;
  for (const n of sorted) {
    const beamable = !n.rest && n.duration < 1 - 0.001;
    const adjacent = beamable && cursor !== null && Math.abs(n.beat - cursor) < 0.001;
    if (beamable && adjacent) {
      current.push(n);
    } else {
      if (current.length > 1) runs.push(current);
      current = beamable ? [n] : [];
    }
    cursor = beamable ? n.beat + n.duration : null;
  }
  if (current.length > 1) runs.push(current);
  return runs;
}

function drawMeasureVoice(
  context: ReturnType<Renderer['getContext']>,
  stave: Stave,
  notes: PitchedMeasure,
  timeSig: TimeSigInfo,
  key: KeyDef,
  clef: Clef,
  style?: { fillStyle: string; strokeStyle: string },
): void {
  if (!notes.length) return;
  const measureTotalBeats = timeSig.measureBeats;
  const sorted = notes.slice().sort((a, b) => a.beat - b.beat);

  // Build the full-bar tickable list: real notes plus invisible GhostNotes
  // filling every gap (before the first note, between notes, and up to the
  // bar end) so the Formatter spaces everything proportionally to beat
  // position (docs/12 RC-3) instead of packing placed notes with no regard
  // for the empty space around them.
  const tickables: StemmableNote[] = [];
  const noteToStave = new Map<PitchedNote, StaveNote>();
  let cursor = 0;
  sorted.forEach((n) => {
    const gap = n.beat - cursor;
    if (gap > 0.001) decomposeGap(gap).forEach((d) => tickables.push(buildGhostNote(d)));
    const staveNote = buildStaveNote(n, key, clef);
    if (style) staveNote.setStyle(style);
    tickables.push(staveNote);
    noteToStave.set(n, staveNote);
    cursor = n.beat + n.duration;
  });
  const tailGap = measureTotalBeats - cursor;
  if (tailGap > 0.001) decomposeGap(tailGap).forEach((d) => tickables.push(buildGhostNote(d)));

  const voice = new Voice({ numBeats: measureTotalBeats, beatValue: 4 });
  voice.setMode(Voice.Mode.SOFT);
  voice.addTickables(tickables);
  Accidental.applyAccidentals([voice], key.vexKeySpec);
  new Formatter().joinVoices([voice]).format([voice], Math.max(20, stave.getNoteEndX() - stave.getNoteStartX() - 20));

  // Beams must be generated — and their notes' stems prepared — *before*
  // draw(), per VexFlow's own documented order; generating them afterward is
  // what caused the doubled flags / stems that don't reach the beam (RC-2).
  const beamGroups = Beam.getDefaultBeamGroups(`${timeSig.beatsPerBar}/${timeSig.beatValue}`);
  const beams = beamableRuns(sorted).flatMap((run) => {
    const runStaveNotes = run.map((n) => noteToStave.get(n)!);
    return Beam.generateBeams(runStaveNotes, { groups: beamGroups });
  });
  if (style) beams.forEach((b) => b.setStyle(style));

  voice.draw(context, stave);
  beams.forEach((b) => b.setContext(context).draw());
}

export function buildVexScore(container: HTMLDivElement, model: MelodyStaffModel): MeasureGeometry[] {
  container.innerHTML = '';
  const {
    key,
    clef,
    timeSig,
    numMeasures,
    measures,
    hasSubmitted,
    isCorrect,
    revealMeasures,
    flashMeasure,
    playbackFraction,
    cursorMeasureIndex,
    cursorBeat,
    cursorMidi,
    hover,
  } = model;
  const measureTotalBeats = timeSig.measureBeats;
  const numRows = Math.max(1, Math.ceil(numMeasures / MAX_MEASURES_PER_ROW));
  const canvasHeight = numRows * ROW_HEIGHT + 20;

  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(CANVAS_WIDTH, canvasHeight);
  const context = renderer.getContext();

  const geometry: MeasureGeometry[] = [];
  for (let row = 0; row < numRows; row++) {
    const measuresInRow = Math.min(MAX_MEASURES_PER_ROW, numMeasures - row * MAX_MEASURES_PER_ROW);
    if (measuresInRow <= 0) continue;
    const staveWidth = (CANVAS_WIDTH - MARGIN_LEFT - MARGIN_RIGHT) / measuresInRow;
    const rowY = STAVE_Y_TOP + row * ROW_HEIGHT;

    for (let col = 0; col < measuresInRow; col++) {
      const mi = row * MAX_MEASURES_PER_ROW + col;
      const x = MARGIN_LEFT + col * staveWidth;
      const stave = new Stave(x, rowY, staveWidth);
      if (col === 0) {
        stave.addClef(clef);
        stave.addKeySignature(key.vexKeySpec);
        if (mi === 0) stave.addTimeSignature(`${timeSig.beatsPerBar}/${timeSig.beatValue}`);
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

      const userNotes = measures[mi] ?? [];
      if (hasSubmitted && !isCorrect && revealMeasures) {
        drawMeasureVoice(context, stave, userNotes, timeSig, key, clef);
        drawMeasureVoice(context, stave, revealMeasures[mi] ?? [], timeSig, key, clef, {
          fillStyle: WRONG_COLOR,
          strokeStyle: WRONG_COLOR,
        });
      } else {
        drawMeasureVoice(context, stave, userNotes, timeSig, key, clef);
      }

      geometry.push({
        index: mi,
        noteStartX: stave.getNoteStartX(),
        noteEndX: stave.getNoteEndX(),
        topLineY: stave.getYForLine(0),
        spacing: stave.getSpacingBetweenLines(),
      });
    }
  }

  if (cursorBeat !== null) {
    const geo = geometry.find((g) => g.index === cursorMeasureIndex);
    if (geo) {
      const rel = Math.max(0, Math.min(1, cursorBeat / measureTotalBeats));
      const cx = geo.noteStartX + rel * (geo.noteEndX - geo.noteStartX);
      // Invert the same getYForNote(kpLine) === getYForLine(5 - kpLine)
      // relationship VexStaffHost's click hit-testing uses, so the cursor
      // marker lands on the exact line the placed note would occupy.
      let cy = geo.topLineY + 2 * geo.spacing;
      if (cursorMidi !== null) {
        const spelled = spellMidi(cursorMidi, key);
        const letterIndex = NATURAL_LETTERS.indexOf(spelled.letter);
        const kpLine = staffLineFor(letterIndex, spelled.octave, clef);
        cy = geo.topLineY + (5 - kpLine) * geo.spacing;
      }
      context.save();
      context.setFillStyle(KEYBOARD_CURSOR_COLOR);
      context.beginPath();
      context.moveTo(cx - 5, cy - 16);
      context.lineTo(cx + 5, cy - 16);
      context.lineTo(cx, cy - 8);
      context.closePath();
      context.fill();
      context.restore();
    }
  }

  if (hover !== null && !hasSubmitted) {
    const geo = geometry.find((g) => g.index === hover.measureIndex);
    if (geo) {
      const rel = Math.max(0, Math.min(1, hover.beat / measureTotalBeats));
      const cx = geo.noteStartX + rel * (geo.noteEndX - geo.noteStartX);
      let cy = geo.topLineY + 2 * geo.spacing;
      if (!hover.isRest && hover.midi !== null) {
        const spelled = spellMidi(hover.midi, key);
        const letterIndex = NATURAL_LETTERS.indexOf(spelled.letter);
        const kpLine = staffLineFor(letterIndex, spelled.octave, clef);
        cy = geo.topLineY + (5 - kpLine) * geo.spacing;
      }
      // Hand-drawn ghost (notehead + short stem) via the raw context rather
      // than a second VexFlow voice — a real tickable would perturb the
      // Formatter's spacing of the actual placed notes (docs/12 MD-4).
      context.save();
      context.setFillStyle(HOVER_COLOR);
      context.setStrokeStyle(HOVER_COLOR);
      context.setLineWidth(1.5);
      context.beginPath();
      context.arc(cx, cy, 4.5, 0, Math.PI * 2, false);
      context.fill();
      context.beginPath();
      context.moveTo(cx + 4.5, cy);
      context.lineTo(cx + 4.5, cy - 24);
      context.stroke();
      context.restore();
    }
  }

  if (playbackFraction !== null && numMeasures > 0) {
    const globalBeat = playbackFraction * numMeasures * measureTotalBeats;
    const mi = Math.min(numMeasures - 1, Math.floor(globalBeat / measureTotalBeats));
    const beatInMeasure = globalBeat - mi * measureTotalBeats;
    const geo = geometry.find((g) => g.index === mi);
    if (geo) {
      const rel = beatInMeasure / measureTotalBeats;
      const cx = geo.noteStartX + rel * (geo.noteEndX - geo.noteStartX);
      context.save();
      context.setStrokeStyle(CURSOR_COLOR);
      context.setLineWidth(1.5);
      context.beginPath();
      context.moveTo(cx, geo.topLineY - 10);
      context.lineTo(cx, geo.topLineY + geo.spacing * 4 + 10);
      context.stroke();
      context.restore();
    }
  }

  const svg = container.querySelector('svg');
  if (svg) {
    svg.setAttribute('viewBox', `0 0 ${CANVAS_WIDTH} ${canvasHeight}`);
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    // Same VexFlow inline-style gotcha as the rhythm staff (Phase 4) — clear
    // the inline width/height Renderer.resize() sets so CSS responsive
    // sizing (width:100%; height:auto) actually applies.
    svg.style.removeProperty('width');
    svg.style.removeProperty('height');
  }

  return geometry;
}
