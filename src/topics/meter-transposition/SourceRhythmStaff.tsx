import { useEffect, useRef } from 'react';
import { renderStaff } from '../../lib/rhythm-staff/render';
import type { Measure } from '../../lib/rhythm/time';

interface SourceRhythmStaffProps {
  beatsPerBar: number;
  beatValue: number;
  measures: Measure[];
}

/**
 * Read-only source rhythm display for Meter Transposition (docs/15-theory-
 * topics/09 §5) — RhythmStaffHost is always interactive (no disabled/
 * read-only prop, docs/15's own reuse note), so this calls renderStaff
 * directly in a plain useEffect instead, mirroring Transposition's
 * SourceStaff.tsx pattern one level down (rhythm staff instead of a pitched
 * one). Forces the model into an always-"correct"/never-submitted/no-hover
 * shape so the renderer just draws plain black notation with no interactive
 * affordances.
 */
export function SourceRhythmStaff({ beatsPerBar, beatValue, measures }: SourceRhythmStaffProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    renderStaff(containerRef.current, {
      beatsPerBar,
      beatValue,
      numMeasures: measures.length,
      measures,
      hasSubmitted: false,
      measureResults: [],
      correctPattern: measures,
      flashMeasure: null,
      playbackFraction: null,
      cursorMeasureIndex: 0,
      cursorBeat: null,
      hover: null,
    });
  });

  return <div ref={containerRef} role="img" aria-label="Source rhythm (read-only)" />;
}
