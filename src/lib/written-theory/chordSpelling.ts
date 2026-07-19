// Chord qualities and inversions (docs/14-theory-engine.md §4).

import { transposeUp, type IntervalLike, type SpelledPitch } from './spelledPitch';

export interface WrittenChordQuality {
  id: string;
  label: string;
  /** Stacked above the root, in ascending interval-number order. */
  intervals: IntervalLike[];
}

function quality(id: string, label: string, intervals: IntervalLike[]): WrittenChordQuality {
  return { id, label, intervals };
}

// Triads (docs/14 §4).
const MAJ_THIRD: IntervalLike = { number: 3, semitones: 4 };
const MIN_THIRD: IntervalLike = { number: 3, semitones: 3 };
const PERFECT_FIFTH: IntervalLike = { number: 5, semitones: 7 };
const DIM_FIFTH: IntervalLike = { number: 5, semitones: 6 };
const AUG_FIFTH: IntervalLike = { number: 5, semitones: 8 };
const MAJ_SEVENTH: IntervalLike = { number: 7, semitones: 11 };
const MIN_SEVENTH: IntervalLike = { number: 7, semitones: 10 };
const DIM_SEVENTH: IntervalLike = { number: 7, semitones: 9 };

export const WRITTEN_CHORD_QUALITIES: WrittenChordQuality[] = [
  quality('maj', 'Major', [MAJ_THIRD, PERFECT_FIFTH]),
  quality('min', 'Minor', [MIN_THIRD, PERFECT_FIFTH]),
  quality('dim', 'Diminished', [MIN_THIRD, DIM_FIFTH]),
  quality('aug', 'Augmented', [MAJ_THIRD, AUG_FIFTH]),
  quality('maj7', 'Major 7th', [MAJ_THIRD, PERFECT_FIFTH, MAJ_SEVENTH]),
  quality('min7', 'Minor 7th', [MIN_THIRD, PERFECT_FIFTH, MIN_SEVENTH]),
  quality('dom7', 'Dominant 7th', [MAJ_THIRD, PERFECT_FIFTH, MIN_SEVENTH]),
  quality('halfDim7', 'Half-diminished 7th', [MIN_THIRD, DIM_FIFTH, MIN_SEVENTH]),
  quality('dim7', 'Diminished 7th', [MIN_THIRD, DIM_FIFTH, DIM_SEVENTH]),
];

export function chordQualityById(id: string): WrittenChordQuality {
  const found = WRITTEN_CHORD_QUALITIES.find((q) => q.id === id);
  if (!found) throw new Error(`Unknown chord quality: ${id}`);
  return found;
}

function rootPositionStack(root: SpelledPitch, q: WrittenChordQuality): SpelledPitch[] {
  return [root, ...q.intervals.map((iv) => transposeUp(root, iv))];
}

/**
 * Closed position, bottom-to-top, bass = the inversion's chord member
 * (0 = root position). Built by rotating the root-position stack left by
 * `inversion` and bumping every wrapped-around member up an octave, which
 * keeps the result strictly ascending for any triad or seventh chord.
 */
export function spellChord(root: SpelledPitch, q: WrittenChordQuality, inversion: number): SpelledPitch[] {
  const members = rootPositionStack(root, q);
  const n = members.length;
  if (inversion < 0 || inversion >= n) {
    throw new Error(`Inversion ${inversion} is not valid for a ${n}-note ${q.id} chord`);
  }
  const rotated: SpelledPitch[] = [];
  for (let i = 0; i < n; i++) {
    const idx = (inversion + i) % n;
    const member = members[idx]!;
    rotated.push(idx < inversion ? { ...member, octave: member.octave + 1 } : member);
  }
  return rotated;
}

/** Pool filter every writing topic uses — inversion never changes which accidentals appear, so root position is enough to check. */
export function chordNeedsDoubleAccidentals(root: SpelledPitch, q: WrittenChordQuality): boolean {
  return rootPositionStack(root, q).some((p) => p.acc === '##' || p.acc === 'bb');
}
