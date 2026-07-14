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
