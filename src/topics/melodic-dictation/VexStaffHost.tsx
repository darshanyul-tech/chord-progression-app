import { useEffect, useRef, useState } from 'react';
import { buildVexScore, type MelodyStaffModel } from '../../lib/melody/vexscore';
import { NATURAL_LETTERS, lineToLetterOctave, naturalMidiFor, tiePreview, type NoteSpelling } from '../../lib/melody/theory';
import type { MeasureGeometry } from '../../lib/notation/geometry';
import { findMeasureAt, resolvePlacementBeat } from '../../lib/notation/placement';

interface VexStaffHostProps {
  /** VexStaffHost owns the hover ghost itself (see `hover` state below) — callers never supply `MelodyStaffModel.hover`. */
  model: Omit<MelodyStaffModel, 'hover'>;
  gridStepVal: number;
  armedDuration: number;
  armedIsRest: boolean;
  armedAccidental: '' | '#' | 'b';
  isTieActive: boolean;
  onPlace(measureIndex: number, beat: number, midi: number, spelling?: NoteSpelling): void;
  onCursorMoveBeat?(delta: number): void;
  onCursorMovePitch?(delta: number): void;
  onPlaceAtCursor?(): void;
  onCursorFocus?(): void;
  onCursorBlur?(): void;
}

interface HoverState {
  measureIndex: number;
  beat: number;
  duration: number;
  midi: number | null;
  spelling?: NoteSpelling;
  /** Tie armed — the ghost previews as a tied note, its curve leading right. */
  tied: boolean;
}

interface ResolvedPoint {
  geo: MeasureGeometry;
  rawBeat: number;
  midi: number;
  /** Set only when an accidental is armed — the cursor's own natural letter/octave plus that accidental, so e.g. Sharp on the E line always spells as E#, never silently as F (docs bug: sharp-after-sharp showing a stray natural). */
  spelling?: NoteSpelling;
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
  isTieActive,
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
  // The most recent real mouse position, so arming Tie/Sharp/Flat (or
  // changing the armed duration/rest) can recompute the ghost immediately
  // even when the mouse hasn't moved since — otherwise it kept showing the
  // stale pre-toggle preview (e.g. no tie curve, wrong accidental) until the
  // next mousemove.
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (containerRef.current) {
      const activeHover = model.hasSubmitted ? null : hover;
      geometryRef.current = buildVexScore(containerRef.current, {
        ...model,
        hover: activeHover
          ? {
              measureIndex: activeHover.measureIndex,
              beat: activeHover.beat,
              duration: activeHover.duration,
              midi: activeHover.midi,
              isRest: armedIsRest,
              spelling: armedIsRest ? undefined : activeHover.spelling,
              tied: !armedIsRest && activeHover.tied,
            }
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (lastPointRef.current) updateHover(lastPointRef.current.x, lastPointRef.current.y);
  }, [armedDuration, armedIsRest, armedAccidental, isTieActive, model.measures, model.hasSubmitted]);

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
  function midiFromY(y: number, geo: MeasureGeometry): { midi: number; spelling?: NoteSpelling } {
    const topConventionLine = (y - geo.topLineY) / geo.spacing;
    const kpLine = Math.round((5 - topConventionLine) * 2) / 2;
    const { letterIndex, octave } = lineToLetterOctave(kpLine, model.clef);
    const naturalMidi = naturalMidiFor(letterIndex, octave);
    const midi = naturalMidi + (armedAccidental === '#' ? 1 : armedAccidental === 'b' ? -1 : 0);
    // Pin the *cursor's* natural letter/octave, not one re-derived from the
    // resulting pc — that's what stops a Sharp on the E line (naturalMidi+1
    // lands on F's own pc) from silently respelling as a plain F instead of
    // E#, and in turn stops that stray natural from later colliding with a
    // genuine F# earlier in the same measure (VexFlow's Accidental.
    // applyAccidentals tracks state per letter+octave, so two different
    // letters landing on the same pc must never be conflated into one).
    const spelling: NoteSpelling | undefined = armedAccidental
      ? { letter: NATURAL_LETTERS[letterIndex]!, accidental: armedAccidental, octave }
      : undefined;
    return { midi, spelling };
  }

  function resolveAt(x: number, y: number): ResolvedPoint | null {
    const geo = findMeasureAt(geometryRef.current, x, y);
    if (!geo) return null;
    const measureTotalBeats = model.timeSig.measureBeats;
    const rel = (x - geo.noteStartX) / Math.max(1, geo.noteEndX - geo.noteStartX);
    const rawBeat = rel * measureTotalBeats;
    const { midi, spelling } = midiFromY(y, geo);
    return { geo, rawBeat, midi, spelling };
  }

  function handleClick(evt: React.MouseEvent<HTMLDivElement>) {
    const pt = pointFromEvent(evt);
    if (!pt) return;
    const resolved = resolveAt(pt.x, pt.y);
    if (!resolved) return;
    onPlace(resolved.geo.index, resolved.rawBeat, resolved.midi, resolved.spelling);
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
    const measure = model.measures[resolved.geo.index] ?? [];
    const placed = resolvePlacementBeat(measure, resolved.rawBeat, armedDuration, model.timeSig.measureBeats, gridStepVal);
    if (!placed) {
      setHover(null);
      return;
    }
    // Mirror placeNoteAt's own tie handling exactly, so the ghost never
    // shows a pitch/tie state the click wouldn't actually commit to: if the
    // note immediately preceding this position is tied (it sounds into this
    // spot), the ghost's pitch is forced to match it — regardless of whether
    // Tie is currently armed. Tie armed additionally marks the ghost itself
    // as tied, previewing its own forward curve.
    let midi = armedIsRest ? null : resolved.midi;
    let spelling = armedIsRest ? undefined : resolved.spelling;
    if (!armedIsRest && midi !== null) {
      const preview = tiePreview(model.measures, resolved.geo.index, placed.beat, midi);
      if (preview.fromTiedPredecessor) {
        midi = preview.midi;
        spelling = preview.spelling;
      }
    }
    setHover({
      measureIndex: resolved.geo.index,
      beat: placed.beat,
      duration: armedDuration,
      midi,
      spelling,
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
