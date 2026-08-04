import { getAuthToken } from '../auth/token';
import { emptyStats } from './aggregate';
import { STATS_VERSION, type StatsData } from './types';

// The persistence port. Everything above (statsStore) depends only on this
// interface, so swapping localStorage for the cPanel PHP backend is a one-line
// change in createStatsBackend() — no store or UI edits. See docs/17.
export interface StatsBackend {
  load(profileId: string): Promise<StatsData | null>;
  save(profileId: string, data: StatsData): Promise<void>;
}

const keyFor = (profileId: string) => `eartrainer.v1.stats.${profileId}`;

function isStatsData(v: unknown): v is StatsData {
  return !!v && typeof v === 'object' && 'topics' in v && typeof (v as StatsData).topics === 'object';
}

/** Default backend: per-profile JSON blob in localStorage, tolerant of failures. */
export class LocalStatsBackend implements StatsBackend {
  async load(profileId: string): Promise<StatsData | null> {
    try {
      const raw = localStorage.getItem(keyFor(profileId));
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      return isStatsData(parsed) ? parsed : null;
    } catch {
      return null; // corrupt blob / storage disabled → treat as empty
    }
  }

  async save(profileId: string, data: StatsData): Promise<void> {
    try {
      localStorage.setItem(keyFor(profileId), JSON.stringify(data));
    } catch {
      // ignore — quota / private mode; stats just won't persist this session
    }
  }
}

/**
 * Remote backend for a cPanel-hosted PHP + MySQL API (inert until
 * VITE_API_BASE_URL is set). Contract (see server/cpanel/stats.php):
 *   GET  {base}/stats.php            → 200 {version,topics,updatedAt} | 204
 *   PUT  {base}/stats.php  <body>    → 200
 * The active profile is identified server-side from the Bearer token, so the
 * profileId argument is not sent (guest data stays local — see statsStore).
 */
export class CpanelStatsBackend implements StatsBackend {
  constructor(
    private readonly baseUrl: string,
    private readonly getToken: () => string | null = getAuthToken,
  ) {}

  private headers(): HeadersInit {
    const token = this.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  // profileId is intentionally omitted — the server derives it from the token.
  async load(): Promise<StatsData | null> {
    const res = await fetch(`${this.baseUrl}/stats.php`, { headers: this.headers() });
    if (res.status === 204) return null;
    if (!res.ok) throw new Error(`stats load failed: ${res.status}`);
    const data = (await res.json()) as StatsData;
    return data.version ? data : { ...emptyStats(), ...data };
  }

  async save(_profileId: string, data: StatsData): Promise<void> {
    void _profileId; // server derives the profile from the token
    const res = await fetch(`${this.baseUrl}/stats.php`, {
      method: 'PUT',
      headers: this.headers(),
      body: JSON.stringify({ ...data, version: STATS_VERSION }),
    });
    if (!res.ok) throw new Error(`stats save failed: ${res.status}`);
  }
}

/** Base URL of the cPanel API, or '' when the app runs fully local. */
export function apiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';
}

/** Local by default; remote as soon as VITE_API_BASE_URL points at the cPanel API. */
export function createStatsBackend(): StatsBackend {
  const base = apiBaseUrl();
  return base ? new CpanelStatsBackend(base) : new LocalStatsBackend();
}
