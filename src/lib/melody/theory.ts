// New topic (docs/05-topics/07-melodic-dictation.md, docs/04-notation-engine.md
// Part B2/B5). Framework-free note model + key/clef/staff-geometry theory.

import { findPrecedingNote } from '../notation/placement';

// 'alto'/'tenor' added for theory reading (docs/14-theory-engine.md §6) — only
// consumed where a theory topic explicitly asks for a C clef; every existing
// aural-section settings UI continues to offer treble/bass only.
export type Clef = 'treble' | 'bass' | 'alto' | 'tenor';
export type KeyMode = 'major' | 'minor';

/**
 * A fully-pinned display spelling — letter, accidental, and the letter's own
 * octave (not necessarily the octave `Math.floor(midi/12)-1` would give: e.g.
 * B# sounds like the C above it, but still displays in B's octave). Storing
 * the letter (not just the accidental) is what stops e.g. a Sharp placed on
 * an E cursor line from silently collapsing into a plain "F" — the two are
 * the same pitch class, but only one is what the user actually asked for.
 */
export interface NoteSpelling {
  letter: string;
  /**
   * '#'/'b' for an accidental; '' for an *explicit* natural (only theory's
   * read-only display ever constructs this — docs/14-theory-engine.md §8a's
   * every-note-carries-an-explicit-spelling rule). Melodic dictation's own
   * click-to-place flow never needs '' — an unarmed placement simply omits
   * `spelling` entirely and lets spellMidi's per-key table resolve the
   * natural, which is correct there because it's always one of the 14
   * MELODY_KEYS. Theory topics can't rely on that fallback (their key
   * signatures aren't in that table), so they spell every note themselves,
   * naturals included.
   */
  accidental: '' | '#' | 'b';
  octave: number;
}

export interface PitchedNote {
  beat: number;
  duration: number;
  rest: boolean;
  midi: number | null;
  /** User's explicit spelling choice at placement (Sharp/Flat armed) — see spelling.ts's spelledToVexKey. Display only; never affects grading (MIDI-only). */
  spelling?: NoteSpelling;
  /** Tied to the immediately preceding note (same measure, or the previous measure's last note) — display only, never graded. */
  tied?: boolean;
}
export type PitchedMeasure = PitchedNote[];

export interface TiePreview {
  midi: number;
  spelling?: NoteSpelling;
  /** True when the note immediately preceding this position is tied forward into it — the pitch above is that note's, not the clicked one. */
  fromTiedPredecessor: boolean;
}

/**
 * What placing (or hovering) a note at `beat` would actually sound: a tied
 * note connects forward into the note in front of it, so if the note
 * immediately *preceding* this position (lib/notation/placement.ts's
 * findPrecedingNote — same measure, or the previous measure's last note for
 * a tie across the barline) carries `tied: true`, the note being placed here
 * is that tie's other end and must sound the same pitch — its pitch (and
 * spelling) get forced to the predecessor's, regardless of which line was
 * clicked. An untied/absent/rest predecessor just reports the clicked pitch
 * back unchanged. Shared by the actual commit (usePractice.ts's placeNoteAt)
 * and the hover ghost (VexStaffHost.tsx) so the preview can never show a
 * pitch the click wouldn't actually commit to.
 */
export function tiePreview(
  measures: readonly PitchedMeasure[],
  measureIndex: number,
  beat: number,
  clickedMidi: number,
): TiePreview {
  const preceding = findPrecedingNote(measures, measureIndex, beat);
  if (preceding && !preceding.note.rest && preceding.note.tied && preceding.note.midi !== null) {
    return { midi: preceding.note.midi, spelling: preceding.note.spelling, fromTiedPredecessor: true };
  }
  return { midi: clickedMidi, fromTiedPredecessor: false };
}

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

const CLEF_REFERENCE_LOW: Record<Clef, number> = { treble: 60, bass: 48, alto: 53, tenor: 48 }; // C4 / C3 / F3 / C3

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
// Matches VexFlow 5's own clefs table lineShift values exactly (verified in
// vexscore.test.ts) — alto/tenor added for theory reading (docs/14 §6).
const CLEF_LINE_SHIFT: Record<Clef, number> = { treble: 0, bass: 6, alto: 3, tenor: 4 };

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

export interface StaffPositionResolution {
  letterIndex: number;
  octave: number;
  naturalMidi: number;
}

/**
 * y-position -> staff position, inverting VexFlow's own getYForNote(kpLine)
 * === getYForLine(5 - kpLine) relationship using only the topLineY/spacing a
 * render pass already captured (no VexFlow instance needed at click time).
 * Shared by every staff host that lets a click/hover resolve a y-coordinate
 * to a pitch — VexStaffHost (melodic dictation) and the theory section's
 * SlotStaffInput/ChordStaffInput (docs/14-theory-engine.md §8). Returns the
 * bare natural position; callers apply their own accidental rule on top
 * (melodic dictation: armed-or-natural; theory: armed, else the key
 * signature's implied accidental, else natural — docs/14 §8a).
 */
export function resolveStaffPosition(y: number, topLineY: number, spacing: number, clef: Clef): StaffPositionResolution {
  const topConventionLine = (y - topLineY) / spacing;
  const kpLine = Math.round((5 - topConventionLine) * 2) / 2;
  const { letterIndex, octave } = lineToLetterOctave(kpLine, clef);
  return { letterIndex, octave, naturalMidi: naturalMidiFor(letterIndex, octave) };
}
