// Arranging engine — chord symbol parser + chord-tone resolution (ARR spec §2.2–2.3).
// Symbol anatomy X-Y-Z: X = triad, Y = seventh & unaltered extensions, Z = alterations.

import { pitchClass, type Accidental, type Letter, type Spelling } from './pitch';

export type ChordQuality =
  | 'major'
  | 'minor'
  | 'dominant'
  | 'minor7b5'
  | 'diminished'
  | 'augmented'
  | 'sus';

export type SeventhType = 'b7' | 'maj7' | '6' | null;

export interface ParsedChord {
  root: number; // pitch class 0–11
  rootSpelling: { letter: Letter; accidental: Accidental };
  spelling: Spelling; // preferred enharmonic context for display
  quality: ChordQuality;
  seventh: SeventhType;
  extensions: number[]; // subset of [9, 11, 13] actually available
  alterations: string[]; // e.g. ['#11', 'b9']
  bass: number | null; // slash chords — pitch class of the bass note
  bassSpelling: { letter: Letter; accidental: Accidental } | null;
  isPolychord: boolean;
  upperChord: ParsedChord | null;
  canonical: string;
}

const LETTER_PC: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function accOffset(acc: Accidental): number {
  if (acc == null) return 0;
  return { bb: -2, b: -1, '#': 1, '##': 2 }[acc];
}

