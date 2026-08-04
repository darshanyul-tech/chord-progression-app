// Arranging engine — rules / "red flags" layer (ARR spec §2.6).
// Simultaneously the answer key for ARR-08 and the validator for Tier-2 exercises.
// Framing to preserve in feedback copy: these are guidelines, not absolutes —
// "when done with intent, for a musical purpose, it can work."

import { degreeOf } from './chord';
import { interval, pitchClass } from './pitch';
import type { Voicing } from './voicing';
import { getInstrument } from './instruments';

export type FaultSeverity = 'violation' | 'caution';

export type FaultCode =
  | 'MINOR_NINTH'
  | 'LIL_VIOLATION'
  | 'SECOND_ON_TOP'
  | 'EXCESSIVE_GAP'
  | 'VOICE_CROSSING'
  | 'OUT_OF_RANGE'
  | 'OUTSIDE_BEST_RANGE'
  | 'DOUBLED_THIRD'
  | 'LEAD_NOT_ON_TOP';

export interface Fault {
  code: FaultCode;
  voiceIndices: number[]; // indices into the top-down pitches array
  detail: string;
  severity: FaultSeverity;
}

export const FAULT_LABELS: Record<FaultCode, string> = {
  MINOR_NINTH: 'Minor 9th interval within the voicing',
  LIL_VIOLATION: 'Lower interval limit violation',
  SECOND_ON_TOP: '2nd between the top two voices',
  EXCESSIVE_GAP: 'Gap wider than a major 6th between adjacent voices',
  VOICE_CROSSING: 'Crossed voices',
  OUT_OF_RANGE: 'Note outside the instrument’s range',
  OUTSIDE_BEST_RANGE: 'Note outside the instrument’s best range',
  DOUBLED_THIRD: 'Doubled 3rd',
  LEAD_NOT_ON_TOP: 'Melody is not the top voice',
};

const C3 = 48; // one octave below middle C
const F1 = 29; // "low F on the bass clef" per spec §5.3

function sortedDesc(pitches: number[]): number[] {
  return [...pitches].sort((a, b) => b - a);
}

/**
 * Lower interval limits (§5.3). Implements the three general principles plus the
 * assumed-root rule. The full interval-by-interval chart (Sussman & Abene ch. 8)
 * is DATA REQUIRED FROM USER — see LIL_INTERVAL_TABLE_TODO below.
 */
export function checkLIL(voicing: Voicing): Fault[] {
  const faults: Fault[] = [];
  const desc = sortedDesc(voicing.pitches);
  const n = desc.length;

  const flag = (loIdx: number, hiIdx: number, detail: string) => {
    faults.push({ code: 'LIL_VIOLATION', voiceIndices: [hiIdx, loIdx], detail, severity: 'violation' });
  };

  for (let i = 0; i < n - 1; i++) {
    const hi = desc[i]!;
    const lo = desc[i + 1]!;
    const iv = interval(lo, hi);
    // Principle 1: no interval smaller than a M3 more than an octave below middle C.
    if (lo < C3 && iv.semitones < 4) {
      flag(i + 1, i, `${iv.name} below C3 — too close for this register`);
    }
    // Principle 2: avoid 6ths and 7ths below low F (F1).
    if (lo < F1 && iv.number >= 6 && iv.number <= 7) {
      flag(i + 1, i, `${iv.name} below low F — muddy in this register`);
    }
  }

  // Assumed-root rule: if the bottom note isn't the root, assume a root beneath it
  // and check that bottom interval too (lecture's C7-passes / A-7-fails example).
  const bottom = desc[n - 1]!;
  if (pitchClass(bottom) !== voicing.chord.root) {
    const rootPc = voicing.chord.root;
    let assumed = bottom;
    while (pitchClass(assumed) !== rootPc || assumed >= bottom) assumed--;
    const iv = interval(assumed, bottom);
    if (assumed < C3 && iv.semitones < 4) {
      faults.push({
        code: 'LIL_VIOLATION',
        voiceIndices: [n - 1],
        detail: `With an assumed root beneath, the ${iv.name} to the bottom note falls below the limit`,
        severity: 'violation',
      });
    }
  }

  return faults;
}

