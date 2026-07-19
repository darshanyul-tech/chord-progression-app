// The full 30-key table (docs/14-theory-engine.md §2) — all 15 majors + 15
// minors, out to 7 sharps/flats. lib/melody/theory.ts's MELODY_KEYS (+-4
// accidentals) is untouched and stays melodic dictation's own table; this is
// theory's larger, spelling-aware equivalent.

import { spelledToMidi, transposeUp, type Accidental, type SpelledPitch } from './spelledPitch';

export type KeyMode = 'major' | 'minor';

export interface TheoryKey {
  id: string;
  label: string;
  mode: KeyMode;
  tonic: { letter: string; acc: Accidental };
  accidentalCount: number;
  sharps: boolean;
  vexKeySpec: string;
  relativeId: string;
}

const ACC_GLYPH: Record<Accidental, string> = { '': '', '#': '♯', b: '♭', '##': '𝄪', bb: '𝄫' };

function key(
  id: string,
  mode: KeyMode,
  letter: string,
  acc: Accidental,
  accidentalCount: number,
  sharps: boolean,
  relativeId: string,
): TheoryKey {
  return {
    id,
    label: `${letter}${ACC_GLYPH[acc]} ${mode}`,
    mode,
    tonic: { letter, acc },
    accidentalCount,
    sharps,
    vexKeySpec: id,
    relativeId,
  };
}

// Ids match VexFlow 5's own keySignatures table strings exactly (verified in
// keys.test.ts) — using them directly as vexKeySpec means there is no
// separate mapping step to get wrong.
export const THEORY_KEYS: TheoryKey[] = [
  // Majors, C through the 7-sharp and 7-flat sides.
  key('C', 'major', 'C', '', 0, false, 'Am'),
  key('G', 'major', 'G', '', 1, true, 'Em'),
  key('D', 'major', 'D', '', 2, true, 'Bm'),
  key('A', 'major', 'A', '', 3, true, 'F#m'),
  key('E', 'major', 'E', '', 4, true, 'C#m'),
  key('B', 'major', 'B', '', 5, true, 'G#m'),
  key('F#', 'major', 'F', '#', 6, true, 'D#m'),
  key('C#', 'major', 'C', '#', 7, true, 'A#m'),
  key('F', 'major', 'F', '', 1, false, 'Dm'),
  key('Bb', 'major', 'B', 'b', 2, false, 'Gm'),
  key('Eb', 'major', 'E', 'b', 3, false, 'Cm'),
  key('Ab', 'major', 'A', 'b', 4, false, 'Fm'),
  key('Db', 'major', 'D', 'b', 5, false, 'Bbm'),
  key('Gb', 'major', 'G', 'b', 6, false, 'Ebm'),
  key('Cb', 'major', 'C', 'b', 7, false, 'Abm'),
  // Minors.
  key('Am', 'minor', 'A', '', 0, false, 'C'),
  key('Em', 'minor', 'E', '', 1, true, 'G'),
  key('Bm', 'minor', 'B', '', 2, true, 'D'),
  key('F#m', 'minor', 'F', '#', 3, true, 'A'),
  key('C#m', 'minor', 'C', '#', 4, true, 'E'),
  key('G#m', 'minor', 'G', '#', 5, true, 'B'),
  key('D#m', 'minor', 'D', '#', 6, true, 'F#'),
  key('A#m', 'minor', 'A', '#', 7, true, 'C#'),
  key('Dm', 'minor', 'D', '', 1, false, 'F'),
  key('Gm', 'minor', 'G', '', 2, false, 'Bb'),
  key('Cm', 'minor', 'C', '', 3, false, 'Eb'),
  key('Fm', 'minor', 'F', '', 4, false, 'Ab'),
  key('Bbm', 'minor', 'B', 'b', 5, false, 'Db'),
  key('Ebm', 'minor', 'E', 'b', 6, false, 'Gb'),
  key('Abm', 'minor', 'A', 'b', 7, false, 'Cb'),
];

export function theoryKeyById(id: string): TheoryKey {
  const found = THEORY_KEYS.find((k) => k.id === id);
  if (!found) throw new Error(`Unknown theory key: ${id}`);
  return found;
}

export function keysWithin(maxAccidentals: number, mode: KeyMode | 'both'): TheoryKey[] {
  return THEORY_KEYS.filter((k) => k.accidentalCount <= maxAccidentals && (mode === 'both' || k.mode === mode));
}

export interface DegreeSpelling {
  letter: string;
  acc: Accidental;
}

// Copied (not imported) from lib/melody/theory.ts per the written-theory
// independence rule (docs/14 §1) — semitone offsets of each scale degree
// above the tonic. Minor keys use natural minor, matching docs/14 §2.
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const NATURAL_MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10];

/** The 7 diatonic degrees of a key, octave-free (natural minor for minor keys). */
export function scaleSpelling(k: TheoryKey): DegreeSpelling[] {
  const steps = k.mode === 'major' ? MAJOR_STEPS : NATURAL_MINOR_STEPS;
  const tonic: SpelledPitch = { letter: k.tonic.letter, acc: k.tonic.acc, octave: 4 };
  return steps.map((semitones, i) => {
    const spelled = transposeUp(tonic, { number: i + 1, semitones });
    return { letter: spelled.letter, acc: spelled.acc };
  });
}

/** Which scale degree (1-7) a letter+accidental is in this key, or null if it isn't one of the 7 diatonic degrees. */
export function degreeOfLetter(k: TheoryKey, letter: string, acc: Accidental): number | null {
  const degrees = scaleSpelling(k);
  const idx = degrees.findIndex((d) => d.letter === letter && d.acc === acc);
  return idx < 0 ? null : idx + 1;
}

/**
 * The accidental a key's signature applies to every instance of a given
 * letter (not just its own scale-degree use) — e.g. in D major every F is
 * implicitly sharped. Used by SlotStaffInput's spelling rule (docs/14
 * §8a/§10): armed accidental wins, else the signature's own accidental for
 * that letter, else natural. Safe for minor keys too — natural minor is a
 * rotation of the relative major's own diatonic spelling, so it carries the
 * same per-letter accidentals as the shared signature.
 */
export function signatureAccidentalForLetter(k: TheoryKey, letter: string): Accidental {
  const degree = scaleSpelling(k).find((d) => d.letter === letter);
  return degree?.acc ?? '';
}

/** Sanity helper used by tests: the raw MIDI pitch class (0-11) of a key's tonic. */
export function tonicPitchClass(k: TheoryKey): number {
  return ((spelledToMidi({ ...k.tonic, octave: 4 }) % 12) + 12) % 12;
}
