// Tier-1 builder for Theory Topic 06 — Scale Writing (docs/15-theory-topics/06).
import { NATURAL_LETTERS, staffLineFor, type Clef } from '../melody/theory';
import { pick } from '../theory';
import { scaleNeedsDoubleAccidentals, spellWrittenScale, writtenScaleTypeById, type WrittenScaleType } from './scaleSpelling';
import type { Accidental, SpelledPitch } from './spelledPitch';

export type ScaleWritingDirection = 'ascending' | 'descending' | 'both';

export interface ScaleWritingSettings extends Record<string, unknown> {
  scales: string[];
  direction: ScaleWritingDirection;
  clefs: Clef[];
  hearIt: boolean;
  autoAdvance: boolean;
}

export function defaultScaleWritingSettings(): ScaleWritingSettings {
  return {
    scales: ['major', 'naturalMinor'],
    direction: 'ascending',
    clefs: ['treble', 'bass'],
    hearIt: false,
    autoAdvance: false,
  };
}

// ±2 ledger lines around the staff (same window as Note Reading/Interval Writing).
const WINDOW_LOW = -1;
const WINDOW_HIGH = 7;

function withinWindow(letter: string, octave: number, clef: Clef): boolean {
  const line = staffLineFor(NATURAL_LETTERS.indexOf(letter), octave, clef);
  return line >= WINDOW_LOW && line <= WINDOW_HIGH;
}

function tonicCandidates(): SpelledPitch[] {
  const out: SpelledPitch[] = [];
  for (let octave = 2; octave <= 6; octave++) {
    NATURAL_LETTERS.forEach((letter) => {
      (['', '#', 'b'] as Accidental[]).forEach((acc) => out.push({ letter, acc, octave }));
    });
  }
  return out;
}

/** Ascending spelling, all 8 notes fit the window. */
function fits(tonic: SpelledPitch, type: WrittenScaleType, clef: Clef): boolean {
  if (!withinWindow(tonic.letter, tonic.octave, clef)) return false;
  return spellWrittenScale(tonic, type).every((n) => withinWindow(n.letter, n.octave, clef));
}

export interface ScaleWritingQuestion {
  clef: Clef;
  type: WrittenScaleType;
  direction: 'ascending' | 'descending';
  tonic: SpelledPitch;
  /** Always in performance (left-to-right) order — for descending, index 0 is the *upper* tonic (docs §4). */
  expected: SpelledPitch[];
}

/** Melodic minor descending is the classical exception: natural-minor spellings, not the ascending form reversed (docs §3). */
function effectiveType(type: WrittenScaleType, direction: 'ascending' | 'descending'): WrittenScaleType {
  return type.id === 'melodicMinor' && direction === 'descending' ? writtenScaleTypeById('naturalMinor') : type;
}

function expectedForDirection(tonic: SpelledPitch, type: WrittenScaleType, direction: 'ascending' | 'descending'): SpelledPitch[] {
  const spelled = spellWrittenScale(tonic, effectiveType(type, direction));
  return direction === 'ascending' ? spelled : [...spelled].reverse();
}

export function buildScaleWritingQuestion(settings: ScaleWritingSettings): ScaleWritingQuestion | null {
  if (!settings.scales.length || !settings.clefs.length) return null;
  const typeId = pick(settings.scales);
  const type = writtenScaleTypeById(typeId);
  const clef = pick(settings.clefs);
  const direction: 'ascending' | 'descending' =
    settings.direction === 'both' ? pick(['ascending', 'descending']) : settings.direction;

  // The pool filter must check whichever scale form this *direction* actually
  // spells (the melodic-minor-descending exception uses a different table
  // than ascending — a tonic can be double-accidental-free in one but not
  // the other, e.g. Db: melodic minor is fine, but its natural-minor form
  // needs Bbb).
  const spellingType = effectiveType(type, direction);
  const pool = tonicCandidates().filter((t) => !scaleNeedsDoubleAccidentals(t, spellingType) && fits(t, spellingType, clef));
  if (!pool.length) return null;
  const tonic = pick(pool);
  const expected = expectedForDirection(tonic, type, direction);
  return { clef, type, direction, tonic, expected };
}

export function scaleWritingPromptText(q: ScaleWritingQuestion): string {
  const glyph = q.tonic.acc === '#' ? '♯' : q.tonic.acc === 'b' ? '♭' : '';
  return `Write the ${q.tonic.letter}${glyph} ${q.type.label} scale, ${q.direction}.`;
}

/** True for a melodic-minor descending question — the answer key teaches the classical exception explicitly (docs §3/§6). */
export function isMelodicMinorDescendingException(q: ScaleWritingQuestion): boolean {
  return q.type.id === 'melodicMinor' && q.direction === 'descending';
}
