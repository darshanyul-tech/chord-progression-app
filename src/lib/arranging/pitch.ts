// Arranging engine — pitch representation (ARR spec §2.1).
// Framework-free, no DOM. MIDI note numbers internally, C4 = middle C = 60.

export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
export type Accidental = 'bb' | 'b' | null | '#' | '##';

export interface NoteName {
  letter: Letter;
  accidental: Accidental;
  octave: number;
}

/** Contextual spelling: a voicing on D♭7 displays flats (spec §2.1 "flexible enharmonic spelling"). */
export type Spelling = 'sharp' | 'flat';

const LETTER_SEMITONE: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACCIDENTAL_OFFSET: Record<NonNullable<Accidental> | 'natural', number> = {
  bb: -2,
  b: -1,
  natural: 0,
  '#': 1,
  '##': 2,
};

const SHARP_SPELLINGS: { letter: Letter; accidental: Accidental }[] = [
  { letter: 'C', accidental: null },
  { letter: 'C', accidental: '#' },
  { letter: 'D', accidental: null },
  { letter: 'D', accidental: '#' },
  { letter: 'E', accidental: null },
  { letter: 'F', accidental: null },
  { letter: 'F', accidental: '#' },
  { letter: 'G', accidental: null },
  { letter: 'G', accidental: '#' },
  { letter: 'A', accidental: null },
  { letter: 'A', accidental: '#' },
  { letter: 'B', accidental: null },
];

const FLAT_SPELLINGS: { letter: Letter; accidental: Accidental }[] = [
  { letter: 'C', accidental: null },
  { letter: 'D', accidental: 'b' },
  { letter: 'D', accidental: null },
  { letter: 'E', accidental: 'b' },
  { letter: 'E', accidental: null },
  { letter: 'F', accidental: null },
  { letter: 'G', accidental: 'b' },
  { letter: 'G', accidental: null },
  { letter: 'A', accidental: 'b' },
  { letter: 'A', accidental: null },
  { letter: 'B', accidental: 'b' },
  { letter: 'B', accidental: null },
];

/** MIDI → {letter, accidental, octave}. Spelling chooses sharp vs flat for the black keys. */
export function midiToName(midi: number, spelling: Spelling = 'sharp'): NoteName {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const table = spelling === 'flat' ? FLAT_SPELLINGS : SHARP_SPELLINGS;
  const { letter, accidental } = table[pc]!;
  return { letter, accidental, octave };
}

/** {letter, accidental, octave} → MIDI integer. */
export function nameToMidi(name: NoteName): number {
  const base = LETTER_SEMITONE[name.letter];
  const acc = name.accidental == null ? 0 : ACCIDENTAL_OFFSET[name.accidental];
  return base + acc + (name.octave + 1) * 12;
}

/** Render a note name for display, e.g. "E♭4" or "F♯3". */
export function formatNoteName(name: NoteName, showOctave = true): string {
  const acc = name.accidental == null ? '' : name.accidental.replace(/#/g, '♯').replace(/b/g, '♭');
  return `${name.letter}${acc}${showOctave ? name.octave : ''}`;
}

/** Convenience: MIDI → display string in the given spelling. */
export function midiToDisplay(midi: number, spelling: Spelling = 'sharp', showOctave = true): string {
  return formatNoteName(midiToName(midi, spelling), showOctave);
}

// Semitone → traditional interval name, 0..24 (covers everything the rules layer
// reasons about: m9 = 13, M6 = 9, P4 = 5, octave = 12, 10th = 15/16, etc.).
const INTERVAL_NAMES: { name: string; quality: string; number: number }[] = [
  { name: 'P1', quality: 'perfect', number: 1 },
  { name: 'm2', quality: 'minor', number: 2 },
  { name: 'M2', quality: 'major', number: 2 },
  { name: 'm3', quality: 'minor', number: 3 },
  { name: 'M3', quality: 'major', number: 3 },
  { name: 'P4', quality: 'perfect', number: 4 },
  { name: 'TT', quality: 'tritone', number: 4 },
  { name: 'P5', quality: 'perfect', number: 5 },
  { name: 'm6', quality: 'minor', number: 6 },
  { name: 'M6', quality: 'major', number: 6 },
  { name: 'm7', quality: 'minor', number: 7 },
  { name: 'M7', quality: 'major', number: 7 },
  { name: 'P8', quality: 'perfect', number: 8 },
  { name: 'm9', quality: 'minor', number: 9 },
  { name: 'M9', quality: 'major', number: 9 },
  { name: 'm10', quality: 'minor', number: 10 },
  { name: 'M10', quality: 'major', number: 10 },
  { name: 'P11', quality: 'perfect', number: 11 },
  { name: 'A11', quality: 'augmented', number: 11 },
  { name: 'P12', quality: 'perfect', number: 12 },
  { name: 'm13', quality: 'minor', number: 13 },
  { name: 'M13', quality: 'major', number: 13 },
  { name: 'm14', quality: 'minor', number: 14 },
  { name: 'M14', quality: 'major', number: 14 },
  { name: 'P15', quality: 'perfect', number: 15 },
];

export interface Interval {
  semitones: number;
  quality: string;
  number: number;
  compound: boolean;
  name: string;
}

/** Interval between two MIDI notes (absolute distance). */
export function interval(lowMidi: number, highMidi: number): Interval {
  const semitones = Math.abs(highMidi - lowMidi);
  const compound = semitones > 12;
  const entry = INTERVAL_NAMES[semitones] ?? INTERVAL_NAMES[semitones % 12]!;
  return { semitones, quality: entry.quality, number: entry.number, compound, name: entry.name };
}

/** Pitch class (0–11) of a MIDI note. */
export function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12;
}
