// Tier-1 builder for Theory Topic 08 — Transposition (docs/15-theory-topics/08).
// Melody source reuses lib/melody/generator + MELODY_KEYS exactly (docs §3).
import { generateMelody, type GeneratedMelody } from '../melody/generator';
import { defaultMelodicDictationSettings } from '../melody/settings';
import { MELODY_KEYS, NATURAL_LETTERS, staffLineFor, type Clef, type PitchedMeasure } from '../melody/theory';
import type { TimeSigInfo } from '../rhythm/time';
import { pick, random } from '../theory';
import { keysWithin, scaleSpelling, theoryKeyById, THEORY_KEYS, type TheoryKey } from './keys';
import { INTERVALS, spelledToMidi, spellingLabel, transposeDown, transposeUp, type IntervalDef, type SpelledPitch } from './spelledPitch';

export type TranspositionMode = 'toKey' | 'byInterval' | 'both';
export type IntervalPhrasing = 'names' | 'semitones' | 'mixed';

export interface TranspositionSettings extends Record<string, unknown> {
  mode: TranspositionMode;
  phrasing: IntervalPhrasing;
  intervals: string[];
  length: 1 | 2;
  clef: Clef;
  autoAdvance: boolean;
}

export function defaultTranspositionSettings(): TranspositionSettings {
  return {
    mode: 'both',
    phrasing: 'names',
    intervals: ['M2', 'm3', 'M3', 'P4', 'P5', 'M6', 'P8'],
    length: 1,
    clef: 'treble',
    autoAdvance: false,
  };
}

const MAJOR_MELODY_KEYS = MELODY_KEYS.filter((k) => k.mode === 'major');
const MAX_RETRIES = 20;

/** Finds the exact octave making a (letter, acc) spelling equal this MIDI note — the source key's scaleSpelling is octave-free, so this pins the specific octave the generator's note actually sounds at. */
function spellNoteInKey(midi: number, key: TheoryKey): SpelledPitch {
  const degrees = scaleSpelling(key);
  for (const d of degrees) {
    for (let octave = -1; octave <= 10; octave++) {
      const candidate: SpelledPitch = { letter: d.letter, acc: d.acc, octave };
      if (spelledToMidi(candidate) === midi) return candidate;
    }
  }
  throw new Error(`No diatonic spelling found for MIDI ${midi} in key ${key.id}`);
}

function spellMelody(measures: PitchedMeasure[], key: TheoryKey): (SpelledPitch | null)[] {
  return measures.flatMap((bar) => bar.map((n) => (n.rest || n.midi === null ? null : spellNoteInKey(n.midi, key))));
}

function letterAccEqual(a: SpelledPitch, b: { letter: string; acc: string }): boolean {
  return a.letter === b.letter && a.acc === b.acc;
}

interface DirectedInterval {
  interval: IntervalDef;
  direction: 'up' | 'down';
}

/** The up-interval and down-interval (if any) connecting two tonic spellings — both always exist for two distinct THEORY_KEYS major tonics, since m2..P8 span every letter offset. */
function tonicIntervalCandidates(source: SpelledPitch, target: { letter: string; acc: string }): DirectedInterval[] {
  const out: DirectedInterval[] = [];
  for (const interval of INTERVALS) {
    if (interval.id === 'P1') continue;
    try {
      if (letterAccEqual(transposeUp(source, interval), target)) out.push({ interval, direction: 'up' });
    } catch {
      /* offset out of range for this pairing — not a candidate */
    }
    try {
      if (letterAccEqual(transposeDown(source, interval), target)) out.push({ interval, direction: 'down' });
    } catch {
      /* ditto */
    }
  }
  return out;
}

function transposeMelody(spelled: (SpelledPitch | null)[], interval: IntervalDef, direction: 'up' | 'down'): (SpelledPitch | null)[] {
  return spelled.map((n) => (n ? (direction === 'up' ? transposeUp(n, interval) : transposeDown(n, interval)) : null));
}

// Same window convention as the other writing topics (±2 ledger lines).
const WINDOW_LOW = -1;
const WINDOW_HIGH = 7;

function fitsWindow(spelled: (SpelledPitch | null)[], clef: Clef): boolean {
  return spelled.every((n) => {
    if (!n) return true;
    const line = staffLineFor(NATURAL_LETTERS.indexOf(n.letter), n.octave, clef);
    return line >= WINDOW_LOW && line <= WINDOW_HIGH;
  });
}

export interface TranspositionQuestion {
  clef: Clef;
  timeSig: TimeSigInfo;
  sourceKeyId: string;
  sourceMelody: GeneratedMelody;
  sourceSpelled: (SpelledPitch | null)[];
  targetKeyId: string;
  targetVexKeySpec: string;
  mode: 'toKey' | 'byInterval';
  interval: IntervalDef;
  direction: 'up' | 'down';
  /** Which wording the by-interval prompt actually used — decided once at build time (docs §3's "mixed" coin flip must not re-roll on every render). Unused for toKey questions. */
  phraseAsSemitones: boolean;
  expected: (SpelledPitch | null)[];
}

