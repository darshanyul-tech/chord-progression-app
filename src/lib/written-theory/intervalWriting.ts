// Tier-1 builder for Theory Topic 05 — Interval Writing (docs/15-theory-topics/05).
import { lineToLetterOctave, NATURAL_LETTERS, staffLineFor, type Clef } from '../melody/theory';
import { pick } from '../theory';
import { INTERVALS, transposeDown, transposeUp, type Accidental, type SpelledPitch } from './spelledPitch';

export type IntervalWritingDirection = 'above' | 'below' | 'both';

export interface IntervalWritingSettings extends Record<string, unknown> {
  intervals: string[];
  direction: IntervalWritingDirection;
  clefs: Clef[];
  hearIt: boolean;
  autoAdvance: boolean;
}

export function defaultIntervalWritingSettings(): IntervalWritingSettings {
  return {
    intervals: ['M2', 'm3', 'M3', 'P4', 'P5', 'M6', 'P8'],
    direction: 'above',
    clefs: ['treble', 'bass'],
    hearIt: false,
    autoAdvance: false,
  };
}

// ±2 ledger lines around the staff, same window convention as Note Reading
// (docs/15-theory-topics/01 §3) — lines 1-5 extended by 2 each side.
const WINDOW_LOW = -1;
const WINDOW_HIGH = 7;

function withinWindow(letter: string, octave: number, clef: Clef): boolean {
  const letterIndex = NATURAL_LETTERS.indexOf(letter);
  const line = staffLineFor(letterIndex, octave, clef);
  return line >= WINDOW_LOW && line <= WINDOW_HIGH;
}

function windowSpellings(clef: Clef): SpelledPitch[] {
  const out: SpelledPitch[] = [];
  for (let line = WINDOW_LOW; line <= WINDOW_HIGH; line += 0.5) {
    const { letterIndex, octave } = lineToLetterOctave(line, clef);
    const letter = NATURAL_LETTERS[letterIndex]!;
    (['', '#', 'b'] as Accidental[]).forEach((acc) => out.push({ letter, acc, octave }));
  }
  return out;
}

export interface IntervalWritingQuestion {
  clef: Clef;
  given: SpelledPitch;
  intervalId: string;
  direction: 'above' | 'below';
  expected: SpelledPitch;
}

export function buildIntervalWritingQuestion(settings: IntervalWritingSettings): IntervalWritingQuestion | null {
  if (!settings.intervals.length || !settings.clefs.length) return null;
  const intervalId = pick(settings.intervals);
  const interval = INTERVALS.find((i) => i.id === intervalId);
  if (!interval) return null;
  const direction: 'above' | 'below' =
    settings.direction === 'both' ? pick(['above', 'below']) : settings.direction;
  const clef = pick(settings.clefs);

  // Pool: any natural/single-accidental given note in the window whose
  // target also needs no double accidental and lands inside the same window.
  const pool = windowSpellings(clef).filter((given) => {
    const expected = direction === 'above' ? transposeUp(given, interval) : transposeDown(given, interval);
    if (expected.acc === '##' || expected.acc === 'bb') return false;
    return withinWindow(expected.letter, expected.octave, clef);
  });
  if (!pool.length) return null;
  const given = pick(pool);
  const expected = direction === 'above' ? transposeUp(given, interval) : transposeDown(given, interval);
  return { clef, given, intervalId, direction, expected };
}

export function intervalWritingPromptText(q: IntervalWritingQuestion): string {
  const interval = INTERVALS.find((i) => i.id === q.intervalId)!;
  return `Write a ${interval.label.toLowerCase()} ${q.direction} the given note.`;
}
