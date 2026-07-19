import { createPersistedSettingsStore } from './createPersistedSettingsStore';
import { defaultNoteReadingSettings, type NoteReadingSettings } from '../../lib/written-theory/noteReading';

export const useNoteReadingSettings = createPersistedSettingsStore<NoteReadingSettings>(
  'note-reading',
  defaultNoteReadingSettings(),
);
