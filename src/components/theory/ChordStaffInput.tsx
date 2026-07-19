import { useEffect, useRef, useState } from 'react';
import { resolveStaffPosition, NATURAL_LETTERS, type Clef, type NoteSpelling } from '../../lib/melody/theory';
import { signatureAccidentalForLetter, type TheoryKey } from '../../lib/written-theory/keys';
import { buildChordStack, CHORD_HOVER_COLOR, CHORD_WRONG_COLOR, type ChordColumn } from '../../lib/written-theory/chordStack';
import type { SpelledPitch } from '../../lib/written-theory/spelledPitch';

const REMOVE_PREVIEW_COLOR = 'rgba(179, 38, 30, 0.45)';

export interface ChordStaffInputProps {
  clef: Clef;
  vexKeySpec?: string;
  signatureKey?: TheoryKey;
  maxTones: number;
  /** Current committed stack, any order. */
  stack: SpelledPitch[];
  /** Shown as a second red column beside the user's stack (post-grading incorrect reveal). */
  revealStack?: SpelledPitch[] | null;
  armedAccidental: '' | '#' | 'b';
  disabled: boolean;
  onToggle(spelling: NoteSpelling): void;
}

function samePosition(a: SpelledPitch, b: { letter: string; octave: number }): boolean {
  return a.letter === b.letter && a.octave === b.octave;
}

/**
 * One-column chord-stack staff input (docs/14-theory-engine.md §8b) — the
 * only v1 consumer is Chord Writing. Clicking a position adds that pitch to
 * the stack, or removes it if a tone already sits at the same staff
 * position (regardless of the armed accidental at click time). Reuses
 * resolveStaffPosition (lib/melody/theory.ts), the same geometry
 * VexStaffHost/SlotStaffInput use, per docs §8's "do not fork the geometry
 * code" rule.
 */
export function ChordStaffInput({
  clef,
  vexKeySpec,
  signatureKey,
  maxTones,
  stack,
  revealStack,
  armedAccidental,
  disabled,
  onToggle,
}: ChordStaffInputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const geoRef = useRef<{ topLineY: number; spacing: number } | null>(null);
  const [hover, setHover] = useState<{ letter: string; octave: number; removing: boolean } | null>(null);
  const hoverRafRef = useRef<number | null>(null);

  function accidentalFor(letter: string): '' | '#' | 'b' {
    if (armedAccidental) return armedAccidental;
    if (signatureKey) return signatureAccidentalForLetter(signatureKey, letter) as '' | '#' | 'b';
    return '';
  }

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const columns: ChordColumn[] = [];
    if (!disabled && hover?.removing) {
      // Preview removal: show the current stack with the hovered tone tinted red.
      columns.push({ stack, toneColors: stack.map((t) => (samePosition(t, hover) ? REMOVE_PREVIEW_COLOR : undefined)) });
    } else if (!disabled && hover && stack.length < maxTones) {
      // Preview addition: append the hovered tone, colored as the hover ghost.
      const preview = [...stack, { letter: hover.letter, acc: accidentalFor(hover.letter), octave: hover.octave }];
      columns.push({ stack: preview, toneColors: preview.map((_, i) => (i === preview.length - 1 ? CHORD_HOVER_COLOR : undefined)) });
    } else {
      columns.push({ stack });
    }
    if (revealStack) columns.push({ stack: revealStack, color: CHORD_WRONG_COLOR });

    const result = buildChordStack(container, { clef, vexKeySpec, columns });
    geoRef.current = { topLineY: result.topLineY, spacing: result.spacing };
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

  function resolvePosition(y: number): { letter: string; octave: number; removing: boolean } | null {
    if (!geoRef.current) return null;
    const { letterIndex, octave } = resolveStaffPosition(y, geoRef.current.topLineY, geoRef.current.spacing, clef);
    const letter = NATURAL_LETTERS[letterIndex]!;
    const removing = stack.some((t) => samePosition(t, { letter, octave }));
    return { letter, octave, removing };
  }

  function handleClick(evt: React.MouseEvent<HTMLDivElement>) {
    if (disabled) return;
    const pt = pointFromEvent(evt);
    if (!pt) return;
    const resolved = resolvePosition(pt.y);
    if (!resolved) return;
    if (!resolved.removing && stack.length >= maxTones) return;
    onToggle({ letter: resolved.letter, accidental: accidentalFor(resolved.letter), octave: resolved.octave });
  }

  function updateHover(y: number) {
    if (disabled) {
      setHover(null);
      return;
    }
    setHover(resolvePosition(y));
  }

  function handleMouseMove(evt: React.MouseEvent<HTMLDivElement>) {
    const pt = pointFromEvent(evt);
    if (!pt) return;
    if (hoverRafRef.current !== null) cancelAnimationFrame(hoverRafRef.current);
    hoverRafRef.current = requestAnimationFrame(() => {
      hoverRafRef.current = null;
      updateHover(pt.y);
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
      aria-label="Chord staff input. Click a staff position to add a tone, or click an existing tone to remove it."
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    />
  );
}