/** Extension point for the full interval-by-interval LIL chart (§10 item 1, DATA REQUIRED). */
export const LIL_INTERVAL_TABLE_TODO: Record<string, number> = {
  // interval name → lowest permissible bottom MIDI. Populate from Sussman & Abene ch. 8.
};

/** All internal-voicing faults (§2.6). ARR-08 grades against severity: 'violation'. */
export function checkFaults(voicing: Voicing): Fault[] {
  const faults: Fault[] = [];
  const entered = voicing.pitches;
  const desc = sortedDesc(entered);
  const n = desc.length;
  const { chord } = voicing;

  // LEAD_NOT_ON_TOP — pitches[0] is the intended lead; flag if it isn't the highest.
  if (entered.length > 0 && entered[0] !== Math.max(...entered)) {
    faults.push({
      code: 'LEAD_NOT_ON_TOP',
      voiceIndices: [0],
      detail: 'The melody must be the top voice the whole time.',
      severity: 'violation',
    });
  }

  // MINOR_NINTH — any pair a compound minor 2nd (13 semitones) apart.
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(desc[i]! - desc[j]!) === 13) {
        faults.push({
          code: 'MINOR_NINTH',
          voiceIndices: [i, j],
          detail: 'A minor 9th between two voices sounds harsh — avoid it.',
          severity: 'violation',
        });
      }
    }
  }

  // SECOND_ON_TOP — a 2nd between the top two voices (caution).
  if (n >= 2) {
    const top = interval(desc[1]!, desc[0]!);
    if (top.semitones === 1 || top.semitones === 2) {
      faults.push({
        code: 'SECOND_ON_TOP',
        voiceIndices: [0, 1],
        detail: 'A 2nd between the top two voices obscures the melody (most effective on passing notes).',
        severity: 'caution',
      });
    }
  }

  // EXCESSIVE_GAP — gap wider than a M6 (9 semitones) between adjacent voices,
  // except the bottom two, which may be up to a 10th (16 semitones).
  for (let i = 0; i < n - 1; i++) {
    const gap = desc[i]! - desc[i + 1]!;
    const isBottomPair = i === n - 2;
    const limit = isBottomPair ? 16 : 9;
    if (gap > limit) {
      faults.push({
        code: 'EXCESSIVE_GAP',
        voiceIndices: [i, i + 1],
        detail: isBottomPair
          ? `Gap wider than a 10th between the bottom two voices (${gap} semitones).`
          : `Gap wider than a major 6th between adjacent voices (${gap} semitones).`,
        severity: 'violation',
      });
    }
  }

  // DOUBLED_THIRD — the 3rd appears in more than one voice.
  const thirdVoices = desc
    .map((m, i) => ({ i, deg: degreeOf(chord, m) }))
    .filter((x) => x.deg === '3')
    .map((x) => x.i);
  if (thirdVoices.length > 1) {
    faults.push({
      code: 'DOUBLED_THIRD',
      voiceIndices: thirdVoices,
      detail: 'Over-doubling the 3rd weakens the harmony.',
      severity: 'violation',
    });
  }

  // LIL
  faults.push(...checkLIL(voicing));

  // Instrument-dependent faults (need voicing.instruments, parallel to entered pitches).
  if (voicing.instruments) {
    faults.push(...checkInstrumentFaults(entered, voicing.instruments));
  }

  return faults;
}

