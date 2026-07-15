import { mod12, noteName, pick, random } from '../theory';

// Ported verbatim from legacy jazz-progression-trainer-rhythm.html
// (docs/05-topics/06-chord-progressions.md). Progression's own copy of
// tables/helpers — deliberately not shared with recognition topics (D15).

export interface ScaleDef {
  offsets: number[];
  quality: Record<number, string>;
  roman: Record<number, string>;
  tonicQuality: string;
  tonicRoman: string;
  chromatic: string[];
}

export const SCALES: Record<'major' | 'minor', ScaleDef> = {
  major: {
    offsets: [0, 2, 4, 5, 7, 9, 11],
    quality: { 1: 'maj7', 2: 'm7', 3: 'm7', 4: 'maj7', 5: '7', 6: 'm7', 7: 'm7b5' },
    roman: { 1: 'I', 2: 'ii', 3: 'iii', 4: 'IV', 5: 'V', 6: 'vi', 7: 'viiø' },
    tonicQuality: 'maj7',
    tonicRoman: 'I',
    chromatic: ['I', 'bII', 'II', 'bIII', 'III', 'IV', '#IV', 'V', 'bVI', 'VI', 'bVII', 'VII'],
  },
  minor: {
    offsets: [0, 2, 3, 5, 7, 8, 10],
    quality: { 1: 'm7', 2: 'm7b5', 3: 'maj7', 4: 'm7', 5: 'm7', 6: 'maj7', 7: 'maj7' },
    roman: { 1: 'i', 2: 'iiø', 3: 'bIII', 4: 'iv', 5: 'v', 6: 'bVI', 7: 'bVII' },
    tonicQuality: 'm7',
    tonicRoman: 'i',
    chromatic: ['i', 'bII', 'ii', 'bIII', 'III', 'iv', '#iv', 'v', 'bVI', 'VI', 'bVII', 'VII'],
  },
};

export const MAJOR_SCALE = SCALES.major.offsets;

export const FUNCTIONS: Record<string, number[]> = {
  tonic: [1, 3, 6],
  subdominant: [2, 4],
  dominant: [5, 7],
};

export const FLOW: Record<string, string[]> = {
  start: ['tonic', 'subdominant', 'tonic'],
  tonic: ['subdominant', 'subdominant', 'dominant', 'tonic'],
  subdominant: ['dominant', 'dominant', 'tonic', 'subdominant'],
  dominant: ['tonic', 'tonic', 'subdominant'],
};

export const RECIPES: Record<string, number[]> = {
  maj7: [0, 4, 7, 11],
  maj9: [0, 4, 7, 11, 14],
  maj11: [0, 4, 7, 11, 14, 17],
  maj13: [0, 4, 7, 11, 14, 21],
  '7': [0, 4, 7, 10],
  '9': [0, 4, 7, 10, 14],
  '11': [0, 4, 7, 10, 14, 17],
  '13': [0, 4, 7, 10, 14, 21],
  m7: [0, 3, 7, 10],
  m9: [0, 3, 7, 10, 14],
  m11: [0, 3, 7, 10, 14, 17],
  m13: [0, 3, 7, 10, 14, 21],
  m7b5: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
  maj: [0, 4, 7],
  m: [0, 3, 7],
  dim: [0, 3, 6],
  dom: [0, 4, 7],
};

export interface HarmonySettings {
  keyPc: number;
  tonality: 'major' | 'minor';
  scale: ScaleDef;
  minorVm7: boolean;
  minorV7: boolean;
  extensions: number[];
  inversions: boolean;
  rootless: boolean;
}

export function scaleOf(s: Pick<HarmonySettings, 'scale'> | null | undefined): ScaleDef {
  return s && s.scale ? s.scale : SCALES.major;
}

export function degreePc(keyPc: number, degree: number, s: Pick<HarmonySettings, 'scale'>): number {
  return mod12(keyPc + scaleOf(s).offsets[degree - 1]!);
}

export function isMinorTonality(s: Pick<HarmonySettings, 'tonality'> | null | undefined): boolean {
  return !!s && s.tonality === 'minor';
}

export function minorDominantQualities(
  s: Pick<HarmonySettings, 'minorVm7' | 'minorV7'>,
): { quality: string; roman: string }[] {
  const opts: { quality: string; roman: string }[] = [];
  if (s.minorVm7) opts.push({ quality: 'm7', roman: 'v' });
  if (s.minorV7) opts.push({ quality: '7', roman: 'V' });
  return opts;
}

export function resolveDegreeQualityRoman(
  degree: number,
  s: HarmonySettings,
): { quality: string; roman: string } | null {
  const sc = scaleOf(s);
  if (isMinorTonality(s) && degree === 5) {
    const opts = minorDominantQualities(s);
    if (!opts.length) return null;
    return opts.length === 1 ? opts[0]! : pick(opts);
  }
  return { quality: sc.quality[degree]!, roman: sc.roman[degree]! };
}

