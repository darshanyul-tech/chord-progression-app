import { describe, expect, it } from 'vitest';
import {
  advanceTracker,
  centsBetween,
  DEFAULT_TRACKER_OPTIONS,
  f0FromMidi,
  initialTrackerState,
  midiFromF0,
  type TrackerFrame,
  type TrackerState,
} from './analysis';

describe('midiFromF0 / f0FromMidi', () => {
  it('matches known reference pitches', () => {
    expect(midiFromF0(440)).toBeCloseTo(69, 5);
    expect(midiFromF0(220)).toBeCloseTo(57, 5);
    expect(midiFromF0(880)).toBeCloseTo(81, 5);
  });

  it('round-trips f0 <-> midi', () => {
    expect(f0FromMidi(midiFromF0(261.63))).toBeCloseTo(261.63, 1);
  });
});

describe('centsBetween', () => {
  it('is 0 for identical frequencies and ±1200 for an octave', () => {
    expect(centsBetween(440, 440)).toBe(0);
    expect(centsBetween(880, 440)).toBeCloseTo(1200, 5);
    expect(centsBetween(220, 440)).toBeCloseTo(-1200, 5);
  });
});

function frame(frequency: number | null, clarity = 0.95, rms = 0.05): TrackerFrame {
  return { frequency, clarity, rms };
}

function run(frames: TrackerFrame[], frameSec = 0.05): TrackerState {
  let state = initialTrackerState();
  frames.forEach((f) => {
    state = advanceTracker(state, f, frameSec);
  });
  return state;
}

describe('advanceTracker — idle/voicing/held/captured progression', () => {
  it('starts idle, moves to voicing on the first qualifying frame, then held, then captured after requiredHoldSec', () => {
    let state = initialTrackerState();
    expect(state.phase).toBe('idle');

    state = advanceTracker(state, frame(440), 0.05);
    expect(state.phase).toBe('voicing');

    // requiredHoldSec defaults to 0.5s; heldSec only starts accumulating
    // from the 2nd qualifying frame onward (the 1st is 'voicing' with
    // heldSec=0), so ~10 more 0.05s frames are needed to reach 0.5s (11 to
    // absorb float-summation drift — 10x0.05 lands a hair under 0.5 in
    // IEEE754, same as the classic 0.1+0.2 case).
    for (let i = 0; i < 11; i++) {
      state = advanceTracker(state, frame(440 + i * 0.1), 0.05); // tiny, sub-cent drift
      expect(['held', 'captured']).toContain(state.phase);
    }
    expect(state.phase).toBe('captured');
    expect(state.capturedMidi).toBeCloseTo(69, 1);
  });

  it('resets to idle on a silent/low-confidence gap', () => {
    let state = advanceTracker(initialTrackerState(), frame(440), 0.05);
    expect(state.phase).toBe('voicing');
    state = advanceTracker(state, frame(null, 0, 0), 0.05);
    expect(state.phase).toBe('idle');
  });

  it('is terminal once captured — further frames do not change it until reset', () => {
    const stableFrames: TrackerFrame[] = Array.from({ length: 15 }, () => frame(440));
    const captured = run(stableFrames);
    expect(captured.phase).toBe('captured');
    const next = advanceTracker(captured, frame(660), 0.05); // a totally different pitch
    expect(next).toBe(captured); // same reference — truly a no-op
  });
});

describe('advanceTracker — wobbly attack', () => {
  it('low-confidence opening frames stay idle; a clean, stable run after them still captures', () => {
    const frames: TrackerFrame[] = [
      frame(430, 0.4, 0.05), // low clarity — doesn't qualify
      frame(450, 0.5, 0.002), // low RMS — doesn't qualify
      ...Array.from({ length: 12 }, () => frame(440)), // then a clean, stable hold
    ];
    const state = run(frames);
    expect(state.phase).toBe('captured');
    expect(state.capturedMidi).toBeCloseTo(69, 1);
  });
});

describe('advanceTracker — scooped entry', () => {
  it('a gradual slide into the target still eventually captures once it settles', () => {
    // Glide from ~150 cents flat up to the target over a few frames, then hold.
    const target = 440;
    const scoop = [-150, -90, -40, -10, 0].map((cents) => target * Math.pow(2, cents / 1200));
    const frames: TrackerFrame[] = [...scoop.map((f) => frame(f)), ...Array.from({ length: 10 }, () => frame(target))];
    const state = run(frames);
    expect(state.phase).toBe('captured');
    expect(state.capturedMidi).toBeCloseTo(midiFromF0(target), 0.5);
  });
});

describe('advanceTracker — octave jump', () => {
  it('a jump to a different octave mid-hold restarts the stability window instead of averaging across it', () => {
    const frames: TrackerFrame[] = [
      ...Array.from({ length: 4 }, () => frame(220)), // starts settling on A3
      frame(440), // octave jump to A4
      ...Array.from({ length: 12 }, () => frame(440)), // then holds A4 cleanly
    ];
    const state = run(frames);
    expect(state.phase).toBe('captured');
    // Captured pitch reflects the post-jump hold (A4), not an average of the two octaves.
    expect(state.capturedMidi).toBeCloseTo(midiFromF0(440), 0.5);
  });
});

describe('advanceTracker — respects custom options', () => {
  it('a shorter requiredHoldSec captures sooner', () => {
    // heldSec starts accumulating from the 2nd qualifying frame (the 1st is
    // 'voicing' with heldSec=0), so requiredHoldSec === frameSec captures on
    // exactly the 2nd frame.
    const opts = { ...DEFAULT_TRACKER_OPTIONS, requiredHoldSec: 0.05 };
    let state = initialTrackerState();
    state = advanceTracker(state, frame(440), 0.05, opts);
    expect(state.phase).toBe('voicing');
    state = advanceTracker(state, frame(440), 0.05, opts);
    expect(state.phase).toBe('captured');
  });
});
