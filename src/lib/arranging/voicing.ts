// Arranging engine — voicing construction and analysis (ARR spec §2.4–2.5).
// TOP-DOWN ordering is load-bearing: pitches[0] is the lead (voice 1). Voice
// numbers are vertical-position labels, never chord degrees.

import { chordTones, degreeOf, type ParsedChord } from './chord';
import { interval, pitchClass, type Interval } from './pitch';
import { UST_TABLE, ustTriadPitchClasses } from './ust';

export type MechanicalVoicingType =
  | 'close'
  | 'close-doubled'
  | 'drop-2'
  | 'drop-3'
  | 'drop-2+4'
  | 'spread';

export type VoicingFamily =
  | 'triad'
  | 'shell'
  | 'quartal'
  | 'quartal-dominant'
  | 'cluster'
  | 'upper-structure-triad';

export interface Voicing {
  chord: ParsedChord;
  pitches: number[]; // TOP-DOWN (descending MIDI). pitches[0] = lead.
  declaredType: MechanicalVoicingType | null;
  instruments: string[] | null; // parallel to pitches, for range checks
}

export const MECHANICAL_TYPE_LABELS: Record<MechanicalVoicingType, string> = {
  close: '4-way close',
  'close-doubled': 'Close, lead doubled 8vb',
  'drop-2': 'Drop 2',
  'drop-3': 'Drop 3',
  'drop-2+4': 'Drop 2+4',
  spread: 'Spread',
};

export const FAMILY_LABELS: Record<VoicingFamily, string> = {
  triad: 'Triad',
  shell: 'Shell',
  quartal: 'Quartal',
  'quartal-dominant': 'Quartal dominant',
  cluster: 'Cluster',
  'upper-structure-triad': 'Upper structure triad',
};

/** The four basic (primary) chord tones as pitch classes: 1, 3, 5, and 7 (or 6). */
export function basicVoicingTones(chord: ParsedChord): number[] {
  const tones = chordTones(chord);
  const out: number[] = [];
  if (tones['1'] != null) out.push(tones['1']);
  if (tones['3'] != null) out.push(tones['3']);
  if (tones['5'] != null) out.push(tones['5']);
  if (tones['7'] != null) out.push(tones['7']);
  else if (chord.seventh === '6' && tones['6'] != null) out.push(tones['6']);
  return out;
}

/** Highest MIDI ≤ ceil whose pitch class is pc. */
function highestAtOrBelow(pc: number, ceil: number): number {
  const ceilPc = pitchClass(ceil);
  const diff = (ceilPc - pc + 12) % 12; // semitones to step down from ceil to reach pc
  return ceil - diff;
}

/**
 * 4-way close: establish the lead, hang the remaining chord tones down from it
 * as close as possible within an octave. Returns pitches TOP-DOWN.
 */
export function buildClose(chord: ParsedChord, leadMidi: number, tones = basicVoicingTones(chord)): number[] {
  const leadPc = pitchClass(leadMidi);
  const result = [leadMidi];
  const usedPcs = new Set<number>([leadPc]);
  let prev = leadMidi;
  const remaining = tones.filter((pc) => pc !== leadPc);
  while (result.length < tones.length && usedPcs.size <= tones.length) {
    let best = -Infinity;
    let bestPc: number | null = null;
    for (const pc of remaining) {
      if (usedPcs.has(pc)) continue;
      const m = highestAtOrBelow(pc, prev - 1);
      if (m > best) {
        best = m;
        bestPc = pc;
      }
    }
    if (bestPc == null) break;
    result.push(best);
    usedPcs.add(bestPc);
    prev = best;
  }
  return result;
}

function sortDesc(pitches: number[]): number[] {
  return [...pitches].sort((a, b) => b - a);
}

export interface BuildOptions {
  allowTensionSubstitution?: boolean;
  /** Explicit chord tones to hang, overriding the basic set (used for SKIP / substitution). */
  tones?: number[];
  /** Omit technique (ARR-19): omit the Nth voice from the top of the close voicing. */
  omit?: 2 | 3 | 4;
}

export interface BuildInput {
  chord: ParsedChord;
  leadMidi: number;
  type: MechanicalVoicingType;
  options?: BuildOptions;
}

/**
 * SKIP rule (§2.5): if the lead is not a chord tone, harmonise it by skipping
 * the chord tone immediately beneath it and assigning the next two chord tones
 * to the remaining voices. Returns the four pitches TOP-DOWN (lead + 3 below).
 */
