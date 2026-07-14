import { createPersistedSettingsStore } from './createPersistedSettingsStore';
import { defaultProgressionSettings, type ProgressionSettings } from '../../lib/progression/settings';

export const useProgressionSettings = createPersistedSettingsStore<ProgressionSettings>(
  'chord-progressions',
  defaultProgressionSettings(),
);
