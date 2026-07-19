// Tier-1 builder for Theory Topic 07 — Chord Writing (docs/15-theory-topics/07).
import { NATURAL_LETTERS, staffLineFor, type Clef } from '../melody/theory';
import { pick } from '../theory';
import { chordNeedsDoubleAccidentals, chordQualityById, spellChord, WRITTEN_CHORD_QUALITIES, type WrittenChordQuality } from './chordSpelling';
import type { Accidental, SpelledPitch } from './spelledPitch';

export interface ChordWritingSettings extends Record<string, unknown> {
  qualities: string[];
  inversions: number[];
  clefs: Clef[];
  hearIt: boolean;
  autoAdvance: boolean;
}

export function defaultChordWritingSettings(): ChordWritingSettings {
  return {
    qualities: ['maj', 'min'],
    inversions: [0],
    clefs: ['treble', 'bass'],
    hearIt: false,
    autoAdvance: false,
  };
}

const WINDOW_LOW = -1;
const WINDOW_HIGH = 7;

function withinWindow(letter: string, octave: number, clef: Clef): boolean {
  const line = staffLineFor(NATURAL_LETTERS.indexOf(letter), octave, clef);
  return line >= WINDOW_LOW && line <= WINDOW_HIGH;
}

function rootCandidates(): SpelledPitch[] {
  const out: SpelledPitch[] = [];
  for (let octave = 2; octave <= 6; octave++) {
    NATURAL_LETTERS.forEach((letter) => {
      (['', '#', 'b'] as Accidental[]).forEach((acc) => out.push({ letter, acc, octave }));
    });
  }
  return out;
}

const INVERSION_LABELS = ['root position', 'first inversion', 'second inversion', 'third inversion'];

export interface ChordWritingQuestion {
  clef: Clef;
  quality: WrittenChordQuality;
  inversion: number;
  root: SpelledPitch;
  expected: SpelledPitch[];
}

/** Legal enabled (quality, inversion) pairs — 3rd inversion only applies to 7th chords (4 tones). */
function legalPairs(settings: ChordWritingSettings): { quality: WrittenChordQuality; inversion: number }[] {
  const pairs: { quality: WrittenChordQuality; inversion: number }[] = [];
  settings.qualities.forEach((qid) => {
    const quality = chordQualityById(qid);
    const toneCount = quality.intervals.length + 1;
    settings.inversions.forEach((inv) => {
      if (inv < toneCount) pairs.push({ quality, inversion: inv });
    });
  });
  return pairs;
}

export function buildChordWritingQuestion(settings: ChordWritingSettings): ChordWritingQuestion | null {
  const pairs = legalPairs(settings);
  if (!pairs.length || !settings.clefs.length) return null;
  const { quality, inversion } = pick(pairs);
  const clef = pick(settings.clefs);

  const pool = rootCandidates().filter((root) => {
    if (chordNeedsDoubleAccidentals(root, quality)) return false;
    const stack = spellChord(root, quality, inversion);
    return stack.every((n) => withinWindow(n.letter, n.octave, clef));
  });
  if (!pool.length) return null;
  const root = pick(pool);
  const expected = spellChord(root, quality, inversion);
  return { clef, quality, inversion, root, expected };
}

export function chordWritingPromptText(q: ChordWritingQuestion): string {
  const glyph = q.root.acc === '#' ? '♯' : q.root.acc === 'b' ? '♭' : '';
  const kind = q.quality.intervals.length === 3 ? 'seventh' : 'triad';
  return `Write ${q.root.letter}${glyph} ${q.quality.label} ${kind}, ${INVERSION_LABELS[q.inversion]}.`;
}

/** All qualities' definitions, exposed for the settings UI (docs §2's Triads/Sevenths grouping). */
export { WRITTEN_CHORD_QUALITIES };

export interface ChordGradeResult {
  correct: boolean;
  /** Right pitch classes, but not in closed position above a consistent bass octave (docs §4). */
  closedPositionRequired: boolean;
  correctToneCount: number;
  total: number;
}

function pitchClassEqual(a: SpelledPitch, b: SpelledPitch): boolean {
  return a.letter === b.letter && a.acc === b.acc;
}

/**
 * Grading normalizes the bass octave (docs §4): correct if transposing the
 * whole user stack by a *consistent* number of octaves makes every tone
 * match the expected stack exactly. Tones are matched by letter+accidental
 * identity (every tone in a chord has a distinct letter, so this is
 * unambiguous) rather than by sorted pitch position — sorting by absolute
 * pitch would itself reorder an *open*-spacing stack, silently turning
 * "wrong spacing" into what looks like "wrong letter", which is exactly the
 * distinction `closedPositionRequired` exists to preserve.
 */
export function gradeChordAnswer(userStack: SpelledPitch[], expected: SpelledPitch[]): ChordGradeResult {
  const total = expected.length;
  if (userStack.length !== total) {
    return { correct: false, closedPositionRequired: false, correctToneCount: 0, total };
  }

  // Match each expected tone to the user tone sharing its letter+accidental.
  const matched = expected.map((exp) => userStack.find((u) => pitchClassEqual(u, exp)) ?? null);
  const correctToneCount = matched.filter(Boolean).length;
  if (correctToneCount < total) {
    return { correct: false, closedPositionRequired: false, correctToneCount, total };
  }

  // Every pitch class present — check whether one consistent octave shift
  // (measured from the bass, expected[0]) reproduces the user's exact stack.
  const shift = matched[0]!.octave - expected[0]!.octave;
  const correct = matched.every((u, i) => u!.octave === expected[i]!.octave + shift);
  return {
    correct,
    closedPositionRequired: !correct,
    correctToneCount: correct ? total : matched.filter((u, i) => u!.octave === expected[i]!.octave + shift).length,
    total,
  };
}