export function applySkipRule(chord: ParsedChord, leadMidi: number, tones = basicVoicingTones(chord)): number[] {
  const result = [leadMidi];
  // The chord tone immediately beneath the lead — skipped.
  const below: { pc: number; midi: number }[] = tones
    .map((pc) => ({ pc, midi: highestAtOrBelow(pc, leadMidi - 1) }))
    .sort((a, b) => b.midi - a.midi);
  const kept = below.slice(1); // skip the chord tone immediately beneath the lead
  for (const cand of kept) {
    if (result.length >= 4) break;
    result.push(cand.midi); // already strictly descending (distinct pitch classes)
  }
  return result;
}

/** Build a mechanical voicing. Returns a Voicing with pitches TOP-DOWN. */
export function buildVoicing(input: BuildInput): Voicing {
  const { chord, leadMidi, type, options = {} } = input;
  const tones = options.tones ?? basicVoicingTones(chord);
  const leadIsChordTone = tones.includes(pitchClass(leadMidi));

  // Establish the close voicing (top-down), applying the SKIP rule when the lead
  // is not a chord tone.
  let close = leadIsChordTone ? buildClose(chord, leadMidi, tones) : applySkipRule(chord, leadMidi, tones);

  if (options.omit) {
    const idx = options.omit - 1;
    close = close.filter((_, i) => i !== idx);
  }

  let pitches: number[];
  switch (type) {
    case 'close':
      pitches = sortDesc(close);
      break;
    case 'close-doubled':
      pitches = sortDesc([...close, close[0]! - 12]);
      break;
    case 'drop-2':
      pitches = sortDesc(close.map((m, i) => (i === 1 ? m - 12 : m)));
      break;
    case 'drop-3':
      pitches = sortDesc(close.map((m, i) => (i === 2 ? m - 12 : m)));
      break;
    case 'drop-2+4':
      pitches = sortDesc(close.map((m, i) => (i === 1 || i === 3 ? m - 12 : m)));
      break;
    case 'spread':
      // Built bottom-up: root lowest, then 7/3/5 spread by more than an octave.
      pitches = buildSpread(leadMidi, tones);
      break;
    default:
      pitches = sortDesc(close);
  }

  return { chord, pitches, declaredType: type, instruments: null };
}

function buildSpread(leadMidi: number, tones: number[]): number[] {
  // Root generally lowest; then stack the remaining tones upward, keeping the
  // lead on top and spanning more than an octave.
  const rootPc = tones[0]!;
  const bottom = highestAtOrBelow(rootPc, leadMidi - 13); // at least an octave below the lead
  const inner = tones.filter((pc) => pc !== pitchClass(leadMidi) && pc !== rootPc);
  const result = [leadMidi];
  let prev = leadMidi;
  for (const pc of inner) {
    const m = highestAtOrBelow(pc, prev - 1);
    result.push(m);
    prev = m;
  }
  result.push(bottom);
  return sortDesc(result);
}

/** Hang the given pitch classes down from a top note, each highest-below-previous. */
export function hangDown(topMidi: number, belowPcs: number[]): number[] {
  const result = [topMidi];
  let prev = topMidi;
  for (const pc of belowPcs) {
    const m = highestAtOrBelow(pc, prev - 1);
    result.push(m);
    prev = m;
  }
  return result;
}

/** Build a representative 3-note voicing of a given family (ARR-03/04). Top-down. */
export function buildThreeNote(chord: ParsedChord, family: VoicingFamily, topMidi: number): number[] {
  const tones = chordTones(chord);
  const p = (deg: string) => tones[deg];
  switch (family) {
    case 'triad': {
      const set = [p('1'), p('3'), p('5')].filter((x): x is number => x != null);
      const topPc = pitchClass(topMidi);
      const below = set.filter((pc) => pc !== topPc);
      return hangDown(topMidi, below.length ? below : set.slice(1));
    }
    case 'shell': {
      const colour = p('5') ?? p('9') ?? p('1')!;
      const set = [p('3')!, p('7') ?? p('6')!, colour];
      const topPc = pitchClass(topMidi);
      const below = set.filter((pc) => pc !== topPc);
      return hangDown(topMidi, below.slice(0, 2).concat(below.length < 2 ? set.slice(0, 2 - below.length) : []));
    }
    case 'quartal':
      return [topMidi, topMidi - 5, topMidi - 10];
    case 'quartal-dominant':
      return [topMidi, topMidi - 5, topMidi - 11]; // P4 over a tritone
    case 'cluster':
      return [topMidi, topMidi - 2, topMidi - 5]; // a 2nd on top, then a m3
    case 'upper-structure-triad': {
      const row = UST_TABLE.find((r) => r.quality === 'major' && r.semitonesAboveRoot === 2) ?? UST_TABLE[2]!;
      const triad = ustTriadPitchClasses(row, chord.root);
      const topPc = pitchClass(topMidi);
      const below = triad.filter((pc) => pc !== topPc);
      return hangDown(topMidi, below.length === 2 ? below : triad.slice(1));
    }
    default:
      return [topMidi, topMidi - 4, topMidi - 7];
  }
}

