import type { RestFrequency, SyncopationLevel } from '../rhythm/generator';
import type { Clef, MelodyRange } from './theory';

// Persisted settings shape (docs/05-topics/07-melodic-dictation.md §2 storage schema).
export type ChromaticSetting = 'none' | 'light' | 'moderate';
export type MelodicMotion = 'steps' | 'mixed' | 'leapy';
export type ClefSetting = Clef | 'random';

export interface MelodicDictationSettings extends Record<string, unknown> {
  clef: ClefSetting;
  key: string;
  randomKey: boolean;
  range: MelodyRange;
  chromatic: ChromaticSetting;
  signatures: string[];
  durations: number[];
  rests: RestFrequency;
  syncopation: SyncopationLevel;
  measures: number;
  tempo: number;
  motion: MelodicMotion;
  /** Auditions a note's pitch on the sampler right after you place or nudge it. Practice only — exam mode never previews. */
  previewOnPlace: boolean;
}

export function defaultMelodicDictationSettings(): MelodicDictationSettings {
  return {
    clef: 'treble',
    key: 'C',
    randomKey: false,
    range: 'narrow',
    chromatic: 'none',
    signatures: ['2/4', '3/4', '4/4'],
    durations: [2, 1, 0.5, 1.5],
    rests: 'none',
    syncopation: 'off',
    measures: 2,
    tempo: 76,
    motion: 'steps',
    previewOnPlace: true,
  };
}
