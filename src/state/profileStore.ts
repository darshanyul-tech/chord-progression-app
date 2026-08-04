import { create } from 'zustand';
import {
  createAuthClient,
  GUEST_ID,
  GUEST_PROFILE,
  isGuest,
  type Profile,
} from '../lib/auth/authClient';
import { useStatsStore } from './statsStore';

// Which profile is active persists across reloads; the profile *list* itself
// lives with the auth client (localStorage now, cPanel later).
const ACTIVE_KEY = 'eartrainer.v1.auth.active';

function readActiveId(): string {
  try {
    return localStorage.getItem(ACTIVE_KEY) ?? GUEST_ID;
  } catch {
    return GUEST_ID;
  }
}

function writeActiveId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    // ignore
  }
}

const auth = createAuthClient();

interface ProfileState {
  /** Current profile (guest when signed out). */
  active: Profile;
  /** Named profiles available on this device/account (excludes guest). */
  profiles: Profile[];
  error: string | null;
  /** Load the profile list and restore the last-active profile. Call once at startup. */
  init(): Promise<void>;
  createProfile(name: string, pin?: string): Promise<void>;
  signIn(id: string, pin?: string): Promise<void>;
  signOut(): Promise<void>;
  deleteProfile(id: string): Promise<void>;
  clearError(): void;
}

async function activate(set: (partial: Partial<ProfileState>) => void, profile: Profile) {
  writeActiveId(profile.id);
  set({ active: profile, error: null });
  // Guests report no name to telemetry; named profiles report their display name.
  await useStatsStore.getState().loadFor(profile.id, isGuest(profile.id) ? null : profile.name);
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  active: GUEST_PROFILE,
  profiles: [],
  error: null,

  init: async () => {
    let profiles: Profile[] = [];
    try {
      profiles = await auth.list();
    } catch {
      profiles = [];
    }
    set({ profiles });
    const savedId = readActiveId();
    const match = isGuest(savedId) ? GUEST_PROFILE : profiles.find((p) => p.id === savedId);
    await activate(set, match ?? GUEST_PROFILE);
  },

  createProfile: async (name, pin) => {
    try {
      const profile = await auth.create(name, pin);
      set({ profiles: [...get().profiles, profile] });
      await activate(set, profile);
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Could not create profile.' });
    }
  },

  signIn: async (id, pin) => {
    try {
      const profile = await auth.signIn(id, pin);
      await activate(set, profile);
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Could not sign in.' });
    }
  },

  signOut: async () => {
    try {
      await auth.signOut();
    } catch {
      // ignore — return to guest regardless
    }
    await activate(set, GUEST_PROFILE);
  },

  deleteProfile: async (id) => {
    try {
      await auth.remove(id);
      set({ profiles: get().profiles.filter((p) => p.id !== id) });
      if (get().active.id === id) await activate(set, GUEST_PROFILE);
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Could not delete profile.' });
    }
  },

  clearError: () => set({ error: null }),
}));
