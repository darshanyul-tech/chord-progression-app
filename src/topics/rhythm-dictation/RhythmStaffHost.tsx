import { useEffect, useRef } from 'react';
import { STAFF_LEFT, STAFF_RIGHT, measureWidth } from '../../lib/rhythm/time';
import { renderStaff, type RhythmStaffModel } from '../../lib/rhythm-staff/render';

interface RhythmStaffHostProps {
  model: RhythmStaffModel;
  onClick(measureIndex: number, clickX: number): void;
}

// Imperative island (04-notation-engine.md Part A): owns the container div;
// renderStaff() (VexFlow-based) rebuilds the scene from the model every
// render. Click mapping keeps the same fixed 1000-unit coordinate system
// (STAFF_LEFT..STAFF_RIGHT) as the beat/grid math in lib/rhythm/time, even
// though VexFlow's own formatter positions noteheads independently within
// each measure — the same tradeoff the melodic-dictation design accepts.
export function RhythmStaffHost({ model, onClick }: RhythmStaffHostProps) {
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

  return (
    <div
      ref={containerRef}
      id="rd-staff-svg"
      role="img"
      aria-label="Rhythm staff"
      onClick={handleClick}
    />
  );
}
