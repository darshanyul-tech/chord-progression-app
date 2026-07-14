import { createPersistedSettingsStore } from './createPersistedSettingsStore';
import {
  defaultIntervalRecognitionSettings,
  type IntervalRecognitionSettings,
} from '../../lib/recognition/intervals';

export const useIntervalRecognitionSettings = createPersistedSettingsStore<IntervalRecognitionSettings>(
  'interval-recognition',
  defaultIntervalRecognitionSettings(),
);