function accToUnicode(acc: Accidental): string {
  if (acc == null) return '';
  return acc.replace(/#/g, '♯').replace(/b/g, '♭');
}

function normalize(symbol: string): string {
  return symbol
    .trim()
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b')
    .replace(/[Δ∆]/g, 'maj')
    .replace(/[°º]/g, 'dim')
    .replace(/ø/g, 'm7b5')
    .replace(/\s+/g, '');
}

function parseRootToken(s: string): { pc: number; letter: Letter; accidental: Accidental; rest: string } | null {
  const m = /^([A-G])(##|bb|#|b)?/.exec(s);
  if (!m) return null;
  const letter = m[1] as Letter;
  const accidental = (m[2] as Accidental) ?? null;
  const pc = pitchClass(LETTER_PC[letter] + accOffset(accidental));
  return { pc, letter, accidental, rest: s.slice(m[0].length) };
}

function spellingFor(accidental: Accidental, letter: Letter): Spelling {
  if (accidental === 'b' || accidental === 'bb') return 'flat';
  if (accidental === '#' || accidental === '##') return 'sharp';
  // Naturals: F and the flat-leaning naturals default to flats; C/G/D default to sharps.
  return letter === 'F' ? 'flat' : 'sharp';
}

// A post-slash token is a plain bass note (letter + optional accidental and nothing
// else) → slash chord; anything with remaining quality/number characters → polychord.
function isPlainBassToken(token: string): boolean {
  return /^[A-G](##|bb|#|b)?$/.test(normalize(token));
}

function extractAlterations(s: string): string[] {
  const out: string[] = [];
  const re = /(#|b)(5|9|11|13)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) out.push(m[1]! + m[2]!);
  return out;
}

interface CoreParse {
  quality: ChordQuality;
  seventh: SeventhType;
  extensions: number[];
  alterations: string[];
}

function parseCore(rest: string): CoreParse {
  const alterations = extractAlterations(rest);

  // Major marker: maj / maj7 / ma7 / M7 / Δ (already normalized to 'maj').
  const majMarker = /maj|ma[6789]|M[6789]/.test(rest);
  // Quality markers checked in priority order below.
  const isMinor7b5 = /m(i|in)?7?b5/.test(rest);
  const isDim = /dim/.test(rest);
  const isAug = /aug|\+/.test(rest);
  const isSus = /sus/.test(rest);
  // With no major marker, any lowercase 'm' or '-' is a minor marker.
  const minMarker = !majMarker && (/m/.test(rest) || /-/.test(rest));

  // Detect natural extensions on a copy with alteration tokens stripped, so the
  // '9' in 'b9' isn't mistaken for a natural 9th.
  let cleanRest = rest;
  for (const alt of alterations) cleanRest = cleanRest.replace(alt, '');
  const has13 = /13/.test(cleanRest);
  const has11 = /11/.test(cleanRest);
  const has9 = /9/.test(cleanRest);
  const has7 = /7/.test(cleanRest);
  const has6 = /6/.test(cleanRest);

  // Highest stacked function implies the lower ones (13 ⇒ 9,11,13).
  let extensions: number[] = [];
  if (has13) extensions = [9, 11, 13];
  else if (has11) extensions = [9, 11];
  else if (has9) extensions = [9];

  let seventh: SeventhType;
  if (majMarker) seventh = 'maj7';
  else if (has6 && !has7 && extensions.length === 0) seventh = '6';
  else if (has7 || extensions.length > 0) seventh = 'b7';
  else seventh = null;

  let quality: ChordQuality;
  if (isMinor7b5) quality = 'minor7b5';
  else if (isDim) quality = 'diminished';
  else if (isAug) quality = 'augmented';
  else if (isSus) quality = 'sus';
  else if (minMarker) quality = 'minor';
  else if (majMarker) quality = 'major';
  else if (seventh === 'b7' || extensions.length > 0) quality = 'dominant';
  else quality = 'major';

  // The 5th alteration that defines these qualities is inherent, not a colour alteration.
  let outAlterations = alterations;
  if (quality === 'minor7b5' || quality === 'diminished') outAlterations = alterations.filter((a) => a !== 'b5');
  else if (quality === 'augmented') outAlterations = alterations.filter((a) => a !== '#5');

  return { quality, seventh, extensions, alterations: outAlterations };
}

function canonicalCore(core: CoreParse): string {
  const { quality, seventh, extensions } = core;
  const topExt = extensions.length ? Math.max(...extensions) : seventh === 'b7' || seventh === 'maj7' ? 7 : seventh === '6' ? 6 : null;
  const num = topExt ?? '';
  let body: string;
  switch (quality) {
    case 'minor':
      body = seventh || extensions.length ? `mi${num}` : 'mi';
      break;
    case 'minor7b5':
      body = 'mi7♭5';
      break;
    case 'diminished':
      body = seventh ? '°7' : '°';
      break;
    case 'augmented':
      body = seventh ? `+${num}` : '+';
      break;
    case 'sus':
      body = `${num || 7}sus4`;
      break;
    case 'major':
      body = seventh === 'maj7' ? `ma${num || 7}` : seventh === '6' ? '6' : num ? `ma${num}` : '';
      break;
    case 'dominant':
    default:
      body = `${num || 7}`;
      break;
  }
  return body;
}

/** Parse a chord symbol into canonical structured form. Returns null for junk input. */
export function parseChord(symbol: string): ParsedChord | null {
  const raw = normalize(symbol);
  if (!raw) return null;

  // Polychord vs slash bass.
  const slashIdx = raw.lastIndexOf('/');
  let head = raw;
  let bass: number | null = null;
  let bassSpelling: { letter: Letter; accidental: Accidental } | null = null;
  let isPolychord = false;
  let upperChord: ParsedChord | null = null;

  if (slashIdx > 0) {
    const before = raw.slice(0, slashIdx);
    const after = raw.slice(slashIdx + 1);
    if (isPlainBassToken(after)) {
      // Slash bass: the chord is the part before the slash, over a bass note.
      head = before;
      const b = parseRootToken(after);
      if (b) {
        bass = b.pc;
        bassSpelling = { letter: b.letter, accidental: b.accidental };
      }
    } else {
      // Polychord "upper/lower": the part after the slash is the foundation
      // (this ParsedChord), the part before it is the upper structure.
      isPolychord = true;
      head = after;
      upperChord = parseChord(before);
    }
  }

  const rootTok = parseRootToken(head);
  if (!rootTok) return null;
  const core = parseCore(rootTok.rest);

  const rootStr = `${rootTok.letter}${accToUnicode(rootTok.accidental)}`;
  const body = canonicalCore(core);
  const altStr = core.alterations.length
    ? `(${core.alterations.map((a) => a.replace('#', '♯').replace('b', '♭')).join('')})`
    : '';
  let canonical = `${rootStr}${body}${altStr}`;
  if (isPolychord && upperChord) canonical = `${upperChord.canonical}/${canonical}`;
  else if (bass != null && bassSpelling) canonical = `${canonical}/${bassSpelling.letter}${accToUnicode(bassSpelling.accidental)}`;

  return {
    root: rootTok.pc,
    rootSpelling: { letter: rootTok.letter, accidental: rootTok.accidental },
    spelling: spellingFor(rootTok.accidental, rootTok.letter),
    quality: core.quality,
    seventh: core.seventh,
    extensions: core.extensions,
    alterations: core.alterations,
    bass,
    bassSpelling,
    isPolychord,
    upperChord,
    canonical,
  };
}

// ---- Chord-tone resolution (§2.3) ----

export type Degree = '1' | '3' | '5' | '7' | '9' | '11' | '13' | '#11' | 'b9' | '#9' | 'b13' | '#5' | 'b5';

/** Semitone offset above the root for each degree, given the chord quality. */
function degreeSemitone(chord: ParsedChord, degree: string): number | null {
  const q = chord.quality;
  switch (degree) {
    case '1':
      return 0;
    case '3':
      if (q === 'minor' || q === 'minor7b5' || q === 'diminished') return 3;
      if (q === 'sus') return 5; // sus4 replaces the 3rd with the 4th
      return 4;
    case '5':
      if (q === 'diminished' || q === 'minor7b5') return 6;
      if (q === 'augmented') return 8;
      return 7;
    case '7':
      if (chord.seventh === 'maj7') return 11;
      if (chord.seventh === '6') return 9;
      if (q === 'diminished') return 9; // fully-diminished 7th
      return 10; // small (minor) 7th — assumed present in extended chords
    case '9':
      return 2;
    case '11':
      return 5;
    case '13':
      return 9;
    // altered / colour tones
    case 'b9':
      return 1;
    case '#9':
      return 3;
    case '#11':
      return 6;
    case 'b13':
      return 8;
    case '#5':
      return 8;
    case 'b5':
      return 6;
    default:
      return null;
  }
}

export interface ChordTones {
  [degree: string]: number; // degree label → pitch class
}

/** All available chord tones as pitch classes. Alterations replace their natural (#11 replaces 11). */
export function chordTones(chord: ParsedChord): ChordTones {
  const out: ChordTones = {};
  const add = (deg: string) => {
    const semi = degreeSemitone(chord, deg);
    if (semi != null) out[deg] = pitchClass(chord.root + semi);
  };
  add('1');
  add('3');
  add('5');
  if (chord.seventh) add('7');

  const alteredNumbers = new Set(chord.alterations.map((a) => a.replace(/[#b]/, '')));
  for (const ext of chord.extensions) {
    if (alteredNumbers.has(String(ext))) continue; // replaced by its alteration
    add(String(ext));
  }
  for (const alt of chord.alterations) out[alt] = pitchClass(chord.root + degreeSemitone(chord, alt)!);
  return out;
}

/** Which degree (if any) a MIDI/pitch matches within a chord. */
export function degreeOf(chord: ParsedChord, midi: number): string {
  const pc = pitchClass(midi);
  const tones = chordTones(chord);
  for (const [deg, tonePc] of Object.entries(tones)) {
    if (tonePc === pc) return deg;
  }
  return 'non-chord-tone';
}

// Expendability ranking (§2.3): root most expendable (bass supplies it), then 5th,
// then colour tones; 3rd and 7th are essential (define quality/function).
export const EXPENDABILITY: Record<string, number> = {
  '1': 5,
  '5': 4,
  '9': 3,
  '11': 3,
  '13': 3,
  '#11': 3,
  'b9': 3,
  '#9': 3,
  'b13': 3,
  '3': 0,
  '7': 0,
};

/** Higher = more expendable. Essential tones (3, 7) score 0. */
export function expendability(degree: string): number {
  return EXPENDABILITY[degree] ?? 2;
}
