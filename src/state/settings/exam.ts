import { createPersistedSettingsStore } from './createPersistedSettingsStore';

// Persisted per docs/06-exam-mode.md §B5: eartrainer.v1.settings.exam.
// Keyed by exam type id; new types simply won't have an entry in an old
// persisted blob and fall back to their own schema defaults at read time
// (see ExamSetup), so this stays forward-compatible across phases.
export interface ExamTypeConfig {
  enabled: boolean;
  settings: Record<string, number>;
}

export interface ExamSettings extends Record<string, unknown> {
  types: Record<string, ExamTypeConfig>;
}

export function defaultExamSettings(): ExamSettings {
  return { types: {} };
}

export const useExamSettings = createPersistedSettingsStore<ExamSettings>('exam', defaultExamSettings());
