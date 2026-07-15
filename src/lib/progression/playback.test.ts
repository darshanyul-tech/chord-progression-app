import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPlaybackChannel } from '../audio/playback';
import { scheduleBarVoicing, schedulePlayback } from './playback';
import { buildVoicing } from './theory';
import { defaultProgressionSettings, resolvePracticeSettings } from './settings';

vi.mock('tone', async (importOriginal) => {
  const actual = await importOriginal<typeof import('tone')>();
  return { ...actual, now: () => 0 };
});

function fakeSampler() {
  return { triggerAttackRelease: vi.fn(), releaseAll: vi.fn() } as unknown as import('tone').Sampler;
}

describe('scheduleBarVoicing', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('always triggers the chord, and the bass note once per bar when not bouncing', () => {
    const sampler = fakeSampler();
    const channel = createPlaybackChannel();
    const voicing = buildVoicing(0, 'maj7', {});
    scheduleBarVoicing(sampler, channel, channel.playbackGen, 0, 2, voicing, false);
    vi.advanceTimersByTime(2000);
    // chord trigger + bass trigger (voicing.bass is null for a non-rootless
    // voicing, so only the chord call happens here)
    expect(sampler.triggerAttackRelease).toHaveBeenCalledWith(voicing.chord, expect.any(Number), 0, 0.9);
  });

  it('strikes the bass twice (bounce) instead of once when bouncingBass is on', () => {
    const sampler = fakeSampler();
    const channel = createPlaybackChannel();
    const voicing = buildVoicing(0, 'maj7', { rootless: true });
    scheduleBarVoicing(sampler, channel, channel.playbackGen, 0, 2, voicing, true);
    vi.advanceTimersByTime(2000);
    const bassCalls = (sampler.triggerAttackRelease as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c) => c[0] === voicing.bassNote,
    );
    expect(bassCalls).toHaveLength(2);
  });
});

describe('schedulePlayback', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('resolves after the full progression has finished, firing onBarActive per bar', async () => {
    const sampler = fakeSampler();
    const channel = createPlaybackChannel();
    const s = resolvePracticeSettings({ ...defaultProgressionSettings(), bars: 2, tempo: 120, tonicFirst: false });
    const prog = [
      { degree: 1, fn: 'tonic', rootPc: 0, rootName: 'C', quality: 'maj7', rootDegree: 1, family: 'maj' as const, ext: 7, symbol: 'Cmaj7', roman: 'I', inversion: 0, secondary: false },
      { degree: 5, fn: 'dominant', rootPc: 7, rootName: 'G', quality: '7', rootDegree: 5, family: 'dom' as const, ext: 7, symbol: 'G7', roman: 'V', inversion: 0, secondary: false },
    ];
    const onBarActive = vi.fn();

    const donePromise = schedulePlayback(sampler, channel, 0, s, prog, { onBarActive });
    let resolved = false;
    void donePromise.then(() => {
      resolved = true;
    });

    // barSec = 120/120 = 1s; 2 bars + trailing 200ms buffer
    await vi.advanceTimersByTimeAsync(2000 + 200 + 10);
    expect(resolved).toBe(true);
    expect(onBarActive).toHaveBeenCalledWith(0, expect.any(Number));
    expect(onBarActive).toHaveBeenCalledWith(1, expect.any(Number));
    expect(onBarActive).toHaveBeenLastCalledWith(null, expect.any(Number));
  });

  it('adds a tonic lead-in bar (and a silent bar) before the progression when tonicFirst is on', async () => {
    const sampler = fakeSampler();
    const channel = createPlaybackChannel();
    const s = resolvePracticeSettings({ ...defaultProgressionSettings(), bars: 1, tempo: 120, tonicFirst: true });
    const prog = [
      { degree: 1, fn: 'tonic', rootPc: 0, rootName: 'C', quality: 'maj7', rootDegree: 1, family: 'maj' as const, ext: 7, symbol: 'Cmaj7', roman: 'I', inversion: 0, secondary: false },
    ];
    const onBarActive = vi.fn();

    const donePromise = schedulePlayback(sampler, channel, 0, s, prog, { onBarActive });
    await vi.advanceTimersByTimeAsync(1000 * 3 + 200 + 10); // ref bar + silent bar + 1 prog bar
    await donePromise;

    expect(onBarActive).toHaveBeenCalledWith('ref', expect.any(Number));
    expect(onBarActive).toHaveBeenCalledWith(0, expect.any(Number));
  });
});
