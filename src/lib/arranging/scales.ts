// Arranging engine — chord scales (ARR spec §5.5).
//
// ⚠ CONFIRM WITH USER (§10 item 3): only three worked examples appear in the
// slides. The full chord-quality → scale mapping the unit expects is DATA
// REQUIRED. The three CONFIRMED rows are marked `confirmed: true`; the rest are
// PROVISIONAL conventional defaults, flagged so the UI can say so and so they can
// be corrected without touching exercise code.

import type { ChordQuality } from './chord';

export interface ChordScale {
  name: string;
  /** Semitone offsets above the chord root. */
  degrees: number[];
  confirmed: boolean;
}

// Keyed by a compact chord descriptor. The three confirmed worked examples:
//   Cmi11        → C Dorian
//   Bmi7(♭5)     → B Locrian
//   G9(♯11)      → G Lydian dominant
export const CONFIRMED_SCALES: Record<string, ChordScale> = {
  'minor-11': { name: 'Dorian', degrees: [0, 2, 3, 5, 7, 9, 10], confirmed: true },
  minor7b5: { name: 'Locrian', degrees: [0, 1, 3, 5, 6, 8, 10], confirmed: true },
  'dominant-#11': { name: 'Lydian dominant', degrees: [0, 2, 4, 6, 7, 9, 10], confirmed: true },
};

// PROVISIONAL defaults by base quality (subject to user confirmation).
const PROVISIONAL: Record<ChordQuality, ChordScale> = {
  major: { name: 'Ionian', degrees: [0, 2, 4, 5, 7, 9, 11], confirmed: false },
  minor: { name: 'Dorian', degrees: [0, 2, 3, 5, 7, 9, 10], confirmed: false },
  dominant: { name: 'Mixolydian', degrees: [0, 2, 4, 5, 7, 9, 10], confirmed: false },
  minor7b5: { name: 'Locrian', degrees: [0, 1, 3, 5, 6, 8, 10], confirmed: false },
  diminished: { name: 'Whole-half diminished', degrees: [0, 2, 3, 5, 6, 8, 9, 11], confirmed: false },
  augmented: { name: 'Whole tone', degrees: [0, 2, 4, 6, 8, 10], confirmed: false },
  sus: { name: 'Mixolydian', degrees: [0, 2, 4, 5, 7, 9, 10], confirmed: false },
};

export const LYDIAN_DOMINANT: ChordScale = { name: 'Lydian dominant', degrees: [0, 2, 4, 6, 7, 9, 10], confirmed: true };
export const ALTERED_SCALE: ChordScale = { name: 'Altered', degrees: [0, 1, 3, 4, 6, 8, 10], confirmed: false };

/** Provisional chord-scale lookup by quality (see CONFIRM WITH USER note above). */
export function chordScaleForQuality(quality: ChordQuality): ChordScale {
  return PROVISIONAL[quality];
}

/** True until the full mapping is confirmed — the UI shows a provisional notice. */
export const CHORD_SCALES_PROVISIONAL = true;
