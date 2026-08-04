import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyStats, applyEvent } from './aggregate';
import { CpanelStatsBackend, createStatsBackend, LocalStatsBackend } from './backend';

describe('LocalStatsBackend', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a stats blob under a per-profile key', async () => {
    const backend = new LocalStatsBackend();
    const data = applyEvent(emptyStats(), { topicId: 't', correct: true });
    await backend.save('p1', data);
    expect(await backend.load('p1')).toEqual(data);
    expect(await backend.load('p2')).toBeNull(); // namespaced per profile
  });

  it('returns null for a corrupt blob instead of throwing', async () => {
    localStorage.setItem('eartrainer.v1.stats.p1', '{not json');
    expect(await new LocalStatsBackend().load('p1')).toBeNull();
  });
});

describe('createStatsBackend', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is local when no API base URL is configured', () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    expect(createStatsBackend()).toBeInstanceOf(LocalStatsBackend);
  });

  it('is the cPanel backend once VITE_API_BASE_URL is set', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://trytone.com.au/api');
    expect(createStatsBackend()).toBeInstanceOf(CpanelStatsBackend);
  });
});

describe('CpanelStatsBackend', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends the bearer token and PUTs the blob', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    const backend = new CpanelStatsBackend('https://x/api', () => 'tok123');
    await backend.save('ignored', emptyStats());

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://x/api/stats.php');
    expect(init.method).toBe('PUT');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok123');
    vi.unstubAllGlobals();
  });

  it('treats 204 as "no stats yet" (null)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 204 });
    vi.stubGlobal('fetch', fetchMock);
    const backend = new CpanelStatsBackend('https://x/api', () => 'tok');
    expect(await backend.load()).toBeNull();
    vi.unstubAllGlobals();
  });
});
