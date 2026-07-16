// Framework-free grading for the Interval Singing exercise (docs/09-improvement-plan.md
// §16.1/16.2) — trivial, but unit-tested for the octave-equivalence and
// direction edge cases since a wrong fold there silently marks a correct
// singer's answer wrong (or vice versa).
import { midiToNoteName } from '../theory';

export interface SungGradeOptions {
  toleranceCents: number;
  /** Accept the right pitch class in any octave — singers octave-shift constantly (default ON per §16.1). */
  octaveEquivalence: boolean;
}

export interface SungGradeResult {
  correct: boolean;
  /** Signed cents the sung pitch was from the target (post octave-fold when enabled). */
  centsOff: number;
  /** Nearest note name to what was actually sung, for feedback text. */
  sungLabel: string;
}

/** Folds `cents` into (-600, 600] by removing whole-octave (1200-cent) multiples. */
function foldToOctave(cents: number): number {
  let folded = cents % 1200;
  if (folded > 600) folded -= 1200;
  else if (folded <= -600) folded += 1200;
  return folded;
}

/**
 * Grades a captured sung pitch against a target interval above/below a root.
 * `targetSemitones` is signed — positive for "above the root", negative for
 * "below" — so direction is just the sign of the same number the caller
 * already has (no separate direction flag needed here).
 */
export function gradeSungInterval(
  rootMidi: number,
  targetSemitones: number,
  capturedMidiFloat: number,
  opts: SungGradeOptions,
): SungGradeResult {
  const targetMidi = rootMidi + targetSemitones;
  const rawCentsOff = (capturedMidiFloat - targetMidi) * 100;
  const centsOff = opts.octaveEquivalence ? foldToOctave(rawCentsOff) : rawCentsOff;
  return {
    correct: Math.abs(centsOff) <= opts.toleranceCents,
    centsOff,
    sungLabel: midiToNoteName(Math.round(capturedMidiFloat)),
  };
}

export interface SungSequenceGradeResult {
  allCorrect: boolean;
  tones: SungGradeResult[];
}

/**
 * Grades a completed multi-tone attempt: one gradeSungInterval call per
 * target offset, in order. Shared by Chord Singing's `gradeArpeggio`
 * (rootMidi = the chord's root, offsets = its recipe intervals) and Sight
 * Singing's `gradeSungMelody` (rootMidi = 0, offsets = absolute target
 * MIDI notes) — both topics reduce to "grade each tone against the same
 * root, then AND the results" (docs/05-topics/13-sight-singing.md §3,
 * extracted here per that spec's own second-consumer note).
 */
export function gradeSungSequence(
  rootMidi: number,
  targetOffsets: number[],
  captures: number[],
  opts: SungGradeOptions,
): SungSequenceGradeResult {
  const tones = targetOffsets.map((offset, i) => gradeSungInterval(rootMidi, offset, captures[i]!, opts));
  return { allCorrect: tones.every((t) => t.correct), tones };
}
