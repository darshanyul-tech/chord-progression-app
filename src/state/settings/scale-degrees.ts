import { createPersistedSettingsStore } from './createPersistedSettingsStore';
import { defaultScaleDegreesSettings, type ScaleDegreesSettings } from '../../lib/written-theory/scaleDegrees';

export const useScaleDegreesSettings = createPersistedSettingsStore<ScaleDegreesSettings>(
  'scale-degrees',
  defaultScaleDegreesSettings(),
);
