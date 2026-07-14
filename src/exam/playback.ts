import type { Sampler } from 'tone';
import { scheduleSamplerTrigger, stopChannel, type PlaybackChannel } from '../lib/audio/playback';
import { midiToNoteName } from '../lib/theory';

// Ported from legacy playExamNoteSequence/playExamChordBlock/abortExamPlayback
// (docs/06-exam-mode.md §A). Exam mode gets its own PlaybackChannel instance
// (per 03-audio-engine.md's channel pattern) plus a "pendingResolve" escape
// hatch so "submit early" can resolve an in-flight hearing immediately
// instead of waiting out its full duration.
export interface ExamPlaybackChannel extends PlaybackChannel {
  pendingResolve: (() => void) | null;
}

export function createExamPlaybackChannel(): ExamPlaybackChannel {
  return { playbackGen: 0, timers: [], isPlaying: false, pendingResolve: null };
}

export function abortExamPlayback(channel: ExamPlaybackChannel, sampler: Sampler | null): void {
  stopChannel(channel, sampler);
  const resolve = channel.pendingResolve;
  channel.pendingResolve = null;
  if (resolve) resolve();
}

/** Wraps any playback promise with the early-abort escape hatch. */
export function withEarlyAbort(
  channel: ExamPlaybackChannel,
  aborted: () => boolean,
  run: () => Promise<void>,
): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (channel.pendingResolve === finish) channel.pendingResolve = null;
      resolve();
    };
    if (aborted()) {
      finish();
      return;
    }
    channel.pendingResolve = finish;
    run().then(finish);
  });
}

export function playNoteSequence(
  sampler: Sampler | null,
  channel: ExamPlaybackChannel,
  now: number,
  midis: number[],
  noteLen: number,
  gap: number,
  aborted: () => boolean,
): Promise<void> {
  return withEarlyAbort(channel, aborted, () => {
    return new Promise((resolve) => {
      if (!sampler) {
        resolve();
        return;
      }
      try {
        sampler.releaseAll(0);
      } catch {
        /* noop */
      }
      const playGen = channel.playbackGen;
      let cursor = now + 0.12;
      let wallClock = 0;
      midis.forEach((midi) => {
        scheduleSamplerTrigger(sampler, channel, playGen, cursor, midiToNoteName(midi), noteLen, 0.88);
        wallClock += (noteLen + gap) * 1000;
        cursor += noteLen + gap;
      });
      const id = window.setTimeout(() => resolve(), wallClock + 120);
      channel.timers.push(id);
    });
  });
}

export function playChordBlock(
  sampler: Sampler | null,
  channel: ExamPlaybackChannel,
  now: number,
  notes: string[],
  dur: number,
  aborted: () => boolean,
): Promise<void> {
  return withEarlyAbort(channel, aborted, () => {
    return new Promise((resolve) => {
      if (!sampler) {
        resolve();
        return;
      }
      try {
        sampler.releaseAll(0);
      } catch {
        /* noop */
      }
      const playGen = channel.playbackGen;
      scheduleSamplerTrigger(sampler, channel, playGen, now + 0.1, notes, dur, 0.9);
      const id = window.setTimeout(() => resolve(), dur * 1000 + 150);
      channel.timers.push(id);
    });
  });
}
