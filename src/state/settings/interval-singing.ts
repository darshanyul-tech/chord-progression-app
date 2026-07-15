import { createPersistedSettingsStore } from './createPersistedSettingsStore';
import { defaultIntervalSingingSettings, type IntervalSingingSettings } from '../../lib/pitch/settings';

export const useIntervalSingingSettings = createPersistedSettingsStore<IntervalSingingSettings>(
  'interval-singing',
  defaultIntervalSingingSettings(),
);
