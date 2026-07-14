import { createPersistedSettingsStore } from './createPersistedSettingsStore';
import {
  defaultScaleRecognitionSettings,
  type ScaleRecognitionSettings,
} from '../../lib/recognition/scales';

export const useScaleRecognitionSettings = createPersistedSettingsStore<ScaleRecognitionSettings>(
  'scales',
  defaultScaleRecognitionSettings(),
);
