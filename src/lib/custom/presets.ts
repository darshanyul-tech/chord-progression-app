// Custom Topics — settings presets, not exercise authoring (docs/05-topics/14-custom-topics.md
// §1's binding scope decision). A preset is a named snapshot of one existing
// topic's settings; opening it overwrites that topic's live store (they're
// the same store — no shadow copies) and routes there. Framework-free: the
// Zustand store (state/customPresets.ts) is a thin persistence wrapper
// around these pure array transforms.

export interface CustomPreset {
  id: string;
  name: string;
  topicId: string;
  settings: Record<string, unknown>;
  createdAt: number;
}

const MAX_NAME_LENGTH = 40;

/** Returns an error message, or null when the name is acceptable. Case-insensitive duplicate check. */
export function validatePresetName(name: string, existingNames: string[]): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Name cannot be empty.';
  if (trimmed.length > MAX_NAME_LENGTH) return `Name must be ${MAX_NAME_LENGTH} characters or fewer.`;
  const lower = trimmed.toLowerCase();
  if (existingNames.some((n) => n.trim().toLowerCase() === lower)) return 'A preset with this name already exists.';
  return null;
}

/** Caller validates the name first (validatePresetName) — this just appends. */
export function addPreset(
  presets: CustomPreset[],
  topicId: string,
  name: string,
  settings: Record<string, unknown>,
): CustomPreset[] {
  const preset: CustomPreset = {
    id: crypto.randomUUID(),
    name: name.trim(),
    topicId,
    settings,
    createdAt: Date.now(),
  };
  return [...presets, preset];
}

export function renamePreset(presets: CustomPreset[], id: string, newName: string): CustomPreset[] {
  return presets.map((p) => (p.id === id ? { ...p, name: newName.trim() } : p));
}

export function deletePreset(presets: CustomPreset[], id: string): CustomPreset[] {
  return presets.filter((p) => p.id !== id);
}

function isCustomPresetShaped(item: unknown): item is CustomPreset {
  if (!item || typeof item !== 'object') return false;
  const p = item as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    typeof p.topicId === 'string' &&
    typeof p.createdAt === 'number' &&
    !!p.settings &&
    typeof p.settings === 'object'
  );
}

export interface SanitizeResult {
  presets: CustomPreset[];
  droppedCount: number;
}

/**
 * Restores a persisted presets blob, dropping (not crashing on) anything
 * malformed or pointing at a topic that no longer resolves (e.g. a topic
 * that got parked) — a dropped preset is counted so the management page can
 * say "N presets hidden" rather than silently losing them from view.
 */
export function sanitizePresets(raw: unknown, knownTopicIds: string[]): SanitizeResult {
  if (!Array.isArray(raw)) return { presets: [], droppedCount: 0 };
  const known = new Set(knownTopicIds);
  const presets: CustomPreset[] = [];
  let droppedCount = 0;
  raw.forEach((item) => {
    if (isCustomPresetShaped(item) && known.has(item.topicId)) {
      presets.push(item);
    } else {
      droppedCount++;
    }
  });
  return { presets, droppedCount };
}

/**
 * Applies a preset snapshot onto a topic's current defaults, keeping only
 * keys the defaults actually have (schema drift safe) — reimplements the
 * same key-filtering createPersistedSettingsStore's `merge` does, since that
 * only runs at restore time, not on this store's setState apply path.
 */
export function applyPresetSnapshot<T extends Record<string, unknown>>(defaults: T, snapshot: Record<string, unknown>): T {
  const merged = { ...defaults };
  (Object.keys(defaults) as (keyof T)[]).forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(snapshot, key)) {
      merged[key] = snapshot[key as string] as T[keyof T];
    }
  });
  return merged;
}
