# Topic 14 — Custom Topics (`custom-topic`) — NEW (presets, not authoring)

**Status:** new build. Category: Custom Topics (unlocks the category). Theme: light.
**Reuse mandate (D13/D15):** every active topic's persisted settings store (all built on `createPersistedSettingsStore`, so they share `getState`/`setState`); the registry (`TOPICS`) for topic titles and routes; `SyllabusMenu` for listing. New logic framework-free in `src/lib/custom/presets.ts`, unit-tested.

## 1. What this is — and the binding scope decision

**v1 is settings presets, not exercise authoring.** A full authoring engine (user-defined question generators, custom sound sets, sharable exercises) is a product of its own and stays out of scope — restate this in the UI copy so the feature reads as intentional, not unfinished.

A **custom topic** in v1 is: *a named snapshot of one existing topic's settings*. "Drill: descending m2/M2 only, strict, auto-advance" saved from Interval Recognition becomes a menu entry under Custom Topics; opening it applies the snapshot to that topic's store and navigates there. This delivers the real recurring user need — switching between practice configurations without re-ticking checkboxes — at a small, honest surface.

## 2. UX

- **Create:** each topic's Settings card gains a small "Save as custom topic…" button (shared component, one line per topic) → prompt for a name → snapshot saved.
- **List / open:** the Custom Topics category in the syllabus menu lists saved presets (name + origin topic title). Clicking applies the snapshot and routes to the origin topic. The `custom-topic` placeholder entry becomes a management page ("Your custom topics") with rename/delete and the same open action; it shows explanatory copy when empty.
- **Apply semantics:** applying **overwrites** the origin topic's live settings (they're the same store — no shadow copies). The management page says so. Editing settings after opening a preset does *not* write back to the preset; presets are re-saved explicitly (snapshot semantics, not live binding — live binding makes "which settings am I on?" unanswerable).

## 3. Persistence & Tier-1 (`src/lib/custom/presets.ts`)

Storage key `eartrainer.v1.customPresets`, one array:

```ts
interface CustomPreset {
  id: string;            // crypto.randomUUID()
  name: string;          // user-entered, 1–40 chars, trimmed
  topicId: string;       // origin topic (must be an active, non-hidden TOPICS id at load)
  settings: Record<string, unknown>; // full snapshot of that topic's store state
  createdAt: number;
}
```

Tier-1 functions (pure; storage I/O behind the same thin persistence pattern as `createPersistedSettingsStore`): `addPreset`, `renamePreset`, `deletePreset`, `validatePresetName` (empty/duplicate handling), and `sanitizePresets(raw, knownTopicIds)` — drops presets whose `topicId` no longer resolves (a parked topic) rather than crashing the menu; a dropped preset is logged, not silently vanished (menu shows "N presets hidden — their topics are parked" on the management page).

**Schema drift:** `createPersistedSettingsStore`'s tolerant `merge` (keeps defaults for
missing keys, drops unknown ones) only runs at *restore* time — applying a preset goes
through `setState`, which does neither. So Tier-1 also exports
`applyPresetSnapshot(defaults, snapshot)`: returns `{ ...defaults }` overlaid with only the
snapshot keys that exist in `defaults` — the same key-filtering the persist merge does,
reimplemented for the apply path (it's four lines; do not try to reach into zustand's
persist internals for it). Never migrate presets in place.

## 4. Menu & routing integration

- `SyllabusMenu` gains a data source beyond `TOPICS`: the Custom Topics category renders the management entry plus one row per preset (a Zustand store `useCustomPresets`, persisted as above, so the menu re-renders on add/delete).
- Route: opening a preset navigates to `/topic/<topicId>` after applying — **no per-preset routes**. A preset is an action, not a place; per-preset URLs would break the mounted-views rule and bookmark a mutable snapshot.
- Registry: the `custom-topic` entry flips to `active` with the management page as its Component. No exam contribution (presets have no questions of their own).

## 5. Unit tests

- Preset CRUD: add/rename/delete round-trips through storage; name validation (empty, whitespace, duplicates, >40 chars).
- `sanitizePresets`: unknown `topicId` dropped and counted; well-formed presets untouched; malformed JSON array entries skipped without throwing.
- Apply: snapshot with a missing key (simulating schema drift) applies without clobbering the store's other defaults — asserts the merge behavior §3 relies on.
- Menu store: adding a preset is visible to a fresh `getState()` (persistence wiring).

## 6. Acceptance criteria

- Save a restrictive Interval Recognition preset, change the live settings, open the preset → settings are restored and the topic is active; the preset itself was not mutated by the interim changes.
- Deleting a preset removes its menu row immediately; renaming updates it.
- A preset whose topic gets parked disappears from the menu without a crash and is accounted for on the management page.
- Empty state: management page explains what presets are and points at the "Save as custom topic…" button.
- Explicit copy that full custom-exercise authoring is not part of this feature.
