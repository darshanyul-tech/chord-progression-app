import type { Sampler } from 'tone';
import { scheduleSamplerTrigger, type PlaybackChannel } from '../audio/playback';
import { buildVoicing, tonicQualityForSettings, type ProgChord, type VoicingResult } from './theory';
import type { ResolvedProgressionSettings } from './settings';

// Ported from legacy scheduleBarVoicing() (docs/05-topics/06-chord-progressions.md).
export function scheduleBarVoicing(
  sampler: Sampler | null,
  channel: PlaybackChannel,
  playGen: number,
  when: number,
  barSec: number,
  v: VoicingResult,
  bouncingBass: boolean,
): void {
  scheduleSamplerTrigger(sampler, channel, playGen, when, v.chord, barSec * 0.9, 0.9);
  if (bouncingBass && v.bassNote) {
    const bounceDur = Math.min(0.35, barSec * 0.18);
    scheduleSamplerTrigger(sampler, channel, playGen, when, v.bassNote, bounceDur, 0.95);
    scheduleSamplerTrigger(sampler, channel, playGen, when + barSec / 2, v.bassNote, bounceDur, 0.92);
  } else if (v.bass) {
    scheduleSamplerTrigger(sampler, channel, playGen, when, v.bass, barSec * 0.95, 0.95);
  }
}

export interface PlaybackHooks {
  onBarActive?(index: number | 'ref' | null, atMs: number): void;
}

/**
 * Schedules the whole progression (with optional tonic lead-in) starting
 * "now" on the given channel/sampler, and resolves once the whole sequence
 * has finished playing (or has been superseded by a newer playbackGen).
 * Ported from legacy play()/playProgressionOnce().
 */
export function schedulePlayback(
  sampler: Sampler | null,
  channel: PlaybackChannel,
  now: number,
  s: ResolvedProgressionSettings,
  prog: ProgChord[],
  hooks: PlaybackHooks = {},
): Promise<void> {
  return new Promise((resolve) => {
    const playGen = channel.playbackGen;
    const barSec = 120 / s.bpm;
    let cursor = now + 0.15;
    let wallClock = 0;

    const pushHighlight = (index: number | 'ref' | null, wc: number) => {
      if (!hooks.onBarActive) return;
      const id = window.setTimeout(() => {
        if (playGen !== channel.playbackGen) return;
        hooks.onBarActive!(index, wc);
      }, wc);
      channel.timers.push(id);
    };

    if (s.tonicFirst) {
      const ref = buildVoicing(s.keyPc, tonicQualityForSettings(s), { rootless: s.rootless, inversion: 0 });
      scheduleBarVoicing(sampler, channel, playGen, cursor, barSec, ref, s.bouncingBass);
      pushHighlight('ref', wallClock);
      cursor += barSec;
      wallClock += barSec * 1000;
      pushHighlight(null, wallClock);
      cursor += barSec;
      wallClock += barSec * 1000;
    }

    prog.forEach((ch, i) => {
      const when = cursor;
      const v = buildVoicing(ch.rootPc, ch.quality, {
        rootless: s.rootless,
        inversion: ch.inversion,
        registerShift: ch.registerShift || 0,
      });
      scheduleBarVoicing(sampler, channel, playGen, when, barSec, v, s.bouncingBass);
      pushHighlight(i, wallClock);
      cursor += barSec;
      wallClock += barSec * 1000;
    });

    const id = window.setTimeout(() => {
      if (playGen === channel.playbackGen && hooks.onBarActive) hooks.onBarActive(null, wallClock + 200);
      resolve();
    }, wallClock + 200);
    channel.timers.push(id);
  });
}
