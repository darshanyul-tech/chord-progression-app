import { mod12, noteName } from '../theory';
import {
  allowsSevenths,
  chordDisplay,
  chordSymbol,
  extensionRevealLabel,
  familyLabel,
  inversionLabel,
  scaleOf,
  type ProgChord,
} from './theory';
import type { ResolvedProgressionSettings } from './settings';

// Ported verbatim from legacy guess/grading section
// (docs/05-topics/06-chord-progressions.md §§1,3).

export interface SelectOption {
  value: number | string;
  label: string;
}

export const FAMILY_OPTS_FULL: SelectOption[] = [
  { value: 'maj', label: 'Major' },
  { value: 'min', label: 'Minor' },
  { value: 'dom', label: 'Dominant' },
  { value: 'halfdim', label: 'Half-diminished' },
  { value: 'dim', label: 'Diminished' },
];

export const FAMILY_OPTS_TRIAD: SelectOption[] = [
  { value: 'maj', label: 'Major' },
  { value: 'min', label: 'Minor' },
  { value: 'dim', label: 'Diminished' },
];

export const EXT_OPTS = [7, 9, 11, 13];

export function familyOptions(s: Pick<ResolvedProgressionSettings, 'extensions'>): SelectOption[] {
  return allowsSevenths(s) ? FAMILY_OPTS_FULL : FAMILY_OPTS_TRIAD;
}

export function familiesMatch(guessFam: string, chFam: string, s: Pick<ResolvedProgressionSettings, 'extensions'>): boolean {
  if (guessFam === chFam) return true;
  if (allowsSevenths(s)) return false;
  const majorType: Record<string, boolean> = { maj: true, dom: true };
  return !!majorType[guessFam] && !!majorType[chFam];
}

export function extensionOptions(s: Pick<ResolvedProgressionSettings, 'extensions'>): SelectOption[] {
  if (!allowsSevenths(s)) {
    return [{ value: 3, label: 'Triad' }];
  }
  const opts: SelectOption[] = [{ value: 7, label: '7th' }];
  EXT_OPTS.filter((e) => e !== 7).forEach((e) => {
    if (s.extensions.indexOf(e) >= 0) {
      opts.push({ value: e, label: `${e}th` });
    }
  });
  return opts.length > 1 ? opts : [{ value: 7, label: '7th' }];
}

export function degreeOptions(s: Pick<ResolvedProgressionSettings, 'scale'> & { chromaticism?: boolean }): SelectOption[] {
  const scale = scaleOf(s);
  if (s && s.chromaticism) {
    return scale.chromatic.map((label, off) => ({ value: off, label }));
  }
  return [1, 2, 3, 4, 5, 6, 7].map((d) => ({ value: scale.offsets[d - 1]!, label: scale.roman[d]! }));
}

export interface BarMatch {
  degOk: boolean;
  famOk: boolean;
  extOk: boolean;
  invOk: boolean;
  allOk: boolean;
}

export function gradeBarMatch(
  ch: ProgChord,
  off: number,
  fam: string,
  ext: number,
  invVal: number | null,
  s: ResolvedProgressionSettings,
): BarMatch {
  const degOk = mod12(s.keyPc + off) === ch.rootPc;
  const famOk = familiesMatch(fam, ch.family, s);
  const extOk = ext === ch.ext;
  const invOk = !s.inversions || invVal === null || invVal === (ch.inversion || 0);
  return { degOk, famOk, extOk, invOk, allOk: degOk && famOk && extOk && invOk };
}

export function describeBarAnswer(ch: ProgChord, s: ResolvedProgressionSettings): string {
  let t = `${ch.roman} · ${familyLabel(ch.family)} · ${extensionRevealLabel(ch.ext)} · ${chordDisplay(ch)}`;
  if (s.inversions) t += ` · ${inversionLabel(ch.inversion || 0)}`;
  return t;
}

export function familyExtToQuality(fam: string, ext: number, s?: Pick<ResolvedProgressionSettings, 'extensions'>): string {
  const e = ext || 7;
  const triadMode = s && !allowsSevenths(s);
  if (triadMode || e === 3) {
    if (fam === 'dim') return 'dim';
    if (fam === 'min') return 'm';
    return 'maj';
  }
  if (fam === 'halfdim') return 'm7b5';
  if (fam === 'dim') return 'dim7';
  if (fam === 'maj') {
    if (e >= 13) return 'maj13';
    if (e >= 11) return 'maj11';
    if (e >= 9) return 'maj9';
    return 'maj7';
  }
  if (fam === 'min') {
    if (e >= 13) return 'm13';
    if (e >= 11) return 'm11';
    if (e >= 9) return 'm9';
    return 'm7';
  }
  if (e >= 13) return '13';
  if (e >= 11) return '11';
  if (e >= 9) return '9';
  return '7';
}

export function describeBarGuess(
  off: number,
  fam: string,
  ext: number,
  invVal: number | null,
  s: ResolvedProgressionSettings,
  romanLabel: string,
): string {
  const qual = familyExtToQuality(fam, ext, s);
  const sym = chordSymbol(noteName(mod12(s.keyPc + off)), qual);
  let t = `${romanLabel} · ${sym}`;
  if (s.inversions && invVal !== null) t += ` · ${inversionLabel(invVal)}`;
  return t;
}
