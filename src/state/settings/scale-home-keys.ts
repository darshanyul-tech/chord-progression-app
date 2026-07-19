import { createPersistedSettingsStore } from './createPersistedSettingsStore';
import { defaultScaleHomeKeysSettings, type ScaleHomeKeysSettings } from '../../lib/written-theory/scaleHomeKeys';

export const useScaleHomeKeysSettings = createPersistedSettingsStore<ScaleHomeKeysSettings>(
  'scale-home-keys',
  defaultScaleHomeKeysSettings(),
);
