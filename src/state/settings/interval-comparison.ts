import { createPersistedSettingsStore } from './createPersistedSettingsStore';
import {
  defaultIntervalComparisonSettings,
  type IntervalComparisonSettings,
} from '../../lib/recognition/intervalComparison';

export const useIntervalComparisonSettings = createPersistedSettingsStore<IntervalComparisonSettings>(
  'interval-comparison',
  defaultIntervalComparisonSettings(),
);