export function functionDegreePool(fnName: string, s: HarmonySettings): number[] {
  if (fnName === 'dominant' && isMinorTonality(s)) {
    const pool = [7];
    if (s.minorVm7 || s.minorV7) pool.unshift(5);
    return pool;
  }
  return FUNCTIONS[fnName] ? FUNCTIONS[fnName]!.slice() : [];
}

export function allowsSevenths(s: Pick<HarmonySettings, 'extensions'>): boolean {
  return !!s.extensions && s.extensions.indexOf(7) !== -1;
}

export function triadFromBase(baseQuality: string): string {
  if (baseQuality === 'm7b5') return 'dim';
  if (baseQuality === 'dim7') return 'dim';
  if (baseQuality === 'm7') return 'm';
  if (baseQuality === '7') return 'dom';
  if (baseQuality === 'maj7') return 'maj';
  return 'maj';
}

export function tonicQualityForSettings(s: HarmonySettings): string {
  const sc = scaleOf(s);
  return allowsSevenths(s) ? sc.tonicQuality : triadFromBase(sc.tonicQuality);
}

export function applyExtensions(baseQuality: string, extensions: number[]): string {
  const s = { extensions };
  if (baseQuality === 'm7b5') return allowsSevenths(s) ? 'm7b5' : 'dim';
  if (baseQuality === 'dim7') return allowsSevenths(s) ? 'dim7' : 'dim';
  if (!allowsSevenths(s)) return triadFromBase(baseQuality);
  const top = Math.max(...extensions);
  if (baseQuality === '7') {
    if (top >= 13) return '13';
    if (top >= 11) return '11';
    if (top >= 9) return '9';
    return '7';
  }
  if (baseQuality === 'm7') {
    if (top >= 13) return 'm13';
    if (top >= 11) return 'm11';
    if (top >= 9) return 'm9';
    return 'm7';
  }
  if (top >= 13) return 'maj13';
  if (top >= 11) return 'maj11';
  if (top >= 9) return 'maj9';
  return 'maj7';
}

const CHORD_SYMBOL_MAP: Record<string, string> = {
  maj7: 'maj7', maj9: 'maj9', maj11: 'maj11', maj13: 'maj13',
  '7': '7', '9': '9', '11': '11', '13': '13',
  m7: 'm7', m9: 'm9', m11: 'm11', m13: 'm13',
  m7b5: 'm7b5', dim7: 'dim7',
  maj: '', m: 'm', dim: 'dim', dom: '',
};

export function chordSymbol(rootName: string, quality: string): string {
  const mapped = CHORD_SYMBOL_MAP[quality];
  return rootName + (mapped !== undefined ? mapped : quality);
}

export interface QualityParts {
  family: 'maj' | 'min' | 'dom' | 'halfdim' | 'dim';
  ext: number;
}

export function qualityParts(quality: string): QualityParts {
  if (quality === 'm7b5') return { family: 'halfdim', ext: 7 };
  if (quality === 'dim7') return { family: 'dim', ext: 7 };
  if (quality === 'maj') return { family: 'maj', ext: 3 };
  if (quality === 'm') return { family: 'min', ext: 3 };
  if (quality === 'dim') return { family: 'dim', ext: 3 };
  if (quality === 'dom') return { family: 'dom', ext: 3 };
  let family: QualityParts['family'];
  if (quality.startsWith('maj')) family = 'maj';
  else if (quality.startsWith('m')) family = 'min';
  else family = 'dom';
  const ext = parseInt(quality.replace(/[^0-9]/g, ''), 10) || 7;
  return { family, ext };
}

export interface ProgChord {
  degree: number | null;
  fn: string;
  rootPc: number;
  rootName: string;
  quality: string;
  rootDegree: number | null;
  family: QualityParts['family'];
  ext: number;
  symbol: string;
  roman: string;
  inversion: number;
  secondary: boolean;
  chromatic?: boolean;
  registerShift?: number;
  _forced?: boolean;
}

export function chordId(ch: Pick<ProgChord, 'rootPc' | 'quality' | 'inversion'>): string {
  return `${ch.rootPc}:${ch.quality}:${ch.inversion || 0}`;
}

export function maxInversionFor(quality: string): number {
  const r = RECIPES[quality] || RECIPES.maj7!;
  return Math.min(r.length - 1, 4);
}

export function chooseInversion(quality: string, s: Pick<HarmonySettings, 'inversions'>): number {
  if (!s.inversions) return 0;
  return Math.floor(random() * (maxInversionFor(quality) + 1));
}

export function pitchClassSteps(fromPc: number, toPc: number): number {
  const d = mod12(toPc - fromPc);
  return Math.min(d, 12 - d);
}

export function pickByVoiceLeading<T>(
  candidates: T[],
  getRootPc: (c: T) => number,
  prevRootPc: number | null,
): T | null {
  if (!candidates.length) return null;
  if (prevRootPc == null) return pick(candidates);
  const weighted = candidates.map((c) => {
    const steps = pitchClassSteps(prevRootPc, getRootPc(c));
    return { c, w: 1 / ((steps + 1) * (steps + 1)) };
  });
  let total = 0;
  weighted.forEach((x) => { total += x.w; });
  let r = random() * total;
  for (let i = 0; i < weighted.length; i++) {
    r -= weighted[i]!.w;
    if (r <= 0) return weighted[i]!.c;
  }
  return weighted[weighted.length - 1]!.c;
}

