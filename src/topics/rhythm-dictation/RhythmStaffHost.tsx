import { useEffect, useRef } from 'react';
import { STAFF_LEFT, measureWidth } from '../../lib/rhythm/time';
import { renderStaff, type RhythmStaffModel } from '../../lib/rhythm-staff/render';

interface RhythmStaffHostProps {
  model: RhythmStaffModel;
  onClick(measureIndex: number, clickX: number): void;
}

// Imperative island (04-notation-engine.md Part A): owns the <svg> ref;
// renderStaff() re-runs from the model every render. Click handling maps
// screen coords -> SVG user space -> measure index, then hands off to the
// component's onClick prop (beat snapping happens there via lib/rhythm/time).
export function RhythmStaffHost({ model, onClick }: RhythmStaffHostProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current) renderStaff(svgRef.current, model);
  });

  function handleClick(evt: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
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
    onClick(mi, loc.x);
  }

  return (
    <svg
      ref={svgRef}
      id="rd-staff-svg"
      viewBox="0 0 1000 200"
      preserveAspectRatio="xMidYMid meet"
      aria-label="Rhythm staff"
      onClick={handleClick}
    />
  );
}
