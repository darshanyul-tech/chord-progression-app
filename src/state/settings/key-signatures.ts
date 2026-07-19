import { createPersistedSettingsStore } from './createPersistedSettingsStore';
import { defaultKeySignatureSettings, type KeySignatureSettings } from '../../lib/written-theory/keySignatures';

export const useKeySignatureSettings = createPersistedSettingsStore<KeySignatureSettings>(
  'key-signatures',
  defaultKeySignatureSettings(),
);
