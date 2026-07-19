// Tier-1 builder for Theory Topic 04 — Scale Home Keys (docs/15-theory-topics/04).
import { pick } from '../theory';
import { keysWithin, theoryKeyById } from './keys';
import { spellingLabel, transposeUp, type IntervalLike, type SpelledPitch } from './spelledPitch';

export type ScaleHomeKeyModeId = 'ionian' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'aeolian' | 'locrian';
export type ScaleHomeKeyReverse = 'off' | 'mixed' | 'only';
export type ScaleHomeKeyDirection = 'forward' | 'reverse';

export interface ScaleHomeKeysSettings extends Record<string, unknown> {
  modes: ScaleHomeKeyModeId[];
  maxAccidentals: number;
  reverse: ScaleHomeKeyReverse;
  autoAdvance: boolean;
}

export function defaultScaleHomeKeysSettings(): ScaleHomeKeysSettings {
  return {
    modes: ['dorian', 'lydian', 'mixolydian', 'aeolian'],
    maxAccidentals: 5,
    reverse: 'off',
    autoAdvance: false,
  };
}

interface ModeDef {
  id: ScaleHomeKeyModeId;
  label: string;
  /** The mode's own degree of its home key's major scale, and the interval from home-key tonic up to this mode's tonic (docs §3 table). */
  interval: IntervalLike;
}

// docs/15-theory-topics/04 §3 table — degree number IS the interval number.
export const SCALE_HOME_KEY_MODES: ModeDef[] = [
  { id: 'ionian', label: 'Ionian', interval: { number: 1, semitones: 0 } },
  { id: 'dorian', label: 'Dorian', interval: { number: 2, semitones: 2 } },
  { id: 'phrygian', label: 'Phrygian', interval: { number: 3, semitones: 4 } },
  { id: 'lydian', label: 'Lydian', interval: { number: 4, semitones: 5 } },
  { id: 'mixolydian', label: 'Mixolydian', interval: { number: 5, semitones: 7 } },
  { id: 'aeolian', label: 'Aeolian', interval: { number: 6, semitones: 9 } },
  { id: 'locrian', label: 'Locrian', interval: { number: 7, semitones: 11 } },
];

function modeById(id: ScaleHomeKeyModeId): ModeDef {
  const found = SCALE_HOME_KEY_MODES.find((m) => m.id === id);
  if (!found) throw new Error(`Unknown mode: ${id}`);
  return found;
}

export interface ScaleHomeKeyQuestion {
  direction: ScaleHomeKeyDirection;
  modeId: ScaleHomeKeyModeId;
  tonic: SpelledPitch;
  homeKeyId: string;
  /** The TheoryKey id for forward questions, or the mode id for reverse — the id the choice grid expects. */
  answerId: string;
}

export function buildScaleHomeKeyQuestion(settings: ScaleHomeKeysSettings): ScaleHomeKeyQuestion | null {
  if (!settings.modes.length) return null;
  const pool = keysWithin(settings.maxAccidentals, 'major');
  if (!pool.length) return null;
  const modeId = pick(settings.modes);
  const mode = modeById(modeId);
  const homeKey = pick(pool);
  // Tonic-from-home-key (never home-key-from-tonic) so the tonic is always
  // guaranteed to land on a real spelling — building it the other way
  // around can land on a home key like A# major that doesn't exist (docs §3).
  const tonic = transposeUp({ letter: homeKey.tonic.letter, acc: homeKey.tonic.acc, octave: 4 }, mode.interval);
  const direction: ScaleHomeKeyDirection =
    settings.reverse === 'only' ? 'reverse' : settings.reverse === 'off' ? 'forward' : pick(['forward', 'reverse']);
  return {
    direction,
    modeId,
    tonic,
    homeKeyId: homeKey.id,
    answerId: direction === 'forward' ? homeKey.id : modeId,
  };
}

export interface ScaleHomeKeyChoice {
  id: string;
  label: string;
}

/** Forward -> all 15 major keys (fixed full grid, same rationale as Key Signatures); reverse -> all 7 modes (docs §3). */
export function buildScaleHomeKeyChoices(direction: ScaleHomeKeyDirection): ScaleHomeKeyChoice[] {
  if (direction === 'reverse') {
    return SCALE_HOME_KEY_MODES.map((m) => ({ id: m.id, label: m.label }));
  }
  return keysWithin(7, 'major').map((k) => ({ id: k.id, label: k.label }));
}

/** "<tonic> <Mode>" for forward; the home key + starting note for reverse (docs §3). */
export function scaleHomeKeyPromptText(q: ScaleHomeKeyQuestion): string {
  const mode = modeById(q.modeId);
  const tonicLabel = spellingLabel(q.tonic);
  if (q.direction === 'forward') {
    return `${tonicLabel} ${mode.label} — what is its home key?`;
  }
  const homeKey = theoryKeyById(q.homeKeyId);
  return `${homeKey.label}, starting on ${tonicLabel} — which mode is this?`;
}

export function scaleHomeKeyRevealText(q: ScaleHomeKeyQuestion): string {
  const mode = modeById(q.modeId);
  const homeKey = theoryKeyById(q.homeKeyId);
  return q.direction === 'forward'
    ? `${homeKey.label} — the notes of ${homeKey.label}, starting on its ${mode.interval.number}${ordinalSuffix(mode.interval.number)} degree.`
    : `${mode.label} — ${homeKey.label} starting on its ${mode.interval.number}${ordinalSuffix(mode.interval.number)} degree is ${mode.label}.`;
}

function ordinalSuffix(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return 'st';
  if (n % 10 === 2 && n % 100 !== 12) return 'nd';
  if (n % 10 === 3 && n % 100 !== 13) return 'rd';
  return 'th';
}
