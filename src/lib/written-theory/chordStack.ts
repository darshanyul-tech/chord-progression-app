// Chord-stack VexFlow builder (docs/14-theory-engine.md §8b) — the one place
// buildVexScore's one-key-per-note shape doesn't fit: a stacked chord is a
// single StaveNote with multiple keys, not one note per beat.
import { Accidental, Formatter, Renderer, Stave, StaveNote, Voice, type RenderContext } from 'vexflow';
import type { Clef } from '../melody/theory';
import type { Accidental as AccidentalStr, SpelledPitch } from './spelledPitch';

export const CHORD_MUTED_COLOR = '#9a9a9a';
export const CHORD_HOVER_COLOR = 'rgba(0, 95, 107, 0.4)';
export const CHORD_WRONG_COLOR = '#b3261e';

function toVexKey(letter: string, acc: AccidentalStr, octave: number): string {
  if (acc === '##' || acc === 'bb') {
    throw new Error(`buildChordStack cannot display a double accidental (${letter}${acc}) — pool filter was bypassed`);
  }
  return `${letter.toLowerCase()}${acc}/${octave}`;
}

export interface ChordColumn {
  /** Bottom-to-top; empty renders a single muted placeholder notehead. */
  stack: SpelledPitch[];
  /** Uniform color override for every tone in this column (the reveal's red correction voice, or undefined for normal/black). */
  color?: string;
  /** Per-tone color override (hover preview) — index-aligned with `stack`, takes precedence over `color`. */
  toneColors?: (string | undefined)[];
}

export interface BuildChordStackResult {
  topLineY: number;
  spacing: number;
  /** Absolute x-center of each rendered column, for hit-testing which column (if more than one) a click landed in. */
  columnX: number[];
}

const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 180;
const MARGIN_LEFT = 10;
const MARGIN_RIGHT = 10;
const STAVE_Y = 40;
const MID_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

export function buildChordStack(
  container: HTMLDivElement,
  opts: { clef: Clef; vexKeySpec?: string; columns: ChordColumn[] },
): BuildChordStackResult {
  container.innerHTML = '';
  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(CANVAS_WIDTH, CANVAS_HEIGHT);
  const context: RenderContext = renderer.getContext();
  const stave = new Stave(MARGIN_LEFT, STAVE_Y, CANVAS_WIDTH - MARGIN_LEFT - MARGIN_RIGHT);
  stave.addClef(opts.clef);
  stave.addKeySignature(opts.vexKeySpec ?? 'C');
  stave.setContext(context).draw();

  const staveNotes: StaveNote[] = opts.columns.map((col) => {
    if (!col.stack.length) {
      const note = new StaveNote({ keys: [toVexKey(MID_LETTERS[0]!, '', 4)], duration: 'w', clef: opts.clef });
      note.setStyle({ fillStyle: CHORD_MUTED_COLOR, strokeStyle: CHORD_MUTED_COLOR });
      return note;
    }
    const sorted = [...col.stack].sort((a, b) => (a.octave - b.octave) * 100 + (MID_LETTERS.indexOf(a.letter) - MID_LETTERS.indexOf(b.letter)));
    const keys = sorted.map((p) => toVexKey(p.letter, p.acc, p.octave));
    const note = new StaveNote({ keys, duration: 'w', clef: opts.clef });
    sorted.forEach((_, i) => {
      const toneColor = col.toneColors?.[i];
      const color = toneColor ?? col.color;
      if (color) note.setKeyStyle(i, { fillStyle: color, strokeStyle: color });
    });
    return note;
  });

  const voice = new Voice({ numBeats: opts.columns.length * 4, beatValue: 4 });
  voice.setMode(Voice.Mode.SOFT);
  voice.addTickables(staveNotes);
  Accidental.applyAccidentals([voice], opts.vexKeySpec ?? 'C');
  new Formatter().joinVoices([voice]).format([voice], Math.max(20, stave.getNoteEndX() - stave.getNoteStartX() - 20));
  voice.draw(context, stave);

  const svg = container.querySelector('svg');
  if (svg) {
    svg.setAttribute('viewBox', `0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`);
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.style.removeProperty('width');
    svg.style.removeProperty('height');
  }

  return {
    topLineY: stave.getYForLine(0),
    spacing: stave.getSpacingBetweenLines(),
    columnX: staveNotes.map((n) => n.getAbsoluteX()),
  };
}
