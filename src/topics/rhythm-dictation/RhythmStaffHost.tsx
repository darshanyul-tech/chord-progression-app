import { useEffect, useRef } from 'react';
import { STAFF_LEFT, STAFF_RIGHT, measureWidth } from '../../lib/rhythm/time';
import { renderStaff, type RhythmStaffModel } from '../../lib/rhythm-staff/render';

interface RhythmStaffHostProps {
  model: RhythmStaffModel;
  onClick(measureIndex: number, clickX: number): void;
  onCursorMove?(delta: number): void;
  onPlaceAtCursor?(): void;
  onCursorFocus?(): void;
  onCursorBlur?(): void;
}

// Imperative island (04-notation-engine.md Part A): owns the container div;
// renderStaff() (VexFlow-based) rebuilds the scene from the model every
// render. Click mapping keeps the same fixed 1000-unit coordinate system
// (STAFF_LEFT..STAFF_RIGHT) as the beat/grid math in lib/rhythm/time, even
// though VexFlow's own formatter positions noteheads independently within
// each measure — the same tradeoff the melodic-dictation design accepts.
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
  onClick,
  onCursorMove,
  onPlaceAtCursor,
  onCursorFocus,
  onCursorBlur,
}: RhythmStaffHostProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) renderStaff(containerRef.current, model);
  });

  function handleClick(evt: React.MouseEvent<HTMLDivElement>) {
    const container = containerRef.current;
    const svg = container?.querySelector('svg');
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const loc = pt.matrixTransform(ctm.inverse());
    const mw = measureWidth(model.numMeasures);
    let mi = Math.floor((loc.x - STAFF_LEFT) / mw);
    mi = Math.max(0, Math.min(model.numMeasures - 1, mi));
    onClick(mi, Math.max(STAFF_LEFT, Math.min(STAFF_RIGHT, loc.x)));
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
      onKeyDown={handleKeyDown}
      onFocus={onCursorFocus}
      onBlur={onCursorBlur}
    />
  );
}
