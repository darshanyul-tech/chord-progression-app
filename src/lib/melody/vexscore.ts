import { Accidental, Beam, Dot, Formatter, Renderer, Stave, StaveNote, Voice } from 'vexflow';
import { vexDurationFor } from '../rhythm-staff/vexDuration';
import type { TimeSigInfo } from '../rhythm/time';
import { midiToVexKey } from './spelling';
import type { Clef, KeyDef, PitchedMeasure, PitchedNote } from './theory';

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

function buildStaveNote(note: PitchedNote, key: KeyDef, clef: Clef): StaveNote {
  const { duration, dots } = vexDurationFor(note.duration);
  const staveNote = note.rest
    ? new StaveNote({ keys: [REST_KEY], duration: `${duration}r`, clef })
    : new StaveNote({ keys: [midiToVexKey(note.midi!, key)], duration, clef, autoStem: true });
  if (dots > 0) Dot.buildAndAttach([staveNote], { all: true });
  return staveNote;
}

function drawMeasureVoice(
  context: ReturnType<Renderer['getContext']>,
  stave: Stave,
  notes: PitchedMeasure,
  measureTotalBeats: number,
  key: KeyDef,
  clef: Clef,
  style?: { fillStyle: string; strokeStyle: string },
): void {
  if (!notes.length) return;
  const sorted = notes.slice().sort((a, b) => a.beat - b.beat);
  const staveNotes = sorted.map((n) => buildStaveNote(n, key, clef));
  if (style) staveNotes.forEach((n) => n.setStyle(style));
  const voice = new Voice({ numBeats: measureTotalBeats, beatValue: 4 });
  voice.setMode(Voice.Mode.SOFT);
  voice.addTickables(staveNotes);
  Accidental.applyAccidentals([voice], key.vexKeySpec);
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

export function buildVexScore(container: HTMLDivElement, model: MelodyStaffModel): MeasureGeometry[] {
  container.innerHTML = '';
  const { key, clef, timeSig, numMeasures, measures, hasSubmitted, isCorrect, revealMeasures } = model;
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
      stave.setContext(context).draw();

      const userNotes = measures[mi] ?? [];
      if (hasSubmitted && !isCorrect && revealMeasures) {
        drawMeasureVoice(context, stave, userNotes, measureTotalBeats, key, clef);
        drawMeasureVoice(context, stave, revealMeasures[mi] ?? [], measureTotalBeats, key, clef, {
          fillStyle: WRONG_COLOR,
          strokeStyle: WRONG_COLOR,
        });
      } else {
        drawMeasureVoice(context, stave, userNotes, measureTotalBeats, key, clef);
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