function checkInstrumentFaults(pitches: number[], instruments: string[]): Fault[] {
  const faults: Fault[] = [];
  for (let i = 0; i < pitches.length; i++) {
    const inst = getInstrument(instruments[i] ?? '');
    if (!inst) continue;
    const midi = pitches[i]!;
    if (midi < inst.range.low || midi > inst.range.high) {
      faults.push({
        code: 'OUT_OF_RANGE',
        voiceIndices: [i],
        detail: `${midi} is outside the assessed range of ${inst.displayName}.`,
        severity: 'violation',
      });
    } else if (midi < inst.bestRange.low || midi > inst.bestRange.high) {
      faults.push({
        code: 'OUTSIDE_BEST_RANGE',
        voiceIndices: [i],
        detail: `Playable but outside the best range of ${inst.displayName}.`,
        severity: 'caution',
      });
    }
  }
  // VOICE_CROSSING — instruments listed top-down should keep descending pitch.
  for (let i = 0; i < pitches.length - 1; i++) {
    if (pitches[i]! < pitches[i + 1]!) {
      faults.push({
        code: 'VOICE_CROSSING',
        voiceIndices: [i, i + 1],
        detail: 'Instrument positions crossed — keep consistent vertical order.',
        severity: 'violation',
      });
    }
  }
  return faults;
}

// ---- Voice leading across a progression ----

export type VoiceLeadingCode =
  | 'REPEATED_NOTE'
  | 'LARGE_LEAP'
  | 'PARALLEL_FIFTHS'
  | 'PARALLEL_OCTAVES'
  | 'EXPOSED_FIFTH_OCTAVE';

export interface VoiceLeadingFault {
  code: VoiceLeadingCode;
  detail: string;
}

export type MotionType = 'parallel' | 'similar' | 'oblique' | 'contrary';

/** Motion between two voices, each given as [startNote, endNote]. */
export function classifyMotion(pairA: [number, number], pairB: [number, number]): MotionType {
  const dirA = Math.sign(pairA[1] - pairA[0]);
  const dirB = Math.sign(pairB[1] - pairB[0]);
  if (dirA === 0 || dirB === 0) {
    if (dirA === 0 && dirB === 0) return 'oblique';
    return 'oblique';
  }
  if (dirA === -dirB) return 'contrary';
  // same direction: parallel if the interval between voices is preserved.
  const startGap = Math.abs(pairA[0] - pairB[0]);
  const endGap = Math.abs(pairA[1] - pairB[1]);
  return startGap === endGap ? 'parallel' : 'similar';
}

/** Voice-leading faults across a sequence of voicings (top-down aligned). */
export function checkVoiceLeading(voicings: Voicing[]): VoiceLeadingFault[] {
  const faults: VoiceLeadingFault[] = [];
  for (let step = 0; step < voicings.length - 1; step++) {
    const a = voicings[step]!.pitches;
    const b = voicings[step + 1]!.pitches;
    const voices = Math.min(a.length, b.length);
    for (let v = 0; v < voices; v++) {
      const leap = Math.abs(b[v]! - a[v]!);
      if (leap === 0) faults.push({ code: 'REPEATED_NOTE', detail: `Voice ${v + 1} repeats a note.` });
      if (v > 0 && leap > 5) faults.push({ code: 'LARGE_LEAP', detail: `Inner voice ${v + 1} leaps ${leap} semitones (> P4).` });
    }
    // Parallel/exposed 5ths and octaves between adjacent voice pairs.
    for (let v = 0; v < voices - 1; v++) {
      const startIv = Math.abs(a[v]! - a[v + 1]!) % 12;
      const endIv = Math.abs(b[v]! - b[v + 1]!) % 12;
      const motion = classifyMotion([a[v]!, b[v]!], [a[v + 1]!, b[v + 1]!]);
      if (startIv === 7 && endIv === 7 && motion === 'parallel')
        faults.push({ code: 'PARALLEL_FIFTHS', detail: `Parallel 5ths between voices ${v + 1}–${v + 2}.` });
      if (startIv === 0 && endIv === 0 && motion === 'parallel')
        faults.push({ code: 'PARALLEL_OCTAVES', detail: `Parallel octaves between voices ${v + 1}–${v + 2}.` });
    }
  }
  return faults;
}

/** Feedback framing helper — the section's overarching caveat (§5.7). */
export const RULES_CAVEAT =
  'Rules are made to be broken — when done with musical intention, rather than by accident.';
