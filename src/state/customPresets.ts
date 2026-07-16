import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  addPreset as addPresetPure,
  applyPresetSnapshot,
  deletePreset as deletePresetPure,
  renamePreset as renamePresetPure,
  sanitizePresets,
  type CustomPreset,
} from '../lib/custom/presets';
import { TOPICS } from '../topics/registry';
import { safeStorage } from './settings/createPersistedSettingsStore';
import { SETTINGS_STORE_REGISTRY } from './settingsStoreRegistry';

interface CustomPresetsState {
  presets: CustomPreset[];
  /** Presets dropped at restore because their topic no longer resolves (docs/05-topics/14 §3) — surfaced by the management page. */
  droppedCount: number;
  addPreset(topicId: string, name: string, settings: Record<string, unknown>): void;
  renamePreset(id: string, newName: string): void;
  deletePreset(id: string): void;
  /** Overwrites the target topic's live settings store with the preset's snapshot (§2 — "apply" always overwrites; presets are re-saved explicitly, never live-bound). */
  applyPreset(id: string): void;
}

export const useCustomPresets = create<CustomPresetsState>()(
  persist(
    (set, get) => ({
      presets: [],
      droppedCount: 0,
      addPreset: (topicId, name, settings) =>
        set((s) => ({ presets: addPresetPure(s.presets, topicId, name, settings) })),
      renamePreset: (id, newName) => set((s) => ({ presets: renamePresetPure(s.presets, id, newName) })),
      deletePreset: (id) => set((s) => ({ presets: deletePresetPure(s.presets, id) })),
      applyPreset: (id) => {
        const preset = get().presets.find((p) => p.id === id);
        if (!preset) return;
        const store = SETTINGS_STORE_REGISTRY[preset.topicId];
        if (!store) return;
        store.setState(applyPresetSnapshot(store.getState(), preset.settings));
      },
    }),
    {
      name: 'eartrainer.v1.customPresets',
      version: 1,
      storage: safeStorage<CustomPresetsState>(),
      merge: (persisted, current) => {
        // TOPICS is read here (not at module top-level) deliberately: this
        // module sits in an import cycle with topics/registry.ts (via
        // CustomTopicManagementPage), so reading TOPICS.map() at module-eval
        // time can observe it mid-initialization (undefined). merge() only
        // runs once zustand actually rehydrates from storage, by which
        // point the whole module graph has finished loading.
        const knownTopicIds = TOPICS.map((t) => t.id);
        const rawPresets = (persisted as Partial<CustomPresetsState> | null)?.presets;
        const { presets, droppedCount } = sanitizePresets(rawPresets, knownTopicIds);
        return { ...current, presets, droppedCount };
      },
    },
  ),
);
