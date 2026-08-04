import type { StoreApi, UseBoundStore } from 'zustand';
import { createPersistedSettingsStore } from '../../state/settings/createPersistedSettingsStore';
import type { ArrSettings } from './exerciseTypes';
import { ARRANGING_EXERCISE_LIST } from './exercises';

// One persisted settings store per Arranging exercise, keyed by exercise id and
// built from its declared defaultSettings (same mechanism as every other topic).
const stores = new Map<string, UseBoundStore<StoreApi<ArrSettings>>>();

for (const exercise of ARRANGING_EXERCISE_LIST) {
  stores.set(exercise.id, createPersistedSettingsStore<ArrSettings>(exercise.id, exercise.defaultSettings));
}

export function useArrangingSettingsStore(id: string): UseBoundStore<StoreApi<ArrSettings>> {
  const store = stores.get(id);
  if (!store) throw new Error(`No Arranging settings store for '${id}'`);
  return store;
}
