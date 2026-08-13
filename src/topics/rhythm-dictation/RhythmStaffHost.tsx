import { useEffect, useReducer, useRef, useState } from 'react';
import type { MeasureGeometry } from '../../lib/notation/geometry';
import { findMeasureAt, resolvePlacementBeat, xToBeat } from '../../lib/notation/placement';
import { renderStaff, type RhythmStaffModel } from '../../lib/rhythm-staff/render';

interface RhythmStaffHostProps {
  /** RhythmStaffHost owns the hover ghost itself (see `hover` state below) — callers never supply `RhythmStaffModel.hover`. */
  model: Omit<RhythmStaffModel, 'hover'>;
  gridStepVal: number;
  armedDuration: number;
  armedIsRest: boolean;
  isTieActive: boolean;
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
  /** Tie armed — the ghost previews as a tied note, its curve leading right. */
  tied: boolean;
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
  isTieActive,
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
  // The most recent real mouse position, so arming Tie (or changing the
  // armed duration/rest) can recompute the ghost immediately even when the
  // mouse hasn't moved since — otherwise it kept showing the stale
  // pre-toggle preview (e.g. no tie curve) until the next mousemove.
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const measureTotalBeats = model.beatsPerBar * (4 / model.beatValue);

  const [, forceRerender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (containerRef.current) {
      const activeHover = model.hasSubmitted ? null : hover;
      geometryRef.current = renderStaff(containerRef.current, { ...model, hover: activeHover });
    }
  });

  // Re-render when the container's width changes so the staff reflows onto more
  // or fewer stacked rows (systemLayout.ts reads container.clientWidth). Only
  // width matters — the SVG's own height grows with row count, so ignoring
  // height changes here avoids a render loop.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let lastWidth = el.clientWidth;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w !== lastWidth) {
        lastWidth = w;
        forceRerender();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(
    () => () => {
      if (hoverRafRef.current !== null) cancelAnimationFrame(hoverRafRef.current);
    },
    [],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (lastPointRef.current) updateHover(lastPointRef.current.x, lastPointRef.current.y);
  }, [armedDuration, armedIsRest, isTieActive, model.measures, model.hasSubmitted]);

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
    return { geo, rawBeat: xToBeat(x, geo.breakpoints, geo.noteStartX, geo.noteEndX, measureTotalBeats) };
  }

  function handleMouseDown(evt: React.MouseEvent<HTMLDivElement>) {
    // The staff is focusable (tabIndex=0) for keyboard placement, but a native
    // click-focus scrolls its top edge into view — and since the staff is tall
    // (multi-row on mobile), tapping a lower row yanks the whole page up toward
    // the top on every placement. Take focus ourselves without that scroll.
    if (document.activeElement !== evt.currentTarget) {
      evt.preventDefault();
      evt.currentTarget.focus({ preventScroll: true });
    }
  }

  function handleClick(evt: React.MouseEvent<HTMLDivElement>) {
    const pt = pointFromEvent(evt);
    if (!pt) return;
    const resolved = resolveAt(pt.x, pt.y);
    if (!resolved) return;
    onClick(resolved.geo.index, resolved.rawBeat);
    // Deselect immediately after placing: drop the hover ghost and the remembered
    // point (and cancel any hover update the tap's own synthetic mousemove queued)
    // so re-arming a different duration/rest can't re-preview over the note just
    // placed. On touch there's no mouseleave to clear it otherwise.
    if (hoverRafRef.current !== null) {
      cancelAnimationFrame(hoverRafRef.current);
      hoverRafRef.current = null;
    }
    lastPointRef.current = null;
    setHover(null);
  }

  function updateHover(x: number, y: number) {
    lastPointRef.current = { x, y };
    if (model.hasSubmitted) {
      setHover(null);
      return;
    }
    const resolved = resolveAt(x, y);
    if (!resolved) {
      setHover(null);
      return;
    }
    const beat = resolvePlacementBeat(resolved.rawBeat, armedDuration, measureTotalBeats, gridStepVal);
    if (beat === null) {
      setHover(null);
      return;
    }
    // Mirrors placeNoteAt: with Tie armed, the note being placed is itself
    // the tied one — the ghost previews its own forward curve.
    setHover({
      measureIndex: resolved.geo.index,
      beat,
      duration: armedDuration,
      isRest: armedIsRest,
      tied: !armedIsRest && isTieActive,
    });
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
    lastPointRef.current = null;
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
      aria-label="Rhythm stave. Left and right arrow keys move the insertion cursor; Enter places the armed note or rest at the cursor."
      tabIndex={0}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
      onFocus={onCursorFocus}
      onBlur={onCursorBlur}
    />
  );
}