export function voicingMidis(rootPc: number, quality: string, inversion: number, registerShift: number): number[] {
  const recipe = RECIPES[quality] || RECIPES.maj7!;
  const handBase = 52 + rootPc + (registerShift || 0) * 12;
  const midis = recipe.map((iv) => handBase + iv);
  midis.sort((a, b) => a - b);
  for (let k = 0; k < inversion; k++) {
    midis[0] += 12;
    midis.sort((a, b) => a - b);
  }
  return midis;
}

export function chordBassMidiFromParts(
  rootPc: number,
  quality: string,
  inversion: number,
  registerShift: number,
  s: Pick<HarmonySettings, 'rootless'>,
): number {
  const midis = voicingMidis(rootPc, quality, inversion, registerShift);
  return s.rootless ? midis[0]! - 12 : midis[0]!;
}

export function applyVoiceLeading(ch: ProgChord, s: HarmonySettings, prevBassMidi: number | null): void {
  ch.registerShift = ch.registerShift || 0;
  if (prevBassMidi == null) {
    ch.inversion = ch.inversion || 0;
    return;
  }
  if (ch.chromatic) {
    ch.inversion = 0;
    let bestShift = 0;
    let bestDist = Infinity;
    for (let shift = -2; shift <= 2; shift++) {
      const bass = chordBassMidiFromParts(ch.rootPc, ch.quality, 0, shift, s);
      const dist = Math.abs(bass - prevBassMidi);
      if (dist < bestDist) {
        bestDist = dist;
        bestShift = shift;
      }
    }
    ch.registerShift = bestShift;
    return;
  }
  const maxInv = s.inversions ? maxInversionFor(ch.quality) : 0;
  let bestInv = 0;
  let bestShift = 0;
  let bestDist = Infinity;
  for (let inv = 0; inv <= maxInv; inv++) {
    for (let shift = -2; shift <= 2; shift++) {
      const bass = chordBassMidiFromParts(ch.rootPc, ch.quality, inv, shift, s);
      const dist = Math.abs(bass - prevBassMidi);
      if (dist < bestDist) {
        bestDist = dist;
        bestInv = inv;
        bestShift = shift;
      }
    }
  }
  ch.inversion = bestInv;
  ch.registerShift = bestShift;
}

export function smoothVoiceLeading(prog: ProgChord[], s: HarmonySettings): void {
  let prevBassMidi: number | null = null;
  prog.forEach((ch) => {
    applyVoiceLeading(ch, s, prevBassMidi);
    prevBassMidi = chordBassMidiFromParts(ch.rootPc, ch.quality, ch.inversion || 0, ch.registerShift || 0, s);
  });
}

export function inversionLabel(i: number): string {
  if (i === 0) return 'Root position';
  const ord = ['1st', '2nd', '3rd', '4th', '5th'][i - 1] || `${i}th`;
  return `${ord} inv`;
}

export function chordBassName(ch: Pick<ProgChord, 'quality' | 'rootPc' | 'inversion'>): string {
  const r = RECIPES[ch.quality] || RECIPES.maj7!;
  const iv = r[Math.min(ch.inversion || 0, r.length - 1)]!;
  return noteName(mod12(ch.rootPc + iv));
}

export function chordDisplay(ch: Pick<ProgChord, 'inversion' | 'symbol' | 'quality' | 'rootPc'>): string {
  return ch.inversion ? `${ch.symbol}/${chordBassName(ch)}` : ch.symbol;
}

export function familyLabel(fam: string): string {
  return (
    ({ maj: 'Major', min: 'Minor', dom: 'Dominant', halfdim: 'Half-diminished', dim: 'Diminished' } as Record<
      string,
      string
    >)[fam] || fam
  );
}

export function extensionRevealLabel(ext: number): string {
  if (ext === 3) return 'Triad';
  if (ext === 7) return '7th';
  return `${ext}th`;
}

export interface VoicingResult {
  chord: string[];
  bass: string | null;
  bassNote: string;
}

export function buildVoicing(
  rootPc: number,
  quality: string,
  opts: { rootless?: boolean; inversion?: number; registerShift?: number } = {},
): VoicingResult {
  const inversion = opts.inversion || 0;
  const midis = voicingMidis(rootPc, quality, inversion, opts.registerShift || 0);
  const bassMidi = opts.rootless ? midis[0]! - 12 : midis[0]!;
  const bassNote = noteName(mod12(bassMidi)) + (Math.floor(bassMidi / 12) - 1);

  if (opts.rootless) {
    const chord = midis.slice(1).map((m) => noteName(mod12(m)) + (Math.floor(m / 12) - 1));
    return { chord, bass: bassNote, bassNote };
  }

  const chord = midis.map((m) => noteName(mod12(m)) + (Math.floor(m / 12) - 1));
  return { chord, bass: null, bassNote };
}
