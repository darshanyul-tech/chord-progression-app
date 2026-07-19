import { useEffect, useRef, useState } from 'react';
import { Accidental, Formatter, Renderer, Stave, StaveNote, Voice } from 'vexflow';
import { NATURAL_LETTERS, resolveStaffPosition, type Clef, type NoteSpelling } from '../../lib/melody/theory';
import { signatureAccidentalForLetter, type TheoryKey } from '../../lib/written-theory/keys';
import type { SpelledPitch } from '../../lib/written-theory/spelledPitch';
import { vexDurationFor } from '../../lib/rhythm-staff/vexDuration';

export interface SlotStaffInputProps {
  clef: Clef;
  /** Display signature — undefined renders the empty (open-staff) signature. */
  vexKeySpec?: string;
  /** Only set on a keyed staff (Transposition): supplies the armed-accidental fallback rule (docs/14 §10) — an unarmed click takes the signature's own accidental for that letter. */
  signatureKey?: TheoryKey;
  /** Fixed length = number of slots; null = empty. */
  slots: (SpelledPitch | null)[];
  /**
   * Per-slot duration in beat units (4 = whole note) — omit for the default
   * "every slot is a whole note" shape Interval/Scale Writing use.
   * Transposition passes the source melody's own rhythm here so its answer
   * bars align with the source bars above them (docs/15-theory-topics/08 §4)
   * rather than every slot being evenly spaced.
   */
  durations?: number[];
  /** Slots the user cannot edit (e.g. the given tonic). */
  lockedIndices?: number[];
  /** Post-grading recolor, index-aligned — undefined leaves a slot at its default color. */
  slotColors?: (string | undefined)[];
  armedAccidental: '' | '#' | 'b';
  disabled: boolean;
  onPlace(slotIndex: number, spelling: NoteSpelling): void;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 170;
const MARGIN_LEFT = 10;
const MARGIN_RIGHT = 10;
const STAVE_Y = 40;
const MUTED_COLOR = '#9a9a9a';
export const HOVER_COLOR = 'rgba(0, 95, 107, 0.4)';
// VexFlow line 2 === kpLine 3 (the middle line), per the getYForNote(kpLine)
// === getYForLine(5 - kpLine) relationship lib/melody/theory.ts documents.
const MIDDLE_LINE_VEX_INDEX = 2;

function toVexKey(letter: string, acc: '' | '#' | 'b', octave: number): string {
  return `${letter.toLowerCase()}${acc}/${octave}`;
}

function singleAccidental(acc: SpelledPitch['acc']): '' | '#' | 'b' {
  if (acc === '##' || acc === 'bb') {
    throw new Error(`SlotStaffInput cannot display a double accidental (${acc}) — pool filter was bypassed`);
  }
  return acc;
}

interface HoverState {
  index: number;
  letter: string;
  acc: '' | '#' | 'b';
  octave: number;
}

/**
 * Fixed-slot staff input (docs/14-theory-engine.md §8a) — used by Interval
 * Writing (1 slot), Scale Writing (7 slots), and Transposition (n slots,
 * rhythm locked to the source melody). Clicking a staff position assigns
 * that pitch to the x-nearest *editable* slot; slot x-positions come from
 * VexFlow's own Formatter (one voice of N equal-duration whole notes lays
 * out evenly on its own), not an analytic approximation. Reuses
 * resolveStaffPosition (lib/melody/theory.ts) for y -> pitch, the same
 * geometry VexStaffHost uses, per docs §8's "do not fork the geometry code"
 * rule.
 */
export function SlotStaffInput({
  clef,
  vexKeySpec,
  signatureKey,
  slots,
  durations,
  lockedIndices = [],
  slotColors = [],
  armedAccidental,
  disabled,
  onPlace,
}: SlotStaffInputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const slotXRef = useRef<number[]>([]);
  const geoRef = useRef<{ topLineY: number; spacing: number } | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const hoverRafRef = useRef<number | null>(null);

  function accidentalFor(letter: string): '' | '#' | 'b' {
    if (armedAccidental) return armedAccidental;
    if (signatureKey) return signatureAccidentalForLetter(signatureKey, letter) as '' | '#' | 'b';
    return '';
  }

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = '';
    const renderer = new Renderer(container, Renderer.Backends.SVG);
    renderer.resize(CANVAS_WIDTH, CANVAS_HEIGHT);
    const context = renderer.getContext();
    const stave = new Stave(MARGIN_LEFT, STAVE_Y, CANVAS_WIDTH - MARGIN_LEFT - MARGIN_RIGHT);
    stave.addClef(clef);
    stave.addKeySignature(vexKeySpec ?? 'C');
    stave.setContext(context).draw();

    const topLineY = stave.getYForLine(0);
    const spacing = stave.getSpacingBetweenLines();
    const midLine = resolveStaffPosition(stave.getYForLine(MIDDLE_LINE_VEX_INDEX), topLineY, spacing, clef);

    const staveNotes: StaveNote[] = slots.map((slot, i) => {
      const beats = durations?.[i] ?? 4;
      const { duration, dots } = vexDurationFor(beats);
      const isHoverTarget = hover?.index === i;
      const effective: SpelledPitch | null = isHoverTarget
        ? { letter: hover!.letter, acc: hover!.acc, octave: hover!.octave }
        : slot;
      if (!effective) {
        const key = toVexKey(NATURAL_LETTERS[midLine.letterIndex]!, '', midLine.octave);
        const note = new StaveNote({ keys: [key], duration, dots, clef });
        note.setStyle({ fillStyle: MUTED_COLOR, strokeStyle: MUTED_COLOR });
        return note;
      }
      const key = toVexKey(effective.letter, singleAccidental(effective.acc), effective.octave);
      const note = new StaveNote({ keys: [key], duration, dots, clef });
      const color = isHoverTarget ? HOVER_COLOR : slotColors[i];
      if (color) note.setStyle({ fillStyle: color, strokeStyle: color });
      return note;
    });

    const totalBeats = durations ? durations.reduce((s, b) => s + b, 0) : Math.max(1, slots.length) * 4;
    const voice = new Voice({ numBeats: totalBeats, beatValue: 4 });
    voice.setMode(Voice.Mode.SOFT);
    voice.addTickables(staveNotes);
    Accidental.applyAccidentals([voice], vexKeySpec ?? 'C');
    new Formatter().joinVoices([voice]).format([voice], Math.max(20, stave.getNoteEndX() - stave.getNoteStartX() - 20));
    voice.draw(context, stave);

    slotXRef.current = staveNotes.map((n) => n.getAbsoluteX());
    geoRef.current = { topLineY, spacing };

    const svg = container.querySelector('svg');
    if (svg) {
      svg.setAttribute('viewBox', `0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`);
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      svg.style.removeProperty('width');
      svg.style.removeProperty('height');
    }
  });

  useEffect(
    () => () => {
      if (hoverRafRef.current !== null) cancelAnimationFrame(hoverRafRef.current);
    },
    [],
  );

  function pointFromEvent(evt: { clientX: number; clientY: number }): { x: number; y: number } | null {
    const svg = containerRef.current?.querySelector('svg');
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const loc = pt.matrixTransform(ctm.inverse());
    return { x: loc.x, y: loc.y };
  }

  function nearestEditableSlot(x: number): number | null {
    let best: number | null = null;
    let bestDist = Infinity;
    slotXRef.current.forEach((sx, i) => {
      if (lockedIndices.includes(i)) return;
      const dist = Math.abs(sx - x);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    return best;
  }

  function resolveAt(x: number, y: number): { index: number; letter: string; octave: number } | null {
    if (!geoRef.current) return null;
    const index = nearestEditableSlot(x);
    if (index === null) return null;
    const { letterIndex, octave } = resolveStaffPosition(y, geoRef.current.topLineY, geoRef.current.spacing, clef);
    return { index, letter: NATURAL_LETTERS[letterIndex]!, octave };
  }

  function handleClick(evt: React.MouseEvent<HTMLDivElement>) {
    if (disabled) return;
    const pt = pointFromEvent(evt);
    if (!pt) return;
    const resolved = resolveAt(pt.x, pt.y);
    if (!resolved) return;
    onPlace(resolved.index, { letter: resolved.letter, accidental: accidentalFor(resolved.letter), octave: resolved.octave });
  }

  function updateHover(x: number, y: number) {
    if (disabled) {
      setHover(null);
      return;
    }
    const resolved = resolveAt(x, y);
    if (!resolved) {
      setHover(null);
      return;
    }
    setHover({ index: resolved.index, letter: resolved.letter, acc: accidentalFor(resolved.letter), octave: resolved.octave });
  }

  function handleMouseMove(evt: React.MouseEvent<HTMLDivElement>) {
    const pt = pointFromEvent(evt);
    if (!pt) return;
    if (hoverRafRef.current !== null) cancelAnimationFrame(hoverRafRef.current);
    hoverRafRef.current = requestAnimationFrame(() => {
      hoverRafRef.current = null;
      updateHover(pt.x, pt.y);
    });
  }

  function handleMouseLeave() {
    if (hoverRafRef.current !== null) {
      cancelAnimationFrame(hoverRafRef.current);
      hoverRafRef.current = null;
    }
    setHover(null);
  }

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="Staff answer input. Click a staff position to place a note in the nearest empty slot."
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    />
  );
}