function buildGeneratorSettings(settings: TranspositionSettings, sourceKeyId: string) {
  return {
    ...defaultMelodicDictationSettings(),
    clef: settings.clef,
    key: sourceKeyId,
    randomKey: false,
    range: 'narrow' as const,
    chromatic: 'none' as const,
    signatures: ['4/4'],
    durations: [1, 0.5],
    rests: 'none' as const,
    syncopation: 'off' as const,
    measures: settings.length,
    motion: 'steps' as const,
  };
}

export function buildTranspositionQuestion(settings: TranspositionSettings): TranspositionQuestion | null {
  if (!settings.intervals.length && settings.mode !== 'toKey') return null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const sourceKey = pick(MAJOR_MELODY_KEYS);
    const sourceTheoryKey = theoryKeyById(sourceKey.id);
    const sourceMelody = generateMelody(buildGeneratorSettings(settings, sourceKey.id));
    const sourceSpelled = spellMelody(sourceMelody.measures, sourceTheoryKey);

    const mode: 'toKey' | 'byInterval' = settings.mode === 'both' ? pick(['toKey', 'byInterval']) : settings.mode;

    if (mode === 'toKey') {
      const candidates = keysWithin(5, 'major').filter((k) => k.id !== sourceTheoryKey.id);
      if (!candidates.length) continue;
      const targetKey = pick(candidates);
      const directed = tonicIntervalCandidates(
        { letter: sourceTheoryKey.tonic.letter, acc: sourceTheoryKey.tonic.acc, octave: 4 },
        targetKey.tonic,
      ).sort((a, b) => a.interval.semitones - b.interval.semitones);
      let chosen: DirectedInterval | null = null;
      for (const candidate of directed) {
        const expected = transposeMelody(sourceSpelled, candidate.interval, candidate.direction);
        if (fitsWindow(expected, settings.clef)) {
          chosen = candidate;
          break;
        }
      }
      if (!chosen) continue;
      const expected = transposeMelody(sourceSpelled, chosen.interval, chosen.direction);
      return {
        clef: settings.clef,
        timeSig: sourceMelody.timeSig,
        sourceKeyId: sourceKey.id,
        sourceMelody,
        sourceSpelled,
        targetKeyId: targetKey.id,
        targetVexKeySpec: targetKey.vexKeySpec,
        mode,
        interval: chosen.interval,
        direction: chosen.direction,
        phraseAsSemitones: false, // toKey questions never use interval phrasing
        expected,
      };
    }

    // by-interval mode
    const intervalId = pick(settings.intervals);
    const interval = INTERVALS.find((i) => i.id === intervalId);
    if (!interval) continue;
    const direction: 'up' | 'down' = random() < 0.5 ? 'up' : 'down';
    const phraseAsSemitones = settings.phrasing === 'semitones' || (settings.phrasing === 'mixed' && random() < 0.5);
    const sourceTonic: SpelledPitch = { letter: sourceTheoryKey.tonic.letter, acc: sourceTheoryKey.tonic.acc, octave: 4 };
    let targetTonicSpelled: SpelledPitch;
    try {
      targetTonicSpelled = direction === 'up' ? transposeUp(sourceTonic, interval) : transposeDown(sourceTonic, interval);
    } catch {
      continue;
    }
    const targetKey = THEORY_KEYS.find(
      (k) => k.mode === 'major' && k.accidentalCount <= 7 && letterAccEqual(targetTonicSpelled, k.tonic),
    );
    if (!targetKey) continue;
    const expected = transposeMelody(sourceSpelled, interval, direction);
    if (!fitsWindow(expected, settings.clef)) continue;
    return {
      clef: settings.clef,
      timeSig: sourceMelody.timeSig,
      sourceKeyId: sourceKey.id,
      sourceMelody,
      sourceSpelled,
      targetKeyId: targetKey.id,
      targetVexKeySpec: targetKey.vexKeySpec,
      mode,
      interval,
      direction,
      phraseAsSemitones,
      expected,
    };
  }
  return null;
}

function intervalPhrase(interval: IntervalDef, asSemitones: boolean): string {
  return asSemitones
    ? `${interval.semitones} semitone${interval.semitones === 1 ? '' : 's'}`
    : interval.label.toLowerCase();
}

export function transpositionPromptText(q: TranspositionQuestion): string {
  const sourceLabel = theoryKeyById(q.sourceKeyId).label;
  if (q.mode === 'toKey') {
    const targetLabel = theoryKeyById(q.targetKeyId).label;
    return `Transpose this melody from ${sourceLabel} ${q.direction} to ${targetLabel}.`;
  }
  const phrase = intervalPhrase(q.interval, q.phraseAsSemitones);
  return `Transpose this melody ${q.direction} a ${phrase}.`;
}

export function transpositionRevealNote(spelled: SpelledPitch): string {
  return spellingLabel(spelled);
}
