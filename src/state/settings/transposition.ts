import { createPersistedSettingsStore } from './createPersistedSettingsStore';
import { defaultTranspositionSettings, type TranspositionSettings } from '../../lib/written-theory/transposition';

export const useTranspositionSettings = createPersistedSettingsStore<TranspositionSettings>(
  'transposition',
  defaultTranspositionSettings(),
);
