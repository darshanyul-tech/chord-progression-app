import { apiBaseUrl } from '../stats/backend';
import { clearAuthToken, getAuthToken, setAuthToken } from './token';

// Optional accounts. The app is fully usable anonymously as GUEST; a user may
// create/sign into a named profile if they want their progress kept separately
// (and, once the cPanel backend is live, synced across devices).
//
// LocalAuthClient stores everything in localStorage — the optional PIN is a
// light convenience lock, NOT real security (it never leaves the device and is
// only lightly hashed). Real authentication arrives with the cPanel backend
// (CpanelAuthClient), which issues a bearer token on sign-in.

export const GUEST_ID = 'guest';

export interface Profile {
  id: string;
  name: string;
  createdAt: number;
}

/** The always-present anonymous profile. Never persisted in the profile list. */
export const GUEST_PROFILE: Profile = { id: GUEST_ID, name: 'Guest', createdAt: 0 };

export function isGuest(profileId: string): boolean {
  return profileId === GUEST_ID;
}

export interface AuthClient {
  /** Named profiles the user has created (excludes guest). */
  list(): Promise<Profile[]>;
  /** Create + sign into a new named profile. */
  create(name: string, pin?: string): Promise<Profile>;
  /** Sign into an existing profile; throws on a bad PIN. */
  signIn(id: string, pin?: string): Promise<Profile>;
  /** Return to anonymous guest. */
  signOut(): Promise<void>;
  /** Delete a named profile (and its stored PIN). */
  remove(id: string): Promise<void>;
}

// ---- Local implementation ---------------------------------------------------

interface StoredProfile extends Profile {
  pinHash?: string;
}

const PROFILES_KEY = 'eartrainer.v1.auth.profiles';

// djb2 — a stable, dependency-free hash. Enough to avoid storing a PIN in the
// clear locally; explicitly not a security boundary (see file header).
function hashPin(pin: string): string {
  let h = 5381;
  for (let i = 0; i < pin.length; i++) h = ((h << 5) + h + pin.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

function readProfiles(): StoredProfile[] {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredProfile[]) : [];
  } catch {
    return [];
  }
}

function writeProfiles(profiles: StoredProfile[]): void {
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  } catch {
    // ignore — private mode / quota
  }
}

const strip = (p: StoredProfile): Profile => ({ id: p.id, name: p.name, createdAt: p.createdAt });

export class LocalAuthClient implements AuthClient {
  async list(): Promise<Profile[]> {
    return readProfiles().map(strip);
  }

  async create(name: string, pin?: string): Promise<Profile> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Profile name is required.');
    const profiles = readProfiles();
    if (profiles.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error('A profile with that name already exists.');
    }
    const profile: StoredProfile = {
      id: crypto.randomUUID(),
      name: trimmed,
      createdAt: Date.now(),
      ...(pin ? { pinHash: hashPin(pin) } : {}),
    };
    writeProfiles([...profiles, profile]);
    return strip(profile);
  }

  async signIn(id: string, pin?: string): Promise<Profile> {
    const profile = readProfiles().find((p) => p.id === id);
    if (!profile) throw new Error('Profile not found.');
    if (profile.pinHash && profile.pinHash !== hashPin(pin ?? '')) {
      throw new Error('Incorrect PIN.');
    }
    return strip(profile);
  }

  async signOut(): Promise<void> {
    // Local profiles have no session token to clear.
  }

  async remove(id: string): Promise<void> {
    writeProfiles(readProfiles().filter((p) => p.id !== id));
  }
}

// ---- cPanel (PHP + MySQL) implementation, token-in-localStorage -------------
// Inert until VITE_API_BASE_URL is set. Contract: server/cpanel/auth.php.

interface AuthResponse {
  profile: Profile;
  token: string;
}

export class CpanelAuthClient implements AuthClient {
  constructor(private readonly baseUrl: string) {}

  private async post(action: string, body: Record<string, unknown>): Promise<Response> {
    return fetch(`${this.baseUrl}/auth.php?action=${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
      },
      body: JSON.stringify(body),
    });
  }

  async list(): Promise<Profile[]> {
    // Server derives the caller from the token; a signed-out client has none.
    if (!getAuthToken()) return [];
    const res = await this.post('list', {});
    if (!res.ok) return [];
    return (await res.json()) as Profile[];
  }

  async create(name: string, pin?: string): Promise<Profile> {
    const res = await this.post('register', { name: name.trim(), pin });
    if (!res.ok) throw new Error((await res.text()) || 'Sign-up failed.');
    const { profile, token } = (await res.json()) as AuthResponse;
    setAuthToken(token);
    return profile;
  }

  async signIn(id: string, pin?: string): Promise<Profile> {
    const res = await this.post('login', { id, pin });
    if (!res.ok) throw new Error((await res.text()) || 'Sign-in failed.');
    const { profile, token } = (await res.json()) as AuthResponse;
    setAuthToken(token);
    return profile;
  }

  async signOut(): Promise<void> {
    clearAuthToken();
  }

  async remove(id: string): Promise<void> {
    const res = await this.post('delete', { id });
    if (!res.ok) throw new Error((await res.text()) || 'Delete failed.');
    clearAuthToken();
  }
}

/** Local by default; cPanel once VITE_API_BASE_URL is configured. */
export function createAuthClient(): AuthClient {
  const base = apiBaseUrl();
  return base ? new CpanelAuthClient(base) : new LocalAuthClient();
}
