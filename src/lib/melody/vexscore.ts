import { Accidental, Dot, Renderer, Stave, StaveNote, type Voice } from 'vexflow';
import { drawMeasureVoice, type MeasureVoiceAdapter } from '../notation/measureVoice';
import { drawTies } from '../notation/ties';
import type { MeasureGeometry } from '../notation/geometry';
import { vexDurationFor } from '../rhythm-staff/vexDuration';
import type { TimeSigInfo } from '../rhythm/time';
import { midiToVexKey, spellMidi, spelledToVexKey } from './spelling';
import { NATURAL_LETTERS, staffLineFor, type Clef, type KeyDef, type NoteSpelling, type PitchedMeasure, type PitchedNote } from './theory';

// Pure builder (docs/04-notation-engine.md §B4) — VexFlow is display-only;
// grading/storage/playback never read these objects. Renders a fresh scene
// from the model every call, same imperative-island convention as the
// rhythm staff (Part A) and the exam-mode reveal-as-second-voice pattern.
// Per-measure rendering itself is the shared lib/notation framework (see
// lib/notation/index.ts) — this file only supplies the PitchedNote adapter
// and the parts genuinely specific to melodic dictation (pitch/clef/key,
// accidentals, multi-row layout, the pitch-aware keyboard cursor).

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
  /** Already resolved (snapped to the nearest valid slot / direct hit) — see lib/notation/placement.ts. */
  beat: number;
  duration: number;
  midi: number | null;
  isRest: boolean;
  /** Mirrors the armed accidental so the ghost previews the same spelling the click would actually commit. */
  spelling?: NoteSpelling;
  /** Tie armed — the ghost itself previews as a tied note, its curve leading right to the next note (or a pending partial tie). */
  tied?: boolean;
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

function melodyAdapter(key: KeyDef, clef: Clef): MeasureVoiceAdapter<PitchedNote> {
  return {
    beat: (n) => n.beat,
    duration: (n) => n.duration,
    isRest: (n) => n.rest,
    buildNote: (n) => {
      const { duration, dots } = vexDurationFor(n.duration);
      const staveNote = n.rest
        ? new StaveNote({ keys: [REST_KEY], duration: `${duration}r`, dots, clef })
        : new StaveNote({
            keys: [n.spelling ? spelledToVexKey(n.spelling) : midiToVexKey(n.midi!, key)],
            duration,
            dots,
            clef,
            autoStem: true,
          });
      if (dots > 0) Dot.buildAndAttach([staveNote], { all: true });
      return staveNote;
    },
  };
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
  const adapter = melodyAdapter(key, clef);
  const numRows = Math.max(1, Math.ceil(numMeasures / MAX_MEASURES_PER_ROW));
  const canvasHeight = numRows * ROW_HEIGHT + 20;

  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(CANVAS_WIDTH, canvasHeight);
  const context = renderer.getContext();

  const geometry: MeasureGeometry[] = [];
  // Merged across every measure's own drawMeasureVoice call so ties (which
  // can span a barline into the next measure) can look up either side's
  // built StaveNote after the whole staff is drawn — see drawTies below.
  const noteToStave = new Map<PitchedNote, StaveNote>();
  // Captured when the hover ghost is built below, so the tie-preview pass
  // after the loop can look it up in noteToStave by reference.
  let hoverNoteRef: PitchedNote | null = null;
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
      const beforeFormat = (voice: Voice) => Accidental.applyAccidentals([voice], key.vexKeySpec);
      if (hasSubmitted && !isCorrect && revealMeasures) {
        // Only the user's own voice can carry ties (the generator never
        // produces any), so only its map feeds drawTies below.
        const userMap = drawMeasureVoice(context, stave, userNotes, measureTotalBeats, timeSig.beatsPerBar, timeSig.beatValue, adapter, {
          hoverColor: HOVER_COLOR,
          beforeFormat,
        });
        userMap.forEach((v, k) => noteToStave.set(k, v));
        drawMeasureVoice(
          context,
          stave,
          revealMeasures[mi] ?? [],
          measureTotalBeats,
          timeSig.beatsPerBar,
          timeSig.beatValue,
          adapter,
          {
            style: { fillStyle: WRONG_COLOR, strokeStyle: WRONG_COLOR },
            hoverColor: HOVER_COLOR,
            beforeFormat,
          },
        );
      } else {
        const hoverNote: PitchedNote | null =
          !hasSubmitted && hover && hover.measureIndex === mi
            ? {
                beat: hover.beat,
                duration: hover.duration,
                rest: hover.isRest,
                midi: hover.midi,
                spelling: hover.spelling,
                tied: hover.tied && !hover.isRest ? true : undefined,
              }
            : null;
        if (hoverNote) hoverNoteRef = hoverNote;
        const userMap = drawMeasureVoice(context, stave, userNotes, measureTotalBeats, timeSig.beatsPerBar, timeSig.beatValue, adapter, {
          hoverNote,
          hoverColor: HOVER_COLOR,
          beforeFormat,
        });
        userMap.forEach((v, k) => noteToStave.set(k, v));
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
    isRest: (n) => n.rest,
    isTied: (n) => !!n.tied,
  });

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
