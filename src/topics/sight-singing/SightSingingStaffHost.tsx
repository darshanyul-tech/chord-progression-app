import { useEffect, useRef } from 'react';
import type { GeneratedMelody } from '../../lib/melody/generator';
import { buildVexScore, type MelodyStaffModel } from '../../lib/melody/vexscore';

interface SightSingingStaffHostProps {
  melody: GeneratedMelody;
  /** 0..1 position of the currently active note across the whole melody (reuses the playback-cursor line), or null when not actively listening. */
  activeFraction: number | null;
}

// Read-only staff display (docs/05-topics/13-sight-singing.md §5) — none of
// VexStaffHost's click/keyboard input layer, since there's nothing to place
// here. Reuses buildVexScore exactly as Melodic Dictation does (no new
// notation code); the active-note highlight reuses the existing
// playback-cursor line (already CURSOR_COLOR) rather than adding per-note
// recoloring to vexscore.ts, which only supports a single style per
// measure-voice, not per-note.
export function SightSingingStaffHost({ melody, activeFraction }: SightSingingStaffHostProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const model: MelodyStaffModel = {
      key: melody.key,
      clef: melody.clef,
      timeSig: melody.timeSig,
      numMeasures: melody.measures.length,
      measures: melody.measures,
      hasSubmitted: false,
      isCorrect: true,
      revealMeasures: null,
      flashMeasure: null,
      playbackFraction: activeFraction,
      cursorMeasureIndex: 0,
      cursorBeat: null,
      cursorMidi: null,
      hover: null,
    };
    buildVexScore(containerRef.current, model);
  });

  return <div ref={containerRef} role="img" aria-label="Sight singing melody staff (read-only)" />;
}
