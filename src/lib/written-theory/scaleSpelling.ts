// Scale types as letter-degree patterns for writing (docs/14-theory-engine.md
// §3) — distinct from lib/recognition/scales.ts's aural table, which is
// interval-only and spelling-blind. Ids match that table's so labels stay
// consistent between the aural and theory sections.

import { transposeUp, type SpelledPitch } from './spelledPitch';

export interface WrittenScaleType {
  id: string;
  label: string;
  /** Semitone offset of each degree above the tonic — letters always advance by one per degree, so spelling falls out automatically. */
  degrees: { semitones: number }[];
}

function scaleType(id: string, label: string, semitoneSteps: number[]): WrittenScaleType {
  return { id, label, degrees: semitoneSteps.map((semitones) => ({ semitones })) };
}

// v1 types (docs/14 §3): major/minor scales plus the 7 major modes.
export const WRITTEN_SCALE_TYPES: WrittenScaleType[] = [
  scaleType('major', 'Major', [0, 2, 4, 5, 7, 9, 11]),
  scaleType('naturalMinor', 'Natural minor', [0, 2, 3, 5, 7, 8, 10]),
  scaleType('harmonicMinor', 'Harmonic minor', [0, 2, 3, 5, 7, 8, 11]),
  scaleType('melodicMinor', 'Melodic minor (ascending)', [0, 2, 3, 5, 7, 9, 11]),
  scaleType('ionian', 'Ionian (major)', [0, 2, 4, 5, 7, 9, 11]),
  scaleType('dorian', 'Dorian', [0, 2, 3, 5, 7, 9, 10]),
  scaleType('phrygian', 'Phrygian', [0, 1, 3, 5, 7, 8, 10]),
  scaleType('lydian', 'Lydian', [0, 2, 4, 6, 7, 9, 11]),
  scaleType('mixolydian', 'Mixolydian', [0, 2, 4, 5, 7, 9, 10]),
  scaleType('aeolian', 'Aeolian', [0, 2, 3, 5, 7, 8, 10]),
  scaleType('locrian', 'Locrian', [0, 1, 3, 5, 6, 8, 10]),
];

export function writtenScaleTypeById(id: string): WrittenScaleType {
  const found = WRITTEN_SCALE_TYPES.find((t) => t.id === id);
  if (!found) throw new Error(`Unknown written scale type: ${id}`);
  return found;
}

/** 8 notes including the octave tonic — each successive letter is the next letter above the previous. */
export function spellWrittenScale(tonic: SpelledPitch, type: WrittenScaleType): SpelledPitch[] {
  const degrees = type.degrees.map((d, i) => transposeUp(tonic, { number: i + 1, semitones: d.semitones }));
  const octaveTonic = transposeUp(tonic, { number: 8, semitones: 12 });
  return [...degrees, octaveTonic];
}

/** Pool filter every writing topic uses — true if any of the 8 spelled notes needs a double accidental (docs/14 §3). */
export function scaleNeedsDoubleAccidentals(tonic: SpelledPitch, type: WrittenScaleType): boolean {
  return spellWrittenScale(tonic, type).some((p) => p.acc === '##' || p.acc === 'bb');
}
