import { createPersistedSettingsStore } from './createPersistedSettingsStore';
import { defaultScaleWritingSettings, type ScaleWritingSettings } from '../../lib/written-theory/scaleWriting';

export const useScaleWritingSettings = createPersistedSettingsStore<ScaleWritingSettings>(
  'scale-writing',
  defaultScaleWritingSettings(),
);
