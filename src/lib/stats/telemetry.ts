import { apiBaseUrl } from './backend';
import { getDeviceId } from './device';
import type { StatsData } from './types';

// Owner-side usage analytics. When (and only when) a backend is configured
// (VITE_API_BASE_URL set), each device periodically posts its rolled-up stats
// so the site owner can see aggregate usage — how many people use the app and
// which topics they practise. This is separate from the per-account sync: it is
// keyed by the anonymous device id and works for guests too.
//
// What is sent: the same aggregate {topics: {overall, items}} already stored
// locally, the anonymous device id, and the chosen display name IF the user
// signed into a named profile (else null). No raw per-question log, no PII
// beyond a name the user typed themselves. Fire-and-forget; failures are
// swallowed so analytics never affects practice.

export function telemetryEnabled(): boolean {
  return apiBaseUrl() !== '';
}

export interface TelemetryPayload {
  deviceId: string;
  name: string | null;
  stats: StatsData;
}

export function sendTelemetry(name: string | null, stats: StatsData): void {
  if (!telemetryEnabled()) return;
  const payload: TelemetryPayload = { deviceId: getDeviceId(), name, stats };
  try {
    void fetch(`${apiBaseUrl()}/telemetry.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true, // still delivered if the tab is closing
    }).catch(() => {});
  } catch {
    // ignore — best-effort only
  }
}
