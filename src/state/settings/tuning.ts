import { createPersistedSettingsStore } from './createPersistedSettingsStore';
import { defaultTuningSettings, type TuningSettings } from '../../lib/recognition/tuning';

export const useTuningSettings = createPersistedSettingsStore<TuningSettings>('tuning', defaultTuningSettings());
