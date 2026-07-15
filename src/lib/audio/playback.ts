import * as Tone from 'tone';
import type { Sampler } from 'tone';

// Ported playback-cancellation pattern (03-audio-engine.md §3): a generation
// counter + pending-timer list per playing subsystem. No Tone.Transport, no
// AbortController — behavioral fidelity with the legacy scheduling code.
export interface PlaybackChannel {
  playbackGen: number;
  timers: number[];
  isPlaying: boolean;
}

export function createPlaybackChannel(): PlaybackChannel {
  return { playbackGen: 0, timers: [], isPlaying: false };
}

export function clearChannelTimers(channel: PlaybackChannel): void {
  channel.timers.forEach((t) => clearTimeout(t));
  channel.timers = [];
}

export function stopChannel(channel: PlaybackChannel, sampler: Sampler | null): void {
  channel.playbackGen++;
  clearChannelTimers(channel);
  if (sampler) {
    try {
      sampler.releaseAll(0);
    } catch {
      /* noop */
    }
  }
  channel.isPlaying = false;
}

/**
 * Marks the channel busy for `durationSec`, then flips it back and fires
 * `onDone` — guarded by playbackGen so a stale timer from a since-stopped or
 * -replayed sequence can't fire after the fact.
 */
export function scheduleChannelDone(channel: PlaybackChannel, durationSec: number, onDone: () => void): void {
  channel.isPlaying = true;
  const playGen = channel.playbackGen;
  const id = window.setTimeout(() => {
    if (playGen !== channel.playbackGen) return;
    channel.isPlaying = false;
    onDone();
  }, Math.max(0, durationSec * 1000));
  channel.timers.push(id);
}

export function scheduleSamplerTrigger(
  sampler: Sampler | null,
  channel: PlaybackChannel,
  playGen: number,
  when: number,
  notes: string | string[],
  duration: number,
  velocity: number,
): void {
  const delayMs = Math.max(0, (when - Tone.now()) * 1000);
  const id = window.setTimeout(() => {
    if (playGen !== channel.playbackGen || !sampler) return;
    sampler.triggerAttackRelease(notes, duration, Tone.now(), velocity);
  }, delayMs);
  channel.timers.push(id);
}
