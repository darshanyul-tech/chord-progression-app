import { useEffect, useRef } from 'react';
import { buildVexScore, type MeasureGeometry, type MelodyStaffModel } from '../../lib/melody/vexscore';
import { lineToLetterOctave, naturalMidiFor } from '../../lib/melody/theory';
import { snapBeat } from '../../lib/rhythm/time';

interface VexStaffHostProps {
  model: MelodyStaffModel;
  gridStepVal: number;
  armedDuration: number;
  armedAccidental: '' | '#' | 'b';
  onPlace(measureIndex: number, beat: number, midi: number): void;
}

// Imperative island (docs/04-notation-engine.md Part B4/B5): owns the
// container div; buildVexScore rebuilds the scene from the model every
// render and returns the measure geometry the click handler needs. All
// hit-testing math (x→beat, y→pitch) lives here, self-contained, using only
// the returned geometry numbers + lib/melody/theory's pure staff-geometry
// helpers — no VexFlow internals beyond what buildVexScore already read.
export function VexStaffHost({ model, gridStepVal, armedDuration, armedAccidental, onPlace }: VexStaffHostProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const geometryRef = useRef<MeasureGeometry[]>([]);

  useEffect(() => {
    if (containerRef.current) {
      geometryRef.current = buildVexScore(containerRef.current, model);
    }
  });

  function findMeasureAt(x: number, y: number): MeasureGeometry | null {
    const candidates = geometryRef.current.filter((g) => x >= g.noteStartX - 20 && x <= g.noteEndX + 20);
    if (!candidates.length) return null;
    return candidates.reduce((best, g) => (Math.abs(g.topLineY - y) < Math.abs(best.topLineY - y) ? g : best));
  }

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

    const geo = findMeasureAt(loc.x, loc.y);
    if (!geo) return;

    const measureTotalBeats = model.timeSig.measureBeats;
    const rel = (loc.x - geo.noteStartX) / Math.max(1, geo.noteEndX - geo.noteStartX);
    const maxBeat = Math.max(0, measureTotalBeats - armedDuration);
    const beat = snapBeat(rel * measureTotalBeats, maxBeat, gridStepVal);

    // y → pitch: invert VexFlow's own getYForNote()/getYForLine() relationship
    // (getYForNote(kpLine) === getYForLine(5 - kpLine), verified against
    // vexflow/src/stave.ts) using only the topLineY/spacing this render
    // already captured — no VexFlow instance needed at click time.
    const topConventionLine = (loc.y - geo.topLineY) / geo.spacing;
    const kpLine = Math.round((5 - topConventionLine) * 2) / 2;
    const { letterIndex, octave } = lineToLetterOctave(kpLine, model.clef);
    const naturalMidi = naturalMidiFor(letterIndex, octave);
    const midi = naturalMidi + (armedAccidental === '#' ? 1 : armedAccidental === 'b' ? -1 : 0);

    onPlace(geo.index, beat, midi);
  }

  return (
    <div ref={containerRef} id="md-staff-svg" role="img" aria-label="Melody staff" onClick={handleClick} />
  );
}
