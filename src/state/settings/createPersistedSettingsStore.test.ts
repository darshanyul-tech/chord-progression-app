import { beforeEach, describe, expect, it } from 'vitest';
import { createPersistedSettingsStore } from './createPersistedSettingsStore';

interface FakeSettings extends Record<string, unknown> {
  tempo: number;
  autoAdvance: boolean;
}

const defaults: FakeSettings = { tempo: 90, autoAdvance: true };

describe('createPersistedSettingsStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips a value through localStorage across store instances (simulated reload)', () => {
    const storeA = createPersistedSettingsStore('fake-topic', defaults);
    storeA.setState({ tempo: 140 });

    const storeB = createPersistedSettingsStore('fake-topic', defaults);
    expect(storeB.getState().tempo).toBe(140);
    expect(storeB.getState().autoAdvance).toBe(true);
  });

  it('keeps defaults for keys missing from the persisted blob', () => {
    localStorage.setItem(
      'eartrainer.v1.settings.fake-topic-2',
      JSON.stringify({ state: { tempo: 200 }, version: 1 }),
    );
    const store = createPersistedSettingsStore('fake-topic-2', defaults);
    expect(store.getState().tempo).toBe(200);
    expect(store.getState().autoAdvance).toBe(true);
  });

  it('discards a corrupt blob and falls back to defaults', () => {
    localStorage.setItem('eartrainer.v1.settings.fake-topic-3', '{not json');
    const store = createPersistedSettingsStore('fake-topic-3', defaults);
    expect(store.getState()).toEqual(defaults);
  });

  it('drops unknown keys from the persisted blob', () => {
    localStorage.setItem(
      'eartrainer.v1.settings.fake-topic-4',
      JSON.stringify({ state: { tempo: 100, ghostKey: 'nope' }, version: 1 }),
    );
    const store = createPersistedSettingsStore('fake-topic-4', defaults);
    expect(store.getState()).not.toHaveProperty('ghostKey');
  });
});
