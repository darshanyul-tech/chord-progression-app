import { useEffect, useRef } from 'react';
import { buildVexScore } from '../../lib/melody/vexscore';
import type { Clef, KeyDef, NoteSpelling, PitchedMeasure, PitchedNote } from '../../lib/melody/theory';
import type { TimeSigInfo } from '../../lib/rhythm/time';
import type { SpelledPitch } from '../../lib/written-theory/spelledPitch';

interface SourceStaffProps {
  clef: Clef;
  vexKeySpec: string;
  timeSig: TimeSigInfo;
  /** Rhythm skeleton (beat/duration/rest) from the generator's own measures — only .midi is replaced by the explicit theory spelling. */
  rhythmMeasures: PitchedMeasure[];
  /** Flat, one entry per note across all bars in the same order as rhythmMeasures' flattened non-rest notes. */
  spelledNotes: (SpelledPitch | null)[];
}

function stubKeyDef(vexKeySpec: string): KeyDef {
  return { id: vexKeySpec, tonicPc: 0, mode: 'major', vexKeySpec, sharpKey: false };
}

function toNoteSpelling(p: SpelledPitch): NoteSpelling {
  return { letter: p.letter, accidental: p.acc as '' | '#' | 'b', octave: p.octave };
}

/**
 * Read-only source melody display for Transposition (docs/15-theory-topics/08
 * §4) — reuses buildVexScore directly (not TheoryStaffView, which forces a
 * one-wide-measure-of-whole-notes model that doesn't fit a real rhythmic
 * melody) with the generator's own real bars/rhythm, same display-only reuse
 * Sight Singing already established. Every note carries an explicit spelling
 * (docs §8a rule) computed by the Tier-1 builder, not derived from a key
 * table lookup.
 */
export function SourceStaff({ clef, vexKeySpec, timeSig, rhythmMeasures, spelledNotes }: SourceStaffProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cursor = 0;
    const measures: PitchedMeasure[] = rhythmMeasures.map((bar) =>
      bar.map((n): PitchedNote => {
        if (n.rest) return { beat: n.beat, duration: n.duration, rest: true, midi: null };
        const spelled = spelledNotes[cursor];
        cursor += 1;
        if (!spelled) return { beat: n.beat, duration: n.duration, rest: true, midi: null };
        return {
          beat: n.beat,
          duration: n.duration,
          rest: false,
          midi: n.midi,
          spelling: toNoteSpelling(spelled),
        };
      }),
    );

    buildVexScore(containerRef.current, {
      key: stubKeyDef(vexKeySpec),
      clef,
      timeSig,
      numMeasures: measures.length,
      measures,
      hasSubmitted: false,
      isCorrect: true,
      revealMeasures: null,
      flashMeasure: null,
      playbackFraction: null,
      cursorMeasureIndex: 0,
      cursorBeat: null,
      cursorMidi: null,
      hover: null,
    });
  });

  return <div ref={containerRef} role="img" aria-label="Source melody staff (read-only)" />;
}
