import { createPersistedSettingsStore } from './createPersistedSettingsStore';
import { defaultMeterTranspositionSettings, type MeterTranspositionSettings } from '../../lib/written-theory/meterTransposition';

export const useMeterTranspositionSettings = createPersistedSettingsStore<MeterTranspositionSettings>(
  'meter-transposition',
  defaultMeterTranspositionSettings(),
);
