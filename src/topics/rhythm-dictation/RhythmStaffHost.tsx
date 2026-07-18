import { useEffect, useRef, useState } from 'react';
import type { MeasureGeometry } from '../../lib/notation/geometry';
import { findMeasureAt, resolvePlacementBeat } from '../../lib/notation/placement';
import { renderStaff, type RhythmStaffModel } from '../../lib/rhythm-staff/render';

interface RhythmStaffHostProps {
  /** RhythmStaffHost owns the hover ghost itself (see `hover` state below) — callers never supply `RhythmStaffModel.hover`. */
  model: Omit<RhythmStaffModel, 'hover'>;
  gridStepVal: number;
  armedDuration: number;
  armedIsRest: boolean;
  /** rawBeat is a proportional, unsnapped beat estimate within the measure — the caller resolves it to a real slot. */
  onClick(measureIndex: number, rawBeat: number): void;
  onCursorMove?(delta: number): void;
  onPlaceAtCursor?(): void;
  onCursorFocus?(): void;
  onCursorBlur?(): void;
}

interface HoverState {
  measureIndex: number;
  beat: number;
  duration: number;
  isRest: boolean;
}

// Imperative island (04-notation-engine.md Part A): owns the container div;
// renderStaff() (VexFlow-based) rebuilds the scene from the model every
// render and returns the per-measure geometry the click handler needs —
// the same real-drawn-geometry hit-testing VexStaffHost uses, replacing the
// legacy fixed 128..960 coordinate math that no longer matched where
// VexFlow actually draws the measures (the time signature alone shifts
// measure 1's note area right of any fixed grid).
//
// Hover preview: mirrors VexStaffHost's ghost-note mechanism exactly (same
// resolver, same raf-debounced mousemove) so a click can never land
// anywhere its own hover preview didn't already show (docs/12 MD-4's gate,
// now shared with rhythm dictation).
//
// Keyboard placement fallback (09-improvement-plan.md §14.1): the staff is
// its own focusable widget with a keydown handler scoped to when IT has
// focus. Left/Right move the insertion cursor (stopping propagation so the
// document-level measure-switch shortcut in RhythmDictationTopic doesn't
// also fire); Enter places the armed duration/rest. Other keys (digits,
// R/D, Backspace, Space) are left to bubble to that document handler so
// arming a duration or toggling rest/dot still works while the staff has
// focus.
export function RhythmStaffHost({
  model,
  gridStepVal,
  armedDuration,
  armedIsRest,
  onClick,
  onCursorMove,
  onPlaceAtCursor,
  onCursorFocus,
  onCursorBlur,
}: RhythmStaffHostProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const geometryRef = useRef<MeasureGeometry[]>([]);
  const [hover, setHover] = useState<HoverState | null>(null);
  const hoverRafRef = useRef<number | null>(null);
  const measureTotalBeats = model.beatsPerBar * (4 / model.beatValue);

  useEffect(() => {
    if (containerRef.current) {
      const activeHover = model.hasSubmitted ? null : hover;
      geometryRef.current = renderStaff(containerRef.current, { ...model, hover: activeHover });
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

  function resolveAt(x: number, y: number): { geo: MeasureGeometry; rawBeat: number } | null {
    const geo = findMeasureAt(geometryRef.current, x, y);
    if (!geo) return null;
    const rel = (x - geo.noteStartX) / Math.max(1, geo.noteEndX - geo.noteStartX);
    return { geo, rawBeat: rel * measureTotalBeats };
  }

  function handleClick(evt: React.MouseEvent<HTMLDivElement>) {
    const pt = pointFromEvent(evt);
    if (!pt) return;
    const resolved = resolveAt(pt.x, pt.y);
    if (!resolved) return;
    onClick(resolved.geo.index, resolved.rawBeat);
  }

  function updateHover(x: number, y: number) {
    if (model.hasSubmitted) {
      setHover(null);
      return;
    }
    const resolved = resolveAt(x, y);
    if (!resolved) {
      setHover(null);
      return;
    }
    const measure = model.measures[resolved.geo.index] ?? [];
    const placed = resolvePlacementBeat(measure, resolved.rawBeat, armedDuration, measureTotalBeats, gridStepVal);
    if (!placed) {
      setHover(null);
      return;
    }
    setHover({ measureIndex: resolved.geo.index, beat: placed.beat, duration: armedDuration, isRest: armedIsRest });
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

  function handleKeyDown(evt: React.KeyboardEvent<HTMLDivElement>) {
    if (evt.key === 'ArrowLeft') {
      evt.preventDefault();
      evt.stopPropagation();
      onCursorMove?.(-1);
    } else if (evt.key === 'ArrowRight') {
      evt.preventDefault();
      evt.stopPropagation();
      onCursorMove?.(1);
    } else if (evt.key === 'Enter') {
      evt.preventDefault();
      evt.stopPropagation();
      onPlaceAtCursor?.();
    }
  }

  return (
    <div
      ref={containerRef}
      id="rd-staff-svg"
      role="application"
      aria-label="Rhythm staff. Left and right arrow keys move the insertion cursor; Enter places the armed note or rest at the cursor."
      tabIndex={0}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
      onFocus={onCursorFocus}
      onBlur={onCursorBlur}
    />
  );
}
