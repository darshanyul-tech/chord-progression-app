import { useEffect, useRef } from 'react';
import { buildVexScore } from '../../lib/melody/vexscore';
import type { Clef, KeyDef, NoteSpelling, PitchedNote } from '../../lib/melody/theory';
import type { SpelledPitch } from '../../lib/written-theory/spelledPitch';
import { spelledToMidi } from '../../lib/written-theory/spelledPitch';

interface TheoryStaffViewProps {
  clef: Clef;
  /** VexFlow key-signature spec from the theory key table (any of the 30 — not limited to MELODY_KEYS). Omit for an open staff (renders as the empty C/Am signature). */
  vexKeySpec?: string;
  notes: SpelledPitch[];
}

/**
 * Every theory note carries an explicit spelling (docs/14-theory-engine.md
 * §8a rule), so the fallback fields on this stub KeyDef are never actually
 * read by buildVexScore — only `vexKeySpec` (used to draw the signature
 * itself) matters here.
 */
function stubKeyDef(vexKeySpec: string): KeyDef {
  return { id: vexKeySpec, tonicPc: 0, mode: 'major', vexKeySpec, sharpKey: false };
}

/**
 * Always returns an explicit spelling, naturals included (docs/14 §8a) —
 * theory notes never rely on lib/melody/spelling.ts's per-key fallback
 * table, which only knows the 14 MELODY_KEYS ids, not the 30-key theory
 * table. lib/melody's NoteSpelling only allows a single sharp/flat/natural
 * (no doubles) — safe here because every theory question pool filters out
 * double accidentals before a note ever reaches display
 * (scaleNeedsDoubleAccidentals / chordNeedsDoubleAccidentals and the
 * interval-writing/transposition equivalents). This throws rather than
 * silently mis-rendering if that guarantee is ever violated.
 */
function toNoteSpelling(p: SpelledPitch): NoteSpelling {
  if (p.acc === '##' || p.acc === 'bb') {
    throw new Error(`TheoryStaffView cannot display a double accidental (${p.letter}${p.acc}) — pool filter was bypassed`);
  }
  return { letter: p.letter, accidental: p.acc, octave: p.octave };
}

/**
 * Read-only VexFlow render of a short whole-note sequence (docs/14 §7) —
 * reuses buildVexScore exactly as Sight Singing does (display-only, no
 * input wiring). Modeled as one wide measure (measureBeats = 4 * notes.length)
 * so VexFlow lays every note out with no internal barline, and the time
 * signature is suppressed — the two "staff-display options" docs/14 §7 asks
 * for, both achieved without new layout code.
 */
export function TheoryStaffView({ clef, vexKeySpec, notes }: TheoryStaffViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const pitchedNotes: PitchedNote[] = notes.map((p, i) => ({
      beat: i * 4,
      duration: 4,
      rest: false,
      midi: spelledToMidi(p),
      spelling: toNoteSpelling(p),
    }));
    buildVexScore(containerRef.current, {
      key: stubKeyDef(vexKeySpec ?? 'C'),
      clef,
      timeSig: { beatsPerBar: notes.length * 4, beatValue: 4, measureBeats: notes.length * 4 },
      numMeasures: 1,
      measures: [pitchedNotes],
      hasSubmitted: false,
      isCorrect: true,
      revealMeasures: null,
      flashMeasure: null,
      playbackFraction: null,
      cursorMeasureIndex: 0,
      cursorBeat: null,
      cursorMidi: null,
      hover: null,
      showTimeSignature: false,
    });
  });

  return <div ref={containerRef} role="img" aria-label="Music notation staff (read-only)" />;
}
