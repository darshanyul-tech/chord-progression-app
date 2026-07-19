// Spelled-pitch model and interval math (docs/14-theory-engine.md §1). The
// whole theory section grades on spelling, not pitch class — C# and Db are
// different answers here, unlike the aural section's MIDI-only grading.

export type Accidental = '' | '#' | 'b' | '##' | 'bb';

export interface SpelledPitch {
  letter: string;
  acc: Accidental;
  octave: number;
}

/** The minimal shape transposeUp/transposeDown need — lets callers (e.g. keys.ts's scaleSpelling) synthesize an ad-hoc scale-degree step without an id/label. */
export interface IntervalLike {
  /** Diatonic interval number (1 = unison ... 8 = octave). */
  number: number;
  semitones: number;
}

export interface IntervalDef extends IntervalLike {
  id: string;
  label: string;
}

// docs/14 §1 — P1..P8, compound intervals are backlog but the shape doesn't
// preclude adding them.
export const INTERVALS: IntervalDef[] = [
  { id: 'P1', label: 'Unison', number: 1, semitones: 0 },
  { id: 'm2', label: 'Minor 2nd', number: 2, semitones: 1 },
  { id: 'M2', label: 'Major 2nd', number: 2, semitones: 2 },
  { id: 'm3', label: 'Minor 3rd', number: 3, semitones: 3 },
  { id: 'M3', label: 'Major 3rd', number: 3, semitones: 4 },
  { id: 'P4', label: 'Perfect 4th', number: 4, semitones: 5 },
  { id: 'A4', label: 'Augmented 4th', number: 4, semitones: 6 },
  { id: 'd5', label: 'Diminished 5th', number: 5, semitones: 6 },
  { id: 'P5', label: 'Perfect 5th', number: 5, semitones: 7 },
  { id: 'm6', label: 'Minor 6th', number: 6, semitones: 8 },
  { id: 'M6', label: 'Major 6th', number: 6, semitones: 9 },
  { id: 'm7', label: 'Minor 7th', number: 7, semitones: 10 },
  { id: 'M7', label: 'Major 7th', number: 7, semitones: 11 },
  { id: 'P8', label: 'Octave', number: 8, semitones: 12 },
];

export function intervalById(id: string): IntervalDef {
  const interval = INTERVALS.find((i) => i.id === id);
  if (!interval) throw new Error(`Unknown interval: ${id}`);
  return interval;
}

// Copied (not imported) from lib/melody/theory.ts's NATURAL_LETTERS/NATURAL_PC
// per docs/14 §1 — written-theory must not depend on lib/melody.
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NATURAL_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const ACC_OFFSET: Record<Accidental, number> = { '': 0, '#': 1, b: -1, '##': 2, bb: -2 };
const OFFSET_TO_ACC: Record<number, Accidental> = { 0: '', 1: '#', '-1': 'b', 2: '##', '-2': 'bb' } as Record<
  number,
  Accidental
>;

function letterIndex(letter: string): number {
  const idx = LETTERS.indexOf(letter);
  if (idx < 0) throw new Error(`Unknown letter: ${letter}`);
  return idx;
}

/** Natural MIDI for a bare letter+octave (no accidental) — octave is the letter's own. */
function naturalMidiFor(letter: string, octave: number): number {
  return (octave + 1) * 12 + NATURAL_PC[letter]!;
}

/**
 * MIDI value of a spelled pitch. The octave is the *letter's* octave — B#3
 * sounds as C4 (MIDI 60) but stays spelled/octaved as B#3, matching the rule
 * lib/melody/theory.ts documents for NoteSpelling.
 */
export function spelledToMidi(p: SpelledPitch): number {
  return naturalMidiFor(p.letter, p.octave) + ACC_OFFSET[p.acc];
}

function accidentalForOffset(offset: number): Accidental {
  const acc = OFFSET_TO_ACC[offset];
  if (acc === undefined) {
    throw new Error(`Interval math produced an offset outside -2..2 semitones (${offset}) — not a legal spelling`);
  }
  return acc;
}

/** Advances a letter index by `steps` (may be negative), returning the new index (0-6) and the octave delta this carries. */
function stepLetter(startIndex: number, steps: number): { index: number; octaveDelta: number } {
  const raw = startIndex + steps;
  const octaveDelta = Math.floor(raw / 7);
  const index = raw - octaveDelta * 7;
  return { index, octaveDelta };
}

function transposeByLetterSteps(p: SpelledPitch, letterSteps: number, semitones: number): SpelledPitch {
  const { index, octaveDelta } = stepLetter(letterIndex(p.letter), letterSteps);
  const letter = LETTERS[index]!;
  const octave = p.octave + octaveDelta;
  const targetMidi = spelledToMidi(p) + semitones;
  const offset = targetMidi - naturalMidiFor(letter, octave);
  return { letter, acc: accidentalForOffset(offset), octave };
}

/** Transposes up by a diatonic interval — letters always advance by `number - 1` steps, octave carries as needed. */
export function transposeUp(p: SpelledPitch, interval: IntervalLike): SpelledPitch {
  return transposeByLetterSteps(p, interval.number - 1, interval.semitones);
}

/** Transposes down by a diatonic interval — the mirror of transposeUp. */
export function transposeDown(p: SpelledPitch, interval: IntervalLike): SpelledPitch {
  return transposeByLetterSteps(p, -(interval.number - 1), -interval.semitones);
}

export function spellingsEqual(a: SpelledPitch, b: SpelledPitch): boolean {
  return a.letter === b.letter && a.acc === b.acc && a.octave === b.octave;
}

const ACC_GLYPH: Record<Accidental, string> = { '': '', '#': '♯', b: '♭', '##': '𝄪', bb: '𝄫' };

/** Display label with unicode accidental glyphs (e.g. "F♯") — ASCII #/b stay the internal representation. */
export function spellingLabel(p: SpelledPitch): string {
  return `${p.letter}${ACC_GLYPH[p.acc]}`;
}

const PARSE_RE = /^([A-G])(##|bb|#|b)?(-?\d+)$/;

/** Test convenience: parseSpelling('F#4') -> { letter: 'F', acc: '#', octave: 4 }. */
export function parseSpelling(spec: string): SpelledPitch {
  const match = PARSE_RE.exec(spec);
  if (!match) throw new Error(`Cannot parse spelling: ${spec}`);
  const [, letter, acc, octave] = match;
  return { letter: letter!, acc: (acc ?? '') as Accidental, octave: Number(octave) };
}

/**
 * The only place lib/melody/theory.ts's NoteSpelling ({letter, accidental:
 * '#'|'b', octave}, absent field meaning natural) meets SpelledPitch — used
 * by the staff input components when reading what the shared armed-
 * accidental palette produced (docs/14 §1/§8a).
 */
export function fromNoteSpelling(letter: string, accidental: '#' | 'b' | undefined, octave: number): SpelledPitch {
  return { letter, acc: accidental ?? '', octave };
}
