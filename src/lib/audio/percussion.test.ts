import { describe, expect, it, vi } from 'vitest';
import {
  buildPlaybackEvents,
  disconnectScheduled,
  playSnareHit,
  scheduleMetroClick,
  scheduleNote,
  type ScheduledNode,
} from './percussion';
import type { Measure } from '../rhythm/time';

function fakeParam(value = 0) {
  return { value, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
}

function fakeNode() {
  return { connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() };
}

function fakeContext(): BaseAudioContext {
  return {
    destination: {},
    sampleRate: 44100,
    createOscillator: () => ({ ...fakeNode(), type: '', frequency: fakeParam() }),
    createGain: () => ({ ...fakeNode(), gain: fakeParam() }),
    createBufferSource: () => ({ ...fakeNode(), buffer: null }),
    createBuffer: (_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
    createBiquadFilter: () => ({ ...fakeNode(), type: '', frequency: fakeParam(), Q: fakeParam() }),
  } as unknown as BaseAudioContext;
}

describe('disconnectScheduled', () => {
  it('stops and disconnects every node, then empties the array', () => {
    const stop = vi.fn();
    const disconnect = vi.fn();
    const nodes: ScheduledNode[] = [{ stop, disconnect }];
    disconnectScheduled(nodes);
    expect(stop).toHaveBeenCalledWith(0);
    expect(disconnect).toHaveBeenCalled();
    expect(nodes).toHaveLength(0);
  });

  it('swallows errors from a node whose stop()/disconnect() throws', () => {
    const nodes: ScheduledNode[] = [
      {
        stop: () => {
          throw new Error('already stopped');
        },
      },
    ];
    expect(() => disconnectScheduled(nodes)).not.toThrow();
  });

  it('handles nodes with no stop/disconnect method at all', () => {
    const nodes: ScheduledNode[] = [{}];
    expect(() => disconnectScheduled(nodes)).not.toThrow();
  });
});

describe('scheduleMetroClick', () => {
  it('schedules an oscillator+gain pair and registers both for cleanup', () => {
    const ctx = fakeContext();
    const nodes: ScheduledNode[] = [];
    scheduleMetroClick(ctx, 0, true, 60, nodes);
    expect(nodes).toHaveLength(2);
  });
});

describe('playSnareHit', () => {
  it('schedules a body oscillator, a noise burst, and registers all nodes for cleanup', () => {
    const ctx = fakeContext();
    const nodes: ScheduledNode[] = [];
    playSnareHit(ctx, 0, true, 70, nodes);
    expect(nodes.length).toBeGreaterThanOrEqual(5);
  });
});

describe('scheduleNote', () => {
  it('is a no-op for a rest', () => {
    const ctx = fakeContext();
    const nodes: ScheduledNode[] = [];
    scheduleNote(ctx, 0, 1, true, false, 'percussive', 90, 60, nodes);
    expect(nodes).toHaveLength(0);
  });

  it('routes "percussive" through playSnareHit', () => {
    const ctx = fakeContext();
    const nodes: ScheduledNode[] = [];
    scheduleNote(ctx, 0, 1, false, true, 'percussive', 90, 60, nodes);
    expect(nodes.length).toBeGreaterThanOrEqual(5);
  });

  it('schedules a simple oscillator+gain pair for "instrumental" and "melodic"', () => {
    for (const soundType of ['instrumental', 'melodic'] as const) {
      const ctx = fakeContext();
      const nodes: ScheduledNode[] = [];
      scheduleNote(ctx, 0, 1, false, true, soundType, 90, 60, nodes);
      expect(nodes).toHaveLength(2);
    }
  });
});

describe('buildPlaybackEvents', () => {
  it('flattens a multi-measure pattern into a flat, time-sorted event list', () => {
    const pattern: Measure[] = [
      [{ beat: 0, duration: 1, isRest: false }, { beat: 1, duration: 1, isRest: true }],
      [{ beat: 0, duration: 2, isRest: false }],
    ];
    const { events, totalDuration } = buildPlaybackEvents(pattern, 60, 2, 1, 2);
    expect(events).toHaveLength(3);
    expect(events.map((e) => e.time)).toEqual([...events.map((e) => e.time)].sort((a, b) => a - b));
    expect(totalDuration).toBeCloseTo(2 * 2 * 1, 5); // numMeasures * measureTotalBeats * (60/bpm)
  });

  it('marks a note as isBeat1 when its beat lands on a pulse boundary', () => {
    const pattern: Measure[] = [[{ beat: 0, duration: 1, isRest: false }, { beat: 1, duration: 1, isRest: false }]];
    const { events } = buildPlaybackEvents(pattern, 60, 2, 1, 1);
    expect(events[0]!.isBeat1).toBe(true);
    expect(events[1]!.isBeat1).toBe(true); // beat 1 is also a pulse boundary at pulseBeats=1
  });

  // A tied note is a notation split (lib/rhythm/time.ts's tieSplitMeasure),
  // not a separate attack — playback must sound identical to the pre-split
  // rhythm: one onset, held for the combined duration.
  it('merges a tied run into one playback event with the combined duration', () => {
    const pattern: Measure[] = [
      [
        { beat: 2.5, duration: 0.5, isRest: false, tied: true },
        { beat: 3, duration: 0.5, isRest: false },
      ],
    ];
    const { events } = buildPlaybackEvents(pattern, 60, 4, 1, 1);
    expect(events).toHaveLength(1);
    expect(events[0]!.time).toBeCloseTo(2.5, 5);
    expect(events[0]!.duration).toBeCloseTo(1, 5);
  });

  it('merges a three-piece tied run into one event', () => {
    const pattern: Measure[] = [
      [
        { beat: 0.5, duration: 0.5, isRest: false, tied: true },
        { beat: 1, duration: 1, isRest: false, tied: true },
        { beat: 2, duration: 1, isRest: false },
      ],
    ];
    const { events } = buildPlaybackEvents(pattern, 60, 3, 1, 1);
    expect(events).toHaveLength(1);
    expect(events[0]!.duration).toBeCloseTo(2.5, 5);
  });

  it('does not merge across a gap, even if a note happens to be tied and something else intervenes', () => {
    const pattern: Measure[] = [
      [
        { beat: 0, duration: 0.5, isRest: false, tied: true },
        { beat: 1, duration: 0.5, isRest: false }, // not contiguous with the tied note above
      ],
    ];
    const { events } = buildPlaybackEvents(pattern, 60, 2, 1, 1);
    expect(events).toHaveLength(2);
  });

  it('leaves untied notes exactly as before (regression guard)', () => {
    const pattern: Measure[] = [[{ beat: 0, duration: 1, isRest: false }, { beat: 1, duration: 1, isRest: false }]];
    const { events } = buildPlaybackEvents(pattern, 60, 2, 1, 1);
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.duration)).toEqual([1, 1]);
  });
});
