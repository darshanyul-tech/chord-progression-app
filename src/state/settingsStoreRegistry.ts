import { useChordComparisonSettings } from './settings/chord-comparison';
import { useProgressionSettings } from './settings/chord-progressions';
import { useChordRecognitionSettings } from './settings/chord-recognition';
import { useChordSingingSettings } from './settings/chord-singing';
import { useDynamicsArticulationSettings } from './settings/dynamics-articulation';
import { useIntervalComparisonSettings } from './settings/interval-comparison';
import { useIntervalRecognitionSettings } from './settings/interval-recognition';
import { useIntervalSingingSettings } from './settings/interval-singing';
import { useMelodicDictationSettings } from './settings/melodic-dictation';
import { useMeterRecognitionSettings } from './settings/meter-recognition';
import { useRhythmDictationSettings } from './settings/rhythm-dictation';
import { useScaleRecognitionSettings } from './settings/scales';
import { useTuningSettings } from './settings/tuning';

/** The minimal shape Custom Topics needs from any topic's settings store — every `createPersistedSettingsStore` result satisfies this. */
export interface SettingsStoreHandle {
  getState(): Record<string, unknown>;
  setState(partial: Record<string, unknown>): void;
}

/**
 * Maps a topic id to its persisted settings store — used only by Custom
 * Topics (docs/05-topics/14) to snapshot a topic's live settings into a
 * preset, and later apply a preset back onto that same store. There's no
 * way to derive this generically from the topic registry (each store's
 * settings shape is unique), so every settings-bearing active topic needs
 * one line here.
 */
export const SETTINGS_STORE_REGISTRY: Record<string, SettingsStoreHandle> = {
  'chord-comparison': useChordComparisonSettings as unknown as SettingsStoreHandle,
  'chord-progressions': useProgressionSettings as unknown as SettingsStoreHandle,
  'chord-recognition': useChordRecognitionSettings as unknown as SettingsStoreHandle,
  'chord-singing': useChordSingingSettings as unknown as SettingsStoreHandle,
  'dynamics-articulation': useDynamicsArticulationSettings as unknown as SettingsStoreHandle,
  'interval-comparison': useIntervalComparisonSettings as unknown as SettingsStoreHandle,
  'interval-recognition': useIntervalRecognitionSettings as unknown as SettingsStoreHandle,
  'interval-singing': useIntervalSingingSettings as unknown as SettingsStoreHandle,
  'melodic-dictation': useMelodicDictationSettings as unknown as SettingsStoreHandle,
  'meter-recognition': useMeterRecognitionSettings as unknown as SettingsStoreHandle,
  'rhythm-dictation': useRhythmDictationSettings as unknown as SettingsStoreHandle,
  scales: useScaleRecognitionSettings as unknown as SettingsStoreHandle,
  tuning: useTuningSettings as unknown as SettingsStoreHandle,
};
