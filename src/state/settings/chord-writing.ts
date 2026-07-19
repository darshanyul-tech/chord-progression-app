import { createPersistedSettingsStore } from './createPersistedSettingsStore';
import { defaultChordWritingSettings, type ChordWritingSettings } from '../../lib/written-theory/chordWriting';

export const useChordWritingSettings = createPersistedSettingsStore<ChordWritingSettings>(
  'chord-writing',
  defaultChordWritingSettings(),
);
