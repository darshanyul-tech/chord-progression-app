// A stable, anonymous per-device id used ONLY for owner-side usage analytics
// (counting distinct devices and what topics get used). It is a random UUID —
// no personal information, no fingerprinting — persisted in localStorage so the
// same browser counts as one "user" over time. Never sent unless a backend is
// configured (see telemetry.ts / apiBaseUrl()).

const DEVICE_KEY = 'eartrainer.v1.device.id';

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    // Storage unavailable (private mode): fall back to an ephemeral id. Usage
    // still counts for the session; it just won't dedupe across reloads.
    return crypto.randomUUID();
  }
}
