import { createPersistedSettingsStore } from './createPersistedSettingsStore';
import { defaultChordSingingSettings, type ChordSingingSettings } from '../../lib/pitch/chordSinging';

export const useChordSingingSettings = createPersistedSettingsStore<ChordSingingSettings>(
  'chord-singing',
  defaultChordSingingSettings(),
);