// ---- Analysis (§2.4) ----

export interface VoicingAnalysis {
  span: number;
  isWithinOctave: boolean;
  adjacentIntervals: Interval[]; // top pair first
  degrees: string[]; // parallel to pitches (top-down)
  detectedType: MechanicalVoicingType | null;
  detectedTypes: MechanicalVoicingType[];
  detectedTypeAmbiguous: boolean;
  detectedFamilies: VoicingFamily[];
  acceptableFamilies: VoicingFamily[];
}

function pitchMultisetEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}

/** Detect which mechanical construction(s) reproduce these exact pitches. */
export function detectMechanicalTypes(voicing: Voicing): MechanicalVoicingType[] {
  const { chord, pitches } = voicing;
  const lead = pitches[0]!;
  const distinctCount = new Set(pitches).size;
  const matches: MechanicalVoicingType[] = [];
  const order: MechanicalVoicingType[] = ['close', 'drop-2', 'drop-3', 'drop-2+4', 'close-doubled', 'spread'];
  for (const type of order) {
    // close-doubled requires 5 pitches; the rest 4 (unless omitted).
    const built = buildVoicing({ chord, leadMidi: lead, type });
    if (built.pitches[0] !== lead) continue;
    if (pitchMultisetEqual(built.pitches, pitches)) matches.push(type);
  }
  void distinctCount;
  return matches;
}

function detectFamilies(voicing: Voicing): VoicingFamily[] {
  const { chord, pitches } = voicing;
  if (pitches.length !== 3) return [];
  const desc = sortDesc(pitches);
  const topPair = interval(desc[1]!, desc[0]!);
  const bottomPair = interval(desc[2]!, desc[1]!);
  const degrees = desc.map((m) => degreeOf(chord, m));
  const families: VoicingFamily[] = [];

  const hasSecond = [topPair, bottomPair].some((iv) => iv.semitones === 1 || iv.semitones === 2);
  const noSmallerThanThird = [topPair, bottomPair].every((iv) => iv.semitones >= 3);
  const allChordTones = degrees.every((d) => d !== 'non-chord-tone');
  const has3 = degrees.includes('3');
  const has7 = degrees.includes('7');

  // Triad: 1/3/5 (or a triad from the chord scale), nothing closer than a m3.
  if (noSmallerThanThird && allChordTones) families.push('triad');
  // Shell: 3rd + 7th + one other colour tone.
  if (has3 && has7 && pitches.length === 3) families.push('shell');
  // Quartal: stacked perfect 4ths.
  if (topPair.semitones === 5 && bottomPair.semitones === 5) families.push('quartal');
  // Quartal dominant: a P4 over a tritone (top P4, bottom TT).
  if (topPair.semitones === 5 && bottomPair.semitones === 6 && chord.quality === 'dominant')
    families.push('quartal-dominant');
  // Cluster: a 2nd between two adjacent voices (inverted quartals create these).
  if (hasSecond) families.push('cluster');
  // Upper structure triad: on a dominant, a plain triad drawn from the upper
  // structure (any inversion). Detected by matching the pitch-class set.
  if (chord.quality === 'dominant') {
    const pcs = new Set(desc.map((m) => pitchClass(m)));
    const matchesUst = UST_TABLE.some((row) => {
      const triad = new Set(ustTriadPitchClasses(row, chord.root));
      return triad.size === pcs.size && [...triad].every((p) => pcs.has(p));
    });
    if (matchesUst) families.push('upper-structure-triad');
  }

  return families;
}

export function analyse(voicing: Voicing): VoicingAnalysis {
  const desc = sortDesc(voicing.pitches);
  const span = desc[0]! - desc[desc.length - 1]!;
  const adjacentIntervals: Interval[] = [];
  for (let i = 0; i < desc.length - 1; i++) adjacentIntervals.push(interval(desc[i + 1]!, desc[i]!));
  const degrees = desc.map((m) => degreeOf(voicing.chord, m));

  const detectedTypes = voicing.pitches.length >= 4 ? detectMechanicalTypes({ ...voicing, pitches: desc }) : [];
  const detectedFamilies = detectFamilies({ ...voicing, pitches: desc });

  return {
    span,
    isWithinOctave: span <= 12,
    adjacentIntervals,
    degrees,
    detectedType: detectedTypes[0] ?? null,
    detectedTypes,
    detectedTypeAmbiguous: detectedTypes.length > 1,
    detectedFamilies,
    acceptableFamilies: detectedFamilies,
  };
}
