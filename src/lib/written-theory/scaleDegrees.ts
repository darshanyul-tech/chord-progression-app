// Tier-1 builder for Theory Topic 03 — Scale Degrees (docs/15-theory-topics/03).
import { NATURAL_LETTERS, staffLineFor, type Clef } from '../melody/theory';
import { pick } from '../theory';
import { DEGREE_NAMES } from './degrees';
import { keysWithin, scaleSpelling, type KeyMode, type TheoryKey } from './keys';
import { spellingLabel, type SpelledPitch } from './spelledPitch';

export type ScaleDegreeKeysFilter = KeyMode | 'both';
export type ScaleDegreeDisplay = 'staffAndText' | 'textOnly';
export type ScaleDegreeLabels = 'numbers' | 'names';

export interface ScaleDegreesSettings extends Record<string, unknown> {
  keys: ScaleDegreeKeysFilter;
  maxAccidentals: number;
  display: ScaleDegreeDisplay;
  degreeLabels: ScaleDegreeLabels;
  autoAdvance: boolean;
}

export function defaultScaleDegreesSettings(): ScaleDegreesSettings {
  return { keys: 'both', maxAccidentals: 4, display: 'staffAndText', degreeLabels: 'numbers', autoAdvance: false };
}

const DEGREE_INDICES = [0, 1, 2, 3, 4, 5, 6];

// Nearest-the-middle-line tie-break (docs §3): searches a generous octave
// band and keeps the first (lowest-octave) minimum found, since ascending
// iteration order already prefers the lower octave on a tie.
function nearestMiddleLineOctave(letter: string, clef: Clef): number {
  const letterIndex = NATURAL_LETTERS.indexOf(letter);
  let bestOctave = 3;
  let bestDist = Infinity;
  for (let octave = 2; octave <= 6; octave++) {
    const dist = Math.abs(staffLineFor(letterIndex, octave, clef) - 3);
    if (dist < bestDist) {
      bestDist = dist;
      bestOctave = octave;
    }
  }
  return bestOctave;
}

/** Auto clef + octave: bass when the treble-natural octave sits below C4, else treble (docs §3). */
function pickClefAndOctave(letter: string): { clef: Clef; octave: number } {
  const trebleOctave = nearestMiddleLineOctave(letter, 'treble');
  if (trebleOctave < 4) {
    return { clef: 'bass', octave: nearestMiddleLineOctave(letter, 'bass') };
  }
  return { clef: 'treble', octave: trebleOctave };
}

export interface ScaleDegreeQuestion {
  key: TheoryKey;
  degree: number;
  note: SpelledPitch;
  clef: Clef;
  promptText: string;
}

export function buildScaleDegreeQuestion(settings: ScaleDegreesSettings): ScaleDegreeQuestion | null {
  const pool = keysWithin(settings.maxAccidentals, settings.keys);
  if (!pool.length) return null;
  const key = pick(pool);
  const degreeIndex = pick(DEGREE_INDICES);
  const degreeSpelling = scaleSpelling(key)[degreeIndex]!;
  const { clef, octave } = pickClefAndOctave(degreeSpelling.letter);
  const note: SpelledPitch = { letter: degreeSpelling.letter, acc: degreeSpelling.acc, octave };
  return {
    key,
    degree: degreeIndex + 1,
    note,
    clef,
    promptText: `Key: ${key.label} — what degree is ${spellingLabel(note)}?`,
  };
}

export interface ScaleDegreeChoice {
  id: string;
  label: string;
}

const NUMERALS = ['1̂', '2̂', '3̂', '4̂', '5̂', '6̂', '7̂'];

/** Fixed 7-button grid; label combines numeral + name, ordered per the degreeLabels setting so both stay visible (docs §3). */
export function buildScaleDegreeChoices(mode: KeyMode, degreeLabels: ScaleDegreeLabels): ScaleDegreeChoice[] {
  const names = DEGREE_NAMES(mode);
  return NUMERALS.map((numeral, i) => ({
    id: String(i + 1),
    label: degreeLabels === 'numbers' ? `${numeral} — ${names[i]}` : `${names[i]} — ${numeral}`,
  }));
}

export function scaleDegreeRevealText(key: TheoryKey, degree: number): string {
  const names = DEGREE_NAMES(key.mode);
  return `${NUMERALS[degree - 1]} — the ${names[degree - 1].toLowerCase()} of ${key.label}`;
}
