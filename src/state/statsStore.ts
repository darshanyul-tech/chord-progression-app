import { create } from 'zustand';
import { isGuest } from '../lib/auth/authClient';
import { applyEvent, emptyStats, mergeStats } from '../lib/stats/aggregate';
import { createStatsBackend, LocalStatsBackend, type StatsBackend } from '../lib/stats/backend';
import { GUEST_ID } from '../lib/auth/authClient';
import { sendTelemetry } from '../lib/stats/telemetry';
import type { AttemptEvent, StatsData, TopicStats } from '../lib/stats/types';

// Guest progress is always device-local (there's no account to sync it to).
// Named profiles use the configured backend — LocalStatsBackend today,
// CpanelStatsBackend once VITE_API_BASE_URL is set. Both satisfy StatsBackend,
// so nothing else in the app knows or cares which is active.
const localBackend = new LocalStatsBackend();
const remoteBackend = createStatsBackend();

function backendFor(profileId: string): StatsBackend {
  return isGuest(profileId) ? localBackend : remoteBackend;
}

// Debounced persist so a burst of attempts writes once. Keyed by profile so a
// pending write can't land under a profile the user just switched away from.
// The same tick also fires owner-side usage telemetry (no-op unless a backend
// is configured), so the two never get out of step.
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSave(profileId: string, name: string | null, data: StatsData) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void backendFor(profileId).save(profileId, data);
    sendTelemetry(name, data);
  }, 400);
}

interface StatsState {
  activeProfileId: string;
  /** Display name of the active profile, or null for guest (used by telemetry). */
  activeProfileName: string | null;
  data: StatsData;
  loading: boolean;
  /** Load a profile's stats into memory (called on sign-in/out/switch). */
  loadFor(profileId: string, name?: string | null): Promise<void>;
  /** Record one graded attempt (used by state/scores.ts). */
  record(event: AttemptEvent): void;
  /** Merge the device's guest progress into the active profile and persist. */
  importGuest(): Promise<void>;
  resetTopic(topicId: string): void;
  resetAll(): void;
  topicStats(topicId: string): TopicStats | undefined;
}

export const useStatsStore = create<StatsState>((set, get) => ({
  activeProfileId: GUEST_ID,
  activeProfileName: null,
  data: emptyStats(),
  loading: false,

  loadFor: async (profileId, name = null) => {
    set({ loading: true, activeProfileId: profileId, activeProfileName: name });
    let loaded: StatsData | null = null;
    try {
      loaded = await backendFor(profileId).load(profileId);
    } catch {
      loaded = null; // remote unreachable → start empty, never block practice
    }
    // Guard against a race where the profile changed mid-load.
    if (get().activeProfileId !== profileId) return;
    set({ data: loaded ?? emptyStats(), loading: false });
  },

  record: (event) => {
    const { activeProfileId, activeProfileName, data } = get();
    const next = applyEvent(data, event);
    set({ data: next });
    scheduleSave(activeProfileId, activeProfileName, next);
  },

  importGuest: async () => {
    const { activeProfileId, data } = get();
    if (isGuest(activeProfileId)) return;
    const guest = (await localBackend.load(GUEST_ID)) ?? emptyStats();
    const merged = mergeStats(data, guest);
    set({ data: merged });
    await backendFor(activeProfileId).save(activeProfileId, merged);
  },

  resetTopic: (topicId) => {
    const { activeProfileId, activeProfileName, data } = get();
    const topics = { ...data.topics };
    delete topics[topicId];
    const next: StatsData = { ...data, topics, updatedAt: Date.now() };
    set({ data: next });
    scheduleSave(activeProfileId, activeProfileName, next);
  },

  resetAll: () => {
    const { activeProfileId, activeProfileName } = get();
    const next = emptyStats();
    set({ data: next });
    void backendFor(activeProfileId).save(activeProfileId, next);
    sendTelemetry(activeProfileName, next);
  },

  topicStats: (topicId) => get().data.topics[topicId],
}));
