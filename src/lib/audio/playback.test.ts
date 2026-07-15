import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearChannelTimers, createPlaybackChannel, scheduleChannelDone, stopChannel } from './playback';
import type { Sampler } from 'tone';

function fakeSampler() {
  return { releaseAll: vi.fn() } as unknown as Sampler;
}

describe('createPlaybackChannel', () => {
  it('starts with a fresh, empty, not-playing channel', () => {
    const ch = createPlaybackChannel();
    expect(ch).toEqual({ playbackGen: 0, timers: [], isPlaying: false });
  });
});

describe('clearChannelTimers', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('clears every pending timer and empties the list', () => {
    const ch = createPlaybackChannel();
    const fn = vi.fn();
    ch.timers.push(window.setTimeout(fn, 1000));
    clearChannelTimers(ch);
    vi.advanceTimersByTime(2000);
    expect(fn).not.toHaveBeenCalled();
    expect(ch.timers).toHaveLength(0);
  });
});

describe('stopChannel', () => {
  it('bumps playbackGen, clears timers, releases the sampler, and flips isPlaying off', () => {
    const ch = createPlaybackChannel();
    ch.isPlaying = true;
    const sampler = fakeSampler();
    stopChannel(ch, sampler);
    expect(ch.playbackGen).toBe(1);
    expect(ch.isPlaying).toBe(false);
    expect(sampler.releaseAll).toHaveBeenCalledWith(0);
  });

  it('tolerates a null sampler', () => {
    const ch = createPlaybackChannel();
    expect(() => stopChannel(ch, null)).not.toThrow();
  });

  it('swallows an error thrown by sampler.releaseAll()', () => {
    const ch = createPlaybackChannel();
    const sampler = {
      releaseAll: () => {
        throw new Error('already released');
      },
    } as unknown as Sampler;
    expect(() => stopChannel(ch, sampler)).not.toThrow();
  });
});

describe('scheduleChannelDone', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('marks the channel playing, then flips it back and fires onDone after durationSec', () => {
    const ch = createPlaybackChannel();
    const onDone = vi.fn();
    scheduleChannelDone(ch, 1, onDone);
    expect(ch.isPlaying).toBe(true);
    expect(onDone).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(ch.isPlaying).toBe(false);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('a stale timer does not fire once playbackGen has moved on (superseded by a stop/replay)', () => {
    const ch = createPlaybackChannel();
    const onDone = vi.fn();
    scheduleChannelDone(ch, 1, onDone);
    ch.playbackGen++; // simulate a stop()/replay() in between

    vi.advanceTimersByTime(1000);
    expect(onDone).not.toHaveBeenCalled();
  });
});
