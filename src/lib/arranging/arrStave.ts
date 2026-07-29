// Dedicated VexFlow renderer for the ARR-01 click-to-place voicing input.
// Unlike the theory section's buildChordStack (single stave, fixed 500-wide
// canvas), this supports an optional grand staff for low voicings and a tight
// canvas sized to a single chord, and colours each notehead by identity (not by
// post-sort index) so the hover ghost lands on the right note.
import { Accidental, Formatter, Renderer, Stave, StaveConnector, StaveNote, type RenderContext } from 'vexflow';
import { spelledToMidi, type SpelledPitch } from '../written-theory/spelledPitch';

export interface ArrStaveTone {
  pitch: SpelledPitch;
  color?: string;
}

export interface ArrStaveGeom {
  topLineY: number;
  spacing: number;
}

export interface ArrStaveResult {
  treble: ArrStaveGeom;
  bass: ArrStaveGeom | null;
  /** y (canvas units) below which a click routes to the bass stave (grand only). */
  splitY: number | null;
}

const CANVAS_WIDTH = 150;
const TREBLE_Y = 18;
const BASS_Y = 132; // grand-staff gap ≈ middle-C region
const SINGLE_HEIGHT = 150;
const GRAND_HEIGHT = 250;

function toKey(p: SpelledPitch): string {
  return `${p.letter.toLowerCase()}${p.acc}/${p.octave}`;
}

function makeNote(tones: ArrStaveTone[], clef: 'treble' | 'bass'): StaveNote | null {
  if (!tones.length) return null;
  const sorted = [...tones].sort((a, b) => spelledToMidi(a.pitch) - spelledToMidi(b.pitch));
  const note = new StaveNote({ keys: sorted.map((t) => toKey(t.pitch)), duration: 'w', clef });
  sorted.forEach((t, i) => {
    if (t.pitch.acc === '#' || t.pitch.acc === 'b') note.addModifier(new Accidental(t.pitch.acc), i);
    if (t.color) note.setKeyStyle(i, { fillStyle: t.color, strokeStyle: t.color });
  });
  return note;
}

/** Renders the voicing (single treble or grand staff) and returns click geometry. */
export function buildArrStave(container: HTMLDivElement, opts: { grand: boolean; tones: ArrStaveTone[] }): ArrStaveResult {
  container.innerHTML = '';
  const height = opts.grand ? GRAND_HEIGHT : SINGLE_HEIGHT;
  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(CANVAS_WIDTH, height);
  const ctx: RenderContext = renderer.getContext();
  const staveWidth = CANVAS_WIDTH - 10;

  const treble = new Stave(4, TREBLE_Y, staveWidth);
  treble.addClef('treble');
  treble.setContext(ctx).draw();

  let bass: Stave | null = null;
  if (opts.grand) {
    bass = new Stave(4, BASS_Y, staveWidth);
    bass.addClef('bass');
    bass.setContext(ctx).draw();
    new StaveConnector(treble, bass).setType('brace').setContext(ctx).draw();
    new StaveConnector(treble, bass).setType('singleLeft').setContext(ctx).draw();
  }

  // Split tones by register: middle C and up on treble, below on bass.
  const trebleTones = opts.grand ? opts.tones.filter((t) => spelledToMidi(t.pitch) >= 60) : opts.tones;
  const bassTones = opts.grand ? opts.tones.filter((t) => spelledToMidi(t.pitch) < 60) : [];

  const tNote = makeNote(trebleTones, 'treble');
  if (tNote) Formatter.FormatAndDraw(ctx, treble, [tNote]);
  if (bass) {
    const bNote = makeNote(bassTones, 'bass');
    if (bNote) Formatter.FormatAndDraw(ctx, bass, [bNote]);
  }

  const svg = container.querySelector('svg');
  if (svg) {
    svg.setAttribute('viewBox', `0 0 ${CANVAS_WIDTH} ${height}`);
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.style.removeProperty('width');
    svg.style.removeProperty('height');
    svg.style.width = '100%';
    svg.style.height = 'auto';
  }

  return {
    treble: { topLineY: treble.getYForLine(0), spacing: treble.getSpacingBetweenLines() },
    bass: bass ? { topLineY: bass.getYForLine(0), spacing: bass.getSpacingBetweenLines() } : null,
    splitY: bass ? (treble.getYForLine(4) + bass.getYForLine(0)) / 2 : null,
  };
}
