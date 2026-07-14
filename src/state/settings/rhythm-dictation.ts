import { createPersistedSettingsStore } from './createPersistedSettingsStore';
import { defaultRhythmDictationSettings, type RhythmDictationSettings } from '../../lib/rhythm/settings';

export const useRhythmDictationSettings = createPersistedSettingsStore<RhythmDictationSettings>(
  'rhythm-dictation',
  defaultRhythmDictationSettings(),
);
