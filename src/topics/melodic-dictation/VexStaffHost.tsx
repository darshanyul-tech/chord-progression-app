import { useEffect, useRef, useState } from 'react';
import { buildVexScore, type MeasureGeometry, type MelodyStaffModel } from '../../lib/melody/vexscore';
import { lineToLetterOctave, naturalMidiFor } from '../../lib/melody/theory';
import { resolvePlacementBeat } from '../../lib/melody/placement';

interface VexStaffHostProps {
  /** VexStaffHost owns the hover ghost itself (see `hover` state below) — callers never supply `MelodyStaffModel.hover`. */
  model: Omit<MelodyStaffModel, 'hover'>;
  gridStepVal: number;
  armedDuration: number;
  armedIsRest: boolean;
  armedAccidental: '' | '#' | 'b';
  onPlace(measureIndex: number, beat: number, midi: number): void;
  onCursorMoveBeat?(delta: number): void;
  onCursorMovePitch?(delta: number): void;
  onPlaceAtCursor?(): void;
  onCursorFocus?(): void;
  onCursorBlur?(): void;
}

interface HoverState {
  measureIndex: number;
  beat: number;
  midi: number | null;
}

interface ResolvedPoint {
  geo: MeasureGeometry;
  rawBeat: number;
  midi: number;
}

// Imperative island (docs/04-notation-engine.md Part B4/B5): owns the
// container div; buildVexScore rebuilds the scene from the model every
// render and returns the measure geometry the click handler needs. All
// hit-testing math (x→beat, y→pitch) lives here, self-contained, using only
// the returned geometry numbers + lib/melody/theory's pure staff-geometry
// helpers — no VexFlow internals beyond what buildVexScore already read.
//
// Click and hover share one raw-beat/pitch computation (resolveAt) and one
// snap resolver (resolvePlacementBeat) so the hover ghost can never show a
// position the click wouldn't actually commit to (docs/12-melodic-
// dictation-fixes.md MD-4's gate).
//
// Keyboard placement fallback (09-improvement-plan.md §14.1): focusable
// widget with its own scoped keydown handler. Left/Right move the beat
// cursor, Up/Down move the pitch cursor (stopping propagation so the
// document-level nudgeLastNote shortcut in MelodicDictationTopic doesn't
// also fire while the staff has focus), Enter places the armed
// duration/rest/pitch at the cursor.
export function VexStaffHost({
  model,
  gridStepVal,
  armedDuration,
  armedIsRest,
  armedAccidental,
  onPlace,
  onCursorMoveBeat,
  onCursorMovePitch,
  onPlaceAtCursor,
  onCursorFocus,
  onCursorBlur,
}: VexStaffHostProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const geometryRef = useRef<MeasureGeometry[]>([]);
  const [hover, setHover] = useState<HoverState | null>(null);
  const hoverRafRef = useRef<number | null>(null);

  useEffect(() => {
    if (containerRef.current) {
      const activeHover = model.hasSubmitted ? null : hover;
      geometryRef.current = buildVexScore(containerRef.current, {
        ...model,
        hover: activeHover
          ? { measureIndex: activeHover.measureIndex, beat: activeHover.beat, midi: activeHover.midi, isRest: armedIsRest }
          : null,
      });
    }
  });

  useEffect(
    () => () => {
      if (hoverRafRef.current !== null) cancelAnimationFrame(hoverRafRef.current);
    },
    [],
  );

  function findMeasureAt(x: number, y: number): MeasureGeometry | null {
    const candidates = geometryRef.current.filter((g) => x >= g.noteStartX - 20 && x <= g.noteEndX + 20);
    if (!candidates.length) return null;
    return candidates.reduce((best, g) => (Math.abs(g.topLineY - y) < Math.abs(best.topLineY - y) ? g : best));
  }

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

  // y → pitch: invert VexFlow's own getYForNote()/getYForLine() relationship
  // (getYForNote(kpLine) === getYForLine(5 - kpLine), verified against
  // vexflow/src/stave.ts) using only the topLineY/spacing this render
  // already captured — no VexFlow instance needed at click time.
  function midiFromY(y: number, geo: MeasureGeometry): number {
    const topConventionLine = (y - geo.topLineY) / geo.spacing;
    const kpLine = Math.round((5 - topConventionLine) * 2) / 2;
    const { letterIndex, octave } = lineToLetterOctave(kpLine, model.clef);
    const naturalMidi = naturalMidiFor(letterIndex, octave);
    return naturalMidi + (armedAccidental === '#' ? 1 : armedAccidental === 'b' ? -1 : 0);
  }

  function resolveAt(x: number, y: number): ResolvedPoint | null {
    const geo = findMeasureAt(x, y);
    if (!geo) return null;
    const measureTotalBeats = model.timeSig.measureBeats;
    const rel = (x - geo.noteStartX) / Math.max(1, geo.noteEndX - geo.noteStartX);
    const rawBeat = rel * measureTotalBeats;
    return { geo, rawBeat, midi: midiFromY(y, geo) };
  }

  function handleClick(evt: React.MouseEvent<HTMLDivElement>) {
    const pt = pointFromEvent(evt);
    if (!pt) return;
    const resolved = resolveAt(pt.x, pt.y);
    if (!resolved) return;
    onPlace(resolved.geo.index, resolved.rawBeat, resolved.midi);
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
    const placed = resolvePlacementBeat(measure, resolved.rawBeat, armedDuration, model.timeSig.measureBeats, gridStepVal);
    if (!placed) {
      setHover(null);
      return;
    }
    setHover({ measureIndex: resolved.geo.index, beat: placed.beat, midi: armedIsRest ? null : resolved.midi });
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
      onCursorMoveBeat?.(-1);
    } else if (evt.key === 'ArrowRight') {
      evt.preventDefault();
      evt.stopPropagation();
      onCursorMoveBeat?.(1);
    } else if (evt.key === 'ArrowUp') {
      evt.preventDefault();
      evt.stopPropagation();
      onCursorMovePitch?.(1);
    } else if (evt.key === 'ArrowDown') {
      evt.preventDefault();
      evt.stopPropagation();
      onCursorMovePitch?.(-1);
    } else if (evt.key === 'Enter') {
      evt.preventDefault();
      evt.stopPropagation();
      onPlaceAtCursor?.();
    }
  }

  return (
    <div
      ref={containerRef}
      id="md-staff-svg"
      role="application"
      aria-label="Melody staff. Left and right arrow keys move the beat cursor, up and down arrow keys move the pitch cursor, and Enter places the armed note or rest at the cursor."
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
