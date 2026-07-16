import { createPersistedSettingsStore } from './createPersistedSettingsStore';
import { defaultChordComparisonSettings, type ChordComparisonSettings } from '../../lib/recognition/chordComparison';

export const useChordComparisonSettings = createPersistedSettingsStore<ChordComparisonSettings>(
  'chord-comparison',
  defaultChordComparisonSettings(),
);
