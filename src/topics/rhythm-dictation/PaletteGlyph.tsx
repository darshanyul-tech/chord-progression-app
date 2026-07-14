import { useEffect, useRef } from 'react';
import { RD_COL, drawNoteGlyph, drawRestGlyph } from '../../lib/rhythm-staff/glyphs';

export function NoteGlyphIcon({ duration }: { duration: number }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    drawNoteGlyph(svg, duration, 36, 0.9, RD_COL.ink);
  }, [duration]);
  return <svg ref={ref} className="rd-glyph" viewBox="-20 0 40 56" aria-hidden="true" />;
}

export function RestGlyphIcon() {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    drawRestGlyph(svg, 1, 36, 0.9, RD_COL.ink);
  }, []);
  return <svg ref={ref} className="rd-glyph" viewBox="-20 0 40 56" aria-hidden="true" />;
}
