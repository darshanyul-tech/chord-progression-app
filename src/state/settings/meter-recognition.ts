import { createPersistedSettingsStore } from './createPersistedSettingsStore';
import { defaultMeterRecognitionSettings, type MeterRecognitionSettings } from '../../lib/recognition/meter';

export const useMeterRecognitionSettings = createPersistedSettingsStore<MeterRecognitionSettings>(
  'meter-recognition',
  defaultMeterRecognitionSettings(),
);
