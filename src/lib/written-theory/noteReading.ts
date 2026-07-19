// Tier-1 builder for Theory Topic 01 — Note Reading (docs/15-theory-topics/01).
// Staff-position math (lineToLetterOctave/NATURAL_LETTERS) is lib/melody/
// theory.ts's shared clef+line geometry, not spelling math — reusing it here
// is the intended use of docs/14 §6's clef extension, distinct from
// spelledPitch.ts's own independence rule (which is only about not
// duplicating the pc/letter tables via a redundant import path).
import { lineToLetterOctave, NATURAL_LETTERS, type Clef } from '../melody/theory';
import { pick, random } from '../theory';
import type { Accidental, SpelledPitch } from './spelledPitch';

// Structurally identical to components/GroupedChoiceGrid's GroupedChoiceGroup
// — declared locally, not imported, since src/lib may not import from
// src/components (Tier-1 firewall, D15). The Tier-2 topic component passes
// this straight into <GroupedChoiceGrid groups={...}> unchanged.
export interface NoteReadingChoiceGroup {
  title: string;
  items: { id: string; label: string }[];
}

export type NoteReadingRange = 'staffOnly' | 'ledger2' | 'ledger4';
export type NoteReadingAccidentalMode = 'naturalsOnly' | 'naturalsAndAccidentals';

export interface NoteReadingSettings extends Record<string, unknown> {
  clefs: Clef[];
  range: NoteReadingRange;
  accidentals: NoteReadingAccidentalMode;
  octaveNumbers: boolean;
  autoAdvance: boolean;
}

export function defaultNoteReadingSettings(): NoteReadingSettings {
  return {
    clefs: ['treble', 'bass'],
    range: 'ledger2',
    accidentals: 'naturalsOnly',
    octaveNumbers: false,
    autoAdvance: false,
  };
}

// Staff lines 1-5 (staffLineFor's own convention); each "ledger line" widens
// the reachable window by one full line-position on each side.
const RANGE_EXTENSION: Record<NoteReadingRange, number> = { staffOnly: 0, ledger2: 2, ledger4: 4 };

function windowLines(range: NoteReadingRange): number[] {
  const ext = RANGE_EXTENSION[range];
  const lines: number[] = [];
  for (let line = 1 - ext; line <= 5 + ext; line += 0.5) lines.push(line);
  return lines;
}

export function answerId(spelling: SpelledPitch, octaveNumbers: boolean): string {
  return octaveNumbers ? `${spelling.letter}${spelling.acc}${spelling.octave}` : `${spelling.letter}${spelling.acc}`;
}

export interface NoteReadingQuestion {
  clef: Clef;
  spelling: SpelledPitch;
  answerId: string;
}

export function buildNoteReadingQuestion(settings: NoteReadingSettings): NoteReadingQuestion | null {
  if (!settings.clefs.length) return null;
  const clef = pick(settings.clefs);
  const line = pick(windowLines(settings.range));
  const { letterIndex, octave } = lineToLetterOctave(line, clef);
  const letter = NATURAL_LETTERS[letterIndex]!;
  let acc: Accidental = '';
  if (settings.accidentals === 'naturalsAndAccidentals' && random() < 0.5) {
    acc = pick<Accidental>(['#', 'b']);
  }
  const spelling: SpelledPitch = { letter, acc, octave };
  return { clef, spelling, answerId: answerId(spelling, settings.octaveNumbers) };
}

/** Every spelling reachable at a legal line position in this clef+range window (deduplicated). Used for the octave-numbers choice grid, which must list exactly what's answerable. */
export function reachableSpellings(
  clef: Clef,
  range: NoteReadingRange,
  accidentals: NoteReadingAccidentalMode,
): SpelledPitch[] {
  const accVariants: Accidental[] = accidentals === 'naturalsAndAccidentals' ? ['', '#', 'b'] : [''];
  const seen = new Set<string>();
  const out: SpelledPitch[] = [];
  for (const line of windowLines(range)) {
    const { letterIndex, octave } = lineToLetterOctave(line, clef);
    const letter = NATURAL_LETTERS[letterIndex]!;
    for (const acc of accVariants) {
      const key = `${letter}${acc}${octave}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ letter, acc, octave });
    }
  }
  return out;
}

const NATURAL_GROUP_LABEL = 'Naturals';
const SHARP_GROUP_LABEL = 'Sharps';
const FLAT_GROUP_LABEL = 'Flats';

function label(spelling: SpelledPitch, octaveNumbers: boolean): string {
  const glyph = spelling.acc === '#' ? '♯' : spelling.acc === 'b' ? '♭' : '';
  return `${spelling.letter}${glyph}${octaveNumbers ? spelling.octave : ''}`;
}

/**
 * The answer grid — binding layout (docs/15-theory-topics/01 §3): fixed 7
 * (naturals-only) or 21 (naturals+sharps+flats) buttons when octave numbers
 * are off; exactly the reachable spellings in the current clef+range window
 * when they're on. Always grouped Naturals / Sharps / Flats, in that order.
 */
export function buildNoteReadingChoiceGroups(
  clef: Clef,
  range: NoteReadingRange,
  accidentals: NoteReadingAccidentalMode,
  octaveNumbers: boolean,
): NoteReadingChoiceGroup[] {
  const pool = octaveNumbers
    ? reachableSpellings(clef, range, accidentals)
    : accidentals === 'naturalsAndAccidentals'
      ? NATURAL_LETTERS.flatMap((letter) =>
          (['', '#', 'b'] as Accidental[]).map((acc) => ({ letter, acc, octave: 0 })),
        )
      : NATURAL_LETTERS.map((letter) => ({ letter, acc: '' as Accidental, octave: 0 }));

  const byAcc = (acc: Accidental) =>
    pool
      .filter((p) => p.acc === acc)
      .sort((a, b) => a.letter.localeCompare(b.letter) || a.octave - b.octave)
      .map((p) => ({ id: answerId(p, octaveNumbers), label: label(p, octaveNumbers) }));

  const groups: NoteReadingChoiceGroup[] = [];
  const naturals = byAcc('');
  const sharps = byAcc('#');
  const flats = byAcc('b');
  if (naturals.length) groups.push({ title: NATURAL_GROUP_LABEL, items: naturals });
  if (sharps.length) groups.push({ title: SHARP_GROUP_LABEL, items: sharps });
  if (flats.length) groups.push({ title: FLAT_GROUP_LABEL, items: flats });
  return groups;
}
