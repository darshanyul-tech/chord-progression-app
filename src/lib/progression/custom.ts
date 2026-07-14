import { mod12, noteName } from '../theory';
import { chordSymbol, qualityParts, scaleOf, tonicQualityForSettings, type ProgChord } from './theory';
import { familyExtToQuality } from './grading';
import type { ResolvedProgressionSettings } from './settings';
import { pcToDegree } from './generator';

// Ported from legacy custom-mode machinery (docs/05-topics/06 §2).
//
// FIXED BUG (user-approved, see IMPLEMENTATION-PROMPT escalation): legacy's
// makePlaceholderChord() references an undefined `sc` variable (should be
// `scaleOf(s)`, the exact pattern used by two sibling functions) and throws
// a ReferenceError the instant Custom Mode is toggled on, in every browser.
// This one-line fix makes Custom Mode actually work; no other behavior changes.
export function makePlaceholderChord(s: ResolvedProgressionSettings): ProgChord {
  const sc = scaleOf(s);
  const quality = tonicQualityForSettings(s);
  const parts = qualityParts(quality);
  return {
    degree: null,
    fn: 'tonic',
    rootPc: s.keyPc,
    rootName: s.key,
    quality,
    rootDegree: null,
    family: parts.family,
    ext: parts.ext,
    symbol: chordSymbol(s.key, quality),
    roman: sc.tonicRoman,
    inversion: 0,
    secondary: false,
  };
}

export function makePlaceholderProgression(s: ResolvedProgressionSettings): ProgChord[] {
  return Array.from({ length: s.bars }, () => makePlaceholderChord(s));
}

export interface GuessRowInput {
  off: number;
  fam: string;
  ext: number;
  inv: number | null;
  romanLabel: string;
}

export function chordFromGuessRow(row: GuessRowInput | undefined, s: ResolvedProgressionSettings): ProgChord | null {
  if (!row) return null;
  const { off, fam, ext, inv, romanLabel } = row;
  const quality = familyExtToQuality(fam, ext, s);
  const rootPc = mod12(s.keyPc + off);
  const rootName = noteName(rootPc);
  const parts = qualityParts(quality);
  const inversion = s.inversions && inv !== null ? inv : 0;
  return {
    degree: pcToDegree(s.keyPc, rootPc, s),
    fn: 'tonic',
    rootPc,
    rootName,
    quality,
    rootDegree: pcToDegree(s.keyPc, rootPc, s),
    family: parts.family,
    ext: parts.ext,
    symbol: chordSymbol(rootName, quality),
    roman: romanLabel,
    inversion: inversion || 0,
    secondary: false,
  };
}

export interface BuildFromGuessesResult {
  ok: boolean;
  message?: string;
  prog?: ProgChord[];
}

export function buildProgressionFromGuesses(
  rows: (GuessRowInput | undefined)[],
  s: ResolvedProgressionSettings,
): BuildFromGuessesResult {
  const prog: ProgChord[] = [];
  for (let i = 0; i < s.bars; i++) {
    const ch = chordFromGuessRow(rows[i], s);
    if (!ch) {
      return { ok: false, message: 'Set roman numeral, quality, and extension for each bar in Your Guess.' };
    }
    prog.push(ch);
  }
  return { ok: true, prog };
}
