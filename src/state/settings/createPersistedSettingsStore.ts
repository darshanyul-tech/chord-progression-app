import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware';

// Wraps localStorage so a corrupt blob or a storage failure (private-mode Safari,
// quota) degrades silently to defaults instead of throwing (01-architecture §7, D6).
// Exported for reuse by state/customPresets.ts, which needs the same
// tolerant-storage wrapper for its own (non-per-topic) persisted array.
export function safeStorage<T>(): PersistStorage<T> {
  return {
    getItem: (name) => {
      try {
        const raw = localStorage.getItem(name);
        if (!raw) return null;
        return JSON.parse(raw) as StorageValue<T>;
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        localStorage.setItem(name, JSON.stringify(value));
      } catch {
        // ignore — settings just won't persist this session
      }
    },
    removeItem: (name) => {
      try {
        localStorage.removeItem(name);
      } catch {
        // ignore
      }
    },
  };
}

/**
 * One persisted Zustand slice per topic (D6): localStorage key
 * `eartrainer.v1.settings.<topicId>`. Tolerant restore — `merge` keeps
 * defaults for any key missing from (or unknown to) the persisted blob.
 */
export function createPersistedSettingsStore<T extends Record<string, unknown>>(
  topicId: string,
  defaults: T,
  migrate?: (settings: T) => T,
): UseBoundStore<StoreApi<T>> {
  return create<T>()(
    persist(() => ({ ...defaults }), {
      name: `eartrainer.v1.settings.${topicId}`,
      version: 1,
      storage: safeStorage<T>(),
      merge: (persisted, current) => {
        if (!persisted || typeof persisted !== 'object') return current;
        const merged = { ...current };
        for (const key of Object.keys(current) as (keyof T)[]) {
          if (Object.prototype.hasOwnProperty.call(persisted, key)) {
            merged[key] = (persisted as T)[key];
          }
        }
        return migrate ? migrate(merged) : merged;
      },
    }),
  );
}
