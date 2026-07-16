import { createPersistedSettingsStore } from './createPersistedSettingsStore';
import { defaultSightSingingSettings, type SightSingingSettings } from '../../lib/pitch/sightSinging';

export const useSightSingingSettings = createPersistedSettingsStore<SightSingingSettings>(
  'sight-singing',
  defaultSightSingingSettings(),
);
