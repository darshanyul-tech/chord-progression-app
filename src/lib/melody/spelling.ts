import { NATURAL_LETTERS, NATURAL_PC, type KeyDef } from './theory';

// Pitch spelling rule (docs/04-notation-engine.md §B3): a per-key pc→spelling
// lookup table, generated once and unit-tested — never ad-hoc logic at call
// sites. VexFlow's Accidental.applyAccidentals (fed the same key signature)
// decides whether an accidental glyph is actually drawn; this module only
// picks the letter+accidental, never a rendered glyph.

export type AccidentalStr = '' | '#' | 'b';

export interface SpelledPitch {
  letter: string;
  accidental: AccidentalStr;
  octave: number;
}

const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

function letterAccidentalsForSignature(numSharps: number, numFlats: number): Record<string, AccidentalStr> {
  const acc: Record<string, AccidentalStr> = { C: '', D: '', E: '', F: '', G: '', A: '', B: '' };
  for (let i = 0; i < numSharps; i++) acc[SHARP_ORDER[i]!] = '#';
  for (let i = 0; i < numFlats; i++) acc[FLAT_ORDER[i]!] = 'b';
  return acc;
}

export interface KeySpellingTable {
  [pc: number]: { letter: string; accidental: AccidentalStr };
}

/**
 * Builds the 12-pc spelling table for one key signature (shared by a major
 * key and its relative natural minor, since they use the same signature).
 * Diatonic pcs spell as their key-signature letter; the remaining pcs either
 * cancel a letter that was altered away from its natural pc (courtesy
 * natural) or alter the nearest natural-letter neighbor by a single
 * accidental, tie-broken toward sharpKey's preference (B3).
 */
export function buildKeySpellingTable(numSharps: number, numFlats: number, sharpKey: boolean): KeySpellingTable {
  const letterAcc = letterAccidentalsForSignature(numSharps, numFlats);
  const table: KeySpellingTable = {};

  NATURAL_LETTERS.forEach((letter) => {
    const off = letterAcc[letter] === '#' ? 1 : letterAcc[letter] === 'b' ? -1 : 0;
    const pc = mod12(NATURAL_PC[letter]! + off);
    table[pc] = { letter, accidental: letterAcc[letter]! };
  });

  for (let pc = 0; pc < 12; pc++) {
    if (table[pc]) continue;
    const cancelled = NATURAL_LETTERS.find((letter) => NATURAL_PC[letter] === pc);
    if (cancelled) {
      table[pc] = { letter: cancelled, accidental: '' };
      continue;
    }
    if (sharpKey) {
      const letter = NATURAL_LETTERS.find((l) => mod12(NATURAL_PC[l]! + 1) === pc)!;
      table[pc] = { letter, accidental: '#' };
    } else {
      const letter = NATURAL_LETTERS.find((l) => mod12(NATURAL_PC[l]! - 1) === pc)!;
      table[pc] = { letter, accidental: 'b' };
    }
  }
  return table;
}

const SIGNATURE_CACHE = new Map<string, KeySpellingTable>();

function signatureFor(key: KeyDef): { numSharps: number; numFlats: number } {
  // Matches vexflow/src/tables.ts keySignatures exactly for our 14 keys.
  const SHARPS: Record<string, number> = { C: 0, G: 1, D: 2, A: 3, E: 4, Am: 0, Em: 1 };
  const FLATS: Record<string, number> = { F: 1, Bb: 2, Eb: 3, Ab: 4, Dm: 1, Gm: 2, Cm: 3 };
  return { numSharps: SHARPS[key.id] ?? 0, numFlats: FLATS[key.id] ?? 0 };
}

export function spellingTableFor(key: KeyDef): KeySpellingTable {
  const cached = SIGNATURE_CACHE.get(key.id);
  if (cached) return cached;
  const { numSharps, numFlats } = signatureFor(key);
  const table = buildKeySpellingTable(numSharps, numFlats, key.sharpKey);
  SIGNATURE_CACHE.set(key.id, table);
  return table;
}

export function spellMidi(midi: number, key: KeyDef): SpelledPitch {
  const pc = mod12(midi);
  const octave = Math.floor(midi / 12) - 1;
  const { letter, accidental } = spellingTableFor(key)[pc]!;
  return { letter, accidental, octave };
}

/** VexFlow `keys` array entry format, e.g. "f#/4", "bb/3", "c/4". */
export function spelledToVexKey(spelled: SpelledPitch): string {
  return `${spelled.letter.toLowerCase()}${spelled.accidental}/${spelled.octave}`;
}

export function midiToVexKey(midi: number, key: KeyDef): string {
  return spelledToVexKey(spellMidi(midi, key));
}
