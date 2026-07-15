import { createPersistedSettingsStore } from './createPersistedSettingsStore';
import { defaultRhythmDictationSettings, type RhythmDictationSettings } from '../../lib/rhythm/settings';

export const useRhythmDictationSettings = createPersistedSettingsStore<RhythmDictationSettings>(
  'rhythm-dictation',
  defaultRhythmDictationSettings(),
  // Pre-v1.1 builds mislabeled "dotted half" as 2.5 beats instead of the
  // musically-correct 3 — remap any persisted 2.5 so existing users don't
  // lose the setting or see it silently misrender.
  (s) => ({ ...s, durations: s.durations.map((d) => (d === 2.5 ? 3 : d)) }),
);
