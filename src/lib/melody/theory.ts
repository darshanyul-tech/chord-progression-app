// New topic (docs/05-topics/07-melodic-dictation.md, docs/04-notation-engine.md
// Part B2/B5). Framework-free note model + key/clef/staff-geometry theory.

export type Clef = 'treble' | 'bass';
export type KeyMode = 'major' | 'minor';

export interface PitchedNote {
  beat: number;
  duration: number;
  rest: boolean;
  midi: number | null;
}
export type PitchedMeasure = PitchedNote[];

export interface KeyDef {
  id: string;
  tonicPc: number;
  mode: KeyMode;
  /** VexFlow key-signature spec string (matches vexflow/tables.ts keySignatures exactly). */
  vexKeySpec: string;
  /** Tie-break for chromatic spelling (B3): sharp keys prefer #, flat keys and C/Am prefer b. */
  sharpKey: boolean;
}

// The 9 majors + 5 minors named in topic doc 07 §2 (key signature range ±4 accidentals).
export const MELODY_KEYS: KeyDef[] = [
  { id: 'C', tonicPc: 0, mode: 'major', vexKeySpec: 'C', sharpKey: false },
  { id: 'G', tonicPc: 7, mode: 'major', vexKeySpec: 'G', sharpKey: true },
  { id: 'D', tonicPc: 2, mode: 'major', vexKeySpec: 'D', sharpKey: true },
  { id: 'A', tonicPc: 9, mode: 'major', vexKeySpec: 'A', sharpKey: true },
  { id: 'E', tonicPc: 4, mode: 'major', vexKeySpec: 'E', sharpKey: true },
  { id: 'F', tonicPc: 5, mode: 'major', vexKeySpec: 'F', sharpKey: false },
  { id: 'Bb', tonicPc: 10, mode: 'major', vexKeySpec: 'Bb', sharpKey: false },
  { id: 'Eb', tonicPc: 3, mode: 'major', vexKeySpec: 'Eb', sharpKey: false },
  { id: 'Ab', tonicPc: 8, mode: 'major', vexKeySpec: 'Ab', sharpKey: false },
  { id: 'Am', tonicPc: 9, mode: 'minor', vexKeySpec: 'Am', sharpKey: false },
  { id: 'Em', tonicPc: 4, mode: 'minor', vexKeySpec: 'Em', sharpKey: true },
  { id: 'Dm', tonicPc: 2, mode: 'minor', vexKeySpec: 'Dm', sharpKey: false },
  { id: 'Gm', tonicPc: 7, mode: 'minor', vexKeySpec: 'Gm', sharpKey: false },
  { id: 'Cm', tonicPc: 0, mode: 'minor', vexKeySpec: 'Cm', sharpKey: false },
];

export function keyById(id: string): KeyDef {
  const key = MELODY_KEYS.find((k) => k.id === id);
  if (!key) throw new Error(`Unknown melody key: ${id}`);
  return key;
}

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const NATURAL_MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10];

function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

/** Diatonic pitch classes of the key (natural minor for minor keys, §3.3). */
export function diatonicPcs(key: KeyDef): number[] {
  const steps = key.mode === 'major' ? MAJOR_STEPS : NATURAL_MINOR_STEPS;
  return steps.map((s) => mod12(key.tonicPc + s));
}

/** Ascending MIDI values, within [lowMidi, highMidi], whose pitch class is diatonic to the key. */
export function scaleDegreePool(key: KeyDef, lowMidi: number, highMidi: number): number[] {
  const pcs = new Set(diatonicPcs(key));
  const pool: number[] = [];
  for (let m = lowMidi; m <= highMidi; m++) {
    if (pcs.has(mod12(m))) pool.push(m);
  }
  return pool;
}

export interface RangeWindow {
  lowMidi: number;
  highMidi: number;
}

export type MelodyRange = 'narrow' | 'medium' | 'wide';

const CLEF_REFERENCE_LOW: Record<Clef, number> = { treble: 60, bass: 48 }; // C4 / C3

/** Anchors the tonic to the clef's reference octave band, then extends the range per §2. */
export function resolveRangeWindow(key: KeyDef, clef: Clef, range: MelodyRange): RangeWindow {
  // CLEF_REFERENCE_LOW is always a C, so adding the tonic's pitch class lands
  // it within [refLow, refLow + 11] — the clef's reference octave band.
  const tonicMidi = CLEF_REFERENCE_LOW[clef] + key.tonicPc;
  const span = range === 'narrow' ? 12 : range === 'medium' ? 16 : 24;
  return { lowMidi: tonicMidi, highMidi: tonicMidi + span };
}

// --- Staff geometry (04-notation-engine.md §B5) — independent of key/spelling,
// purely a function of clef + natural letter + octave, matching VexFlow's own
// keyProperties() line convention (1 = bottom staff line, 5 = top) so
// stave.getYForNote(line) can be used directly for both directions.
export const NATURAL_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export const NATURAL_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const CLEF_LINE_SHIFT: Record<Clef, number> = { treble: 0, bass: 6 };

export function staffLineFor(letterIndex: number, octave: number, clef: Clef): number {
  const baseIndex = (octave - 4) * 7;
  return (baseIndex + letterIndex) / 2 + CLEF_LINE_SHIFT[clef];
}

export function lineToLetterOctave(line: number, clef: Clef): { letterIndex: number; octave: number } {
  const raw = Math.round(2 * (line - CLEF_LINE_SHIFT[clef]));
  const letterIndex = ((raw % 7) + 7) % 7;
  const octave = (raw - letterIndex) / 7 + 4;
  return { letterIndex, octave };
}

export function naturalMidiFor(letterIndex: number, octave: number): number {
  return (octave + 1) * 12 + NATURAL_PC[NATURAL_LETTERS[letterIndex]!]!;
}
