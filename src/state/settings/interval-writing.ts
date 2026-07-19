import { createPersistedSettingsStore } from './createPersistedSettingsStore';
import { defaultIntervalWritingSettings, type IntervalWritingSettings } from '../../lib/written-theory/intervalWriting';

export const useIntervalWritingSettings = createPersistedSettingsStore<IntervalWritingSettings>(
  'interval-writing',
  defaultIntervalWritingSettings(),
);
