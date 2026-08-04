import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyStats } from './aggregate';
import { getDeviceId } from './device';
import { sendTelemetry, telemetryEnabled } from './telemetry';

describe('getDeviceId', () => {
  beforeEach(() => localStorage.clear());
  it('is stable across calls and persisted', () => {
    const a = getDeviceId();
    const b = getDeviceId();
    expect(a).toBe(b);
    expect(localStorage.getItem('eartrainer.v1.device.id')).toBe(a);
  });
});

describe('telemetry gating on VITE_API_BASE_URL', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('is disabled and sends nothing when no backend is configured', () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(telemetryEnabled()).toBe(false);
    sendTelemetry('Ada', emptyStats());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts deviceId + name + stats when a backend is configured', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://trytone.com.au/api');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    sendTelemetry('Ada', emptyStats());

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://trytone.com.au/api/telemetry.php');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.name).toBe('Ada');
    expect(typeof body.deviceId).toBe('string');
    expect(body.stats.topics).toEqual({});
  });

  it('sends name:null for anonymous guests', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://x/api');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    sendTelemetry(null, emptyStats());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).name).toBeNull();
  });
});
