import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Framework-free singleton (03-audio-engine.md §2) — no reset export, so each
// test gets a fresh module instance via vi.resetModules() + a re-mocked
// 'tone' + a fresh dynamic import, rather than relying on shared state.
describe('audio engine singleton', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockTone(overrides: Partial<Record<string, unknown>> = {}) {
    vi.doMock('tone', () => ({
      start: vi.fn().mockResolvedValue(undefined),
      loaded: vi.fn().mockResolvedValue(undefined),
      now: () => 0,
      getContext: () => ({ rawContext: {} }),
      Sampler: vi.fn().mockImplementation(() => ({ toDestination: () => ({ volume: { value: 0 } }) })),
      ...overrides,
    }));
  }

  it('starts idle, and initAudio() transitions idle -> loading -> ready on success', async () => {
    mockTone();
    const { audio } = await import('./engine');
    expect(audio.status).toBe('idle');

    const seen: string[] = [];
    audio.subscribe(() => seen.push(audio.status));
    const p = audio.initAudio();
    expect(audio.status).toBe('loading');
    await p;

    expect(audio.status).toBe('ready');
    expect(audio.sampler).not.toBeNull();
    expect(audio.lastError).toBeNull();
    expect(seen).toEqual(['loading', 'ready']);
  });

  it('sets status to error and records lastError when Tone.start() rejects', async () => {
    mockTone({ start: vi.fn().mockRejectedValue(new Error('no audio device')) });
    const { audio } = await import('./engine');

    await audio.initAudio();

    expect(audio.status).toBe('error');
    expect(audio.lastError).toBe('no audio device');
    expect(audio.sampler).toBeNull();
  });

  it('is a no-op (does not call Tone.start again) while already loading', async () => {
    let resolveStart: () => void = () => {};
    const startPromise = new Promise<void>((r) => {
      resolveStart = r;
    });
    const start = vi.fn().mockReturnValue(startPromise);
    mockTone({ start });
    const { audio } = await import('./engine');

    const p1 = audio.initAudio();
    const p2 = audio.initAudio(); // fired while status is still 'loading'
    resolveStart();
    await Promise.all([p1, p2]);

    expect(start).toHaveBeenCalledTimes(1);
    expect(audio.status).toBe('ready');
  });

  it('is a no-op once already ready', async () => {
    mockTone();
    const { audio } = await import('./engine');
    await audio.initAudio();
    expect(audio.status).toBe('ready');

    await audio.initAudio(); // should short-circuit, not throw or re-load
    expect(audio.status).toBe('ready');
  });

  it('subscribe() returns a working unsubscribe function', async () => {
    mockTone();
    const { audio } = await import('./engine');
    const listener = vi.fn();
    const unsubscribe = audio.subscribe(listener);
    unsubscribe();

    await audio.initAudio();
    expect(listener).not.toHaveBeenCalled();
  });

  it('now() and rawContext() delegate straight through to Tone', async () => {
    const rawContext = { fakeContext: true };
    mockTone({ now: () => 99, getContext: () => ({ rawContext }) });
    const { audio } = await import('./engine');

    expect(audio.now()).toBe(99);
    expect(audio.rawContext()).toBe(rawContext);
  });
});
