// Arranging engine — upper structure triads for extended dominants (ARR spec §5.4).
// Uses the AMENDED week-10 table (the week-9 version had errors; the amended one
// adds D minor). Stored structured so both question directions generate from it.

import { midiToDisplay, pitchClass, type Spelling } from './pitch';

export interface UstRow {
  id: string;
  roman: string; // upper-structure number, e.g. 'II', 'i', '♭III'
  quality: 'major' | 'minor';
  semitonesAboveRoot: number; // triad root interval above the dominant root
  triadNotes: number[]; // semitone offsets of the triad tones above the dominant root
  tensions: string; // implied tensions on the dominant, e.g. '9, ♯11, 13'
  symbol: string; // resulting chord symbol relative to C, e.g. 'C13(♯11)'
  needsBassRoot?: boolean; // ♭V caveat
}

const MAJOR = [0, 4, 7];
const MINOR = [0, 3, 7];

// Offsets & symbols expressed relative to a C7 foundation.
export const UST_TABLE: UstRow[] = [
  { id: 'I', roman: 'I', quality: 'major', semitonesAboveRoot: 0, triadNotes: MAJOR, tensions: 'root, 3, 5', symbol: 'C7' },
  { id: 'i', roman: 'i', quality: 'minor', semitonesAboveRoot: 0, triadNotes: MINOR, tensions: 'root, ♭3, 5', symbol: 'C7(♯9)' },
  { id: 'II', roman: 'II', quality: 'major', semitonesAboveRoot: 2, triadNotes: MAJOR, tensions: '9, ♯11, 13', symbol: 'C13(♯11)' },
  { id: 'ii', roman: 'ii', quality: 'minor', semitonesAboveRoot: 2, triadNotes: MINOR, tensions: '9, 11, 13', symbol: 'C13' },
  { id: 'bii', roman: '♭ii', quality: 'minor', semitonesAboveRoot: 1, triadNotes: MINOR, tensions: '♭9, 3, ♯11', symbol: 'C7(♭9♭13)' },
  { id: 'bIII', roman: '♭III', quality: 'major', semitonesAboveRoot: 3, triadNotes: MAJOR, tensions: '♯9, 5, ♭7', symbol: 'C7(♯9)' },
  { id: 'biii', roman: '♭iii', quality: 'minor', semitonesAboveRoot: 3, triadNotes: MINOR, tensions: '♯9, ♭5, ♭7', symbol: 'C7(♯9♯11)' },
  { id: 'sharpIV', roman: '♯IV', quality: 'major', semitonesAboveRoot: 6, triadNotes: MAJOR, tensions: '♯11, ♭7, ♭9', symbol: 'C7(♭9♯11)' },
  { id: 'sharpiv', roman: '♯iv', quality: 'minor', semitonesAboveRoot: 6, triadNotes: MINOR, tensions: '♯11, 13, ♭9', symbol: 'C13(♭9♯11)' },
  { id: 'VI', roman: 'VI', quality: 'major', semitonesAboveRoot: 9, triadNotes: MAJOR, tensions: '13, ♯9, 3', symbol: 'C13(♭9)' },
  { id: 'vi', roman: 'vi', quality: 'minor', semitonesAboveRoot: 9, triadNotes: MINOR, tensions: '13, root, 3', symbol: 'C13' },
  { id: 'bVI', roman: '♭VI', quality: 'major', semitonesAboveRoot: 8, triadNotes: MAJOR, tensions: '♯5, root, ♯9', symbol: 'C7(♯5♯9)' },
  {
    id: 'bV',
    roman: '♭V',
    quality: 'major',
    semitonesAboveRoot: 6,
    triadNotes: MAJOR,
    tensions: '♭9, ♯11',
    symbol: 'C7(♭9♯11)',
    needsBassRoot: true,
  },
];

/** The upper triad's pitch classes for a given dominant root. */
export function ustTriadPitchClasses(row: UstRow, dominantRoot: number): number[] {
  return row.triadNotes.map((semi) => pitchClass(dominantRoot + row.semitonesAboveRoot + semi));
}

/** Display the upper triad as a symbol, e.g. "D" or "E♭m", for a given dominant root. */
export function ustTriadSymbol(row: UstRow, dominantRoot: number, spelling: Spelling = 'flat'): string {
  const triadRoot = pitchClass(dominantRoot + row.semitonesAboveRoot);
  const rootName = midiToDisplay(60 + triadRoot, spelling, false);
  return `${rootName}${row.quality === 'minor' ? 'm' : ''}`;
}

/** All UST rows whose resulting symbol matches (a symbol may list more than one triad). */
export function ustRowsForSymbol(symbol: string): UstRow[] {
  const norm = symbol.replace(/\s/g, '');
  return UST_TABLE.filter((r) => r.symbol.replace(/\s/g, '') === norm);
}
