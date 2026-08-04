import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GUEST_ID } from '../lib/auth/authClient';
import { applyEvent, emptyStats } from '../lib/stats/aggregate';
import { useStatsStore } from './statsStore';

function resetStore() {
  useStatsStore.setState({ activeProfileId: GUEST_ID, data: emptyStats(), loading: false });
}

describe('useStatsStore', () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
  });

  it('record() bumps overall and the per-item tally', () => {
    const { record } = useStatsStore.getState();
    record({ topicId: 'iv', correct: true, itemKey: 'm6', itemLabel: 'Minor 6th' });
    record({ topicId: 'iv', correct: false, itemKey: 'm6', itemLabel: 'Minor 6th' });
    const t = useStatsStore.getState().data.topics.iv;
    expect(t.overall).toEqual({ correct: 1, total: 2 });
    expect(t.items.m6.tally).toEqual({ correct: 1, total: 2 });
  });

  it('resetTopic clears one topic, resetAll clears everything', () => {
    const { record, resetTopic, resetAll } = useStatsStore.getState();
    record({ topicId: 'a', correct: true });
    record({ topicId: 'b', correct: true });
    resetTopic('a');
    expect(useStatsStore.getState().data.topics.a).toBeUndefined();
    expect(useStatsStore.getState().data.topics.b).toBeDefined();
    resetAll();
    expect(useStatsStore.getState().data.topics).toEqual({});
  });

  it('debounced save persists guest stats to localStorage', () => {
    vi.useFakeTimers();
    try {
      useStatsStore.getState().record({ topicId: 't', correct: true });
      vi.advanceTimersByTime(500);
      const raw = localStorage.getItem(`eartrainer.v1.stats.${GUEST_ID}`);
      expect(raw).toBeTruthy();
      expect(JSON.parse(raw!).topics.t.overall).toEqual({ correct: 1, total: 1 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('importGuest merges the device guest blob into the active profile', async () => {
    // Seed a guest blob on-device.
    const guest = applyEvent(emptyStats(), { topicId: 't', correct: true });
    localStorage.setItem(`eartrainer.v1.stats.${GUEST_ID}`, JSON.stringify(guest));

    // Active profile already has one attempt of its own.
    const own = applyEvent(emptyStats(), { topicId: 't', correct: false });
    useStatsStore.setState({ activeProfileId: 'p1', data: own });

    await useStatsStore.getState().importGuest();

    const t = useStatsStore.getState().data.topics.t;
    expect(t.overall).toEqual({ correct: 1, total: 2 }); // own(0/1) + guest(1/1)
    // …and it was persisted under the profile's own key.
    expect(localStorage.getItem('eartrainer.v1.stats.p1')).toBeTruthy();
  });

  afterEach(() => resetStore());
});
