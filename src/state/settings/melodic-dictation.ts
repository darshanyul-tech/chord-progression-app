import { createPersistedSettingsStore } from './createPersistedSettingsStore';
import { defaultMelodicDictationSettings, type MelodicDictationSettings } from '../../lib/melody/settings';

export const useMelodicDictationSettings = createPersistedSettingsStore<MelodicDictationSettings>(
  'melodic-dictation',
  defaultMelodicDictationSettings(),
);
