import type { RestFrequency, SyncopationLevel } from './generator';
import type { SoundType } from '../audio/percussion';

// Persisted settings shape (docs/05-topics/05-rhythm-dictation.md §2 storage schema).
export interface RhythmDictationSettings extends Record<string, unknown> {
  signatures: string[];
  durations: number[];
  restFrequency: RestFrequency;
  syncopation: SyncopationLevel;
  triplets: boolean;
  measures: number;
  tempo: number;
  sound: SoundType;
  emphasis: number;
  metroVolume: number;
}

export function defaultRhythmDictationSettings(): RhythmDictationSettings {
  return {
    signatures: ['2/4', '3/4', '4/4'],
    durations: [4, 2, 1, 0.5, 1.5],
    restFrequency: 'moderate',
    syncopation: 'off',
    triplets: false,
    measures: 4,
    tempo: 84,
    sound: 'percussive',
    emphasis: 60,
    metroVolume: 50,
  };
}
