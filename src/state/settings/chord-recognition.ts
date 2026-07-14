import { createPersistedSettingsStore } from './createPersistedSettingsStore';
import {
  defaultChordRecognitionSettings,
  type ChordRecognitionSettings,
} from '../../lib/recognition/chords';

export const useChordRecognitionSettings = createPersistedSettingsStore<ChordRecognitionSettings>(
  'chord-recognition',
  defaultChordRecognitionSettings(),
);
