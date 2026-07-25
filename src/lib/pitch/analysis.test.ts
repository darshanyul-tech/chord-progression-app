import { describe, expect, it } from 'vitest';
import {
  advanceTracker,
  calibrateRmsThreshold,
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

describe('advanceTracker — target-range hold (adjustable tolerance)', () => {
  // Target A4 (440Hz = MIDI 69), ±50 cents accepted. The whole point: a singer
  // may wander anywhere inside the band and still complete the hold, instead of
  // having to freeze on one exact pitch.
  const targetOpts = {
    ...DEFAULT_TRACKER_OPTIONS,
    requiredHoldSec: 0.2,
    target: { midi: 69, toleranceCents: 50, octaveEquivalence: false },
  };

  it('captures a pitch that wobbles across the whole band but never leaves it', () => {
    // Frames swing between ~-45 and ~+45 cents of the target — far more than the
    // 30-cent self-stability gate would ever have tolerated, yet all in range.
    const swings = [-45, +45, -40, +40, -45, +45].map((cents) => 440 * Math.pow(2, cents / 1200));
    let state = initialTrackerState();
    swings.forEach((f) => {
      state = advanceTracker(state, frame(f), 0.05, targetOpts);
      expect(state.phase).not.toBe('idle'); // hold is never broken while in range
    });
    expect(state.phase).toBe('captured');
  });

  it('survives brief detection dropouts mid-hold (the vibrato/wavering case) without losing progress', () => {
    // Sing in-zone, drop out for one low-clarity frame (as a wavering voice's
    // amplitude dip does), then keep singing in-zone. The hold must persist and
    // still complete — accrued time is preserved across the short gap.
    let state = initialTrackerState();
    for (let i = 0; i < 3; i++) state = advanceTracker(state, frame(440), 0.05, targetOpts);
    expect(state.heldSec).toBeGreaterThan(0);
    const heldBefore = state.heldSec;
    state = advanceTracker(state, frame(430, 0.4, 0.05), 0.05, targetOpts); // low-clarity dropout
    expect(state.phase).not.toBe('idle');
    expect(state.heldSec).toBe(heldBefore); // paused, not wiped
    for (let i = 0; i < 3; i++) state = advanceTracker(state, frame(440), 0.05, targetOpts);
    expect(state.phase).toBe('captured');
  });

  it('resets only once the singer stays outside the band past the grace window', () => {
    let state = advanceTracker(initialTrackerState(), frame(440), 0.05, targetOpts);
    expect(state.phase).toBe('voicing');
    // A single frame ~90 cents sharp is tolerated (within grace)...
    const sharp = frame(440 * Math.pow(2, 90 / 1200));
    state = advanceTracker(state, sharp, 0.05, targetOpts);
    expect(state.phase).not.toBe('idle');
    // ...but sustaining it well past maxGapSec (0.3s) resets the hold.
    for (let i = 0; i < 8; i++) state = advanceTracker(state, sharp, 0.05, targetOpts);
    expect(state.phase).toBe('idle');
  });

  it('a tighter tolerance treats a wobble as out-of-zone that a looser one would accept', () => {
    const tight = { ...targetOpts, target: { midi: 69, toleranceCents: 20, octaveEquivalence: false } };
    let state = advanceTracker(initialTrackerState(), frame(440), 0.05, tight);
    // ~35 cents flat: inside ±50 but outside ±20. Held past the grace window it
    // must reset, where the looser ±50 band would have kept accruing.
    const flat = frame(440 * Math.pow(2, -35 / 1200));
    for (let i = 0; i < 9; i++) state = advanceTracker(state, flat, 0.05, tight);
    expect(state.phase).toBe('idle');
  });

  it('folds octaves when the target allows it, so an octave-displaced but in-range hold still captures', () => {
    const octaveOpts = { ...targetOpts, target: { midi: 69, toleranceCents: 50, octaveEquivalence: true } };
    // Sing A3 (220Hz) — an octave below A4 — steadily. With octave-equivalence
    // it is 0 cents from the folded target and should capture.
    const frames = Array.from({ length: 6 }, () => frame(220));
    let state = initialTrackerState();
    frames.forEach((f) => {
      state = advanceTracker(state, f, 0.05, octaveOpts);
    });
    expect(state.phase).toBe('captured');
  });
});

describe('calibrateRmsThreshold', () => {
  it('returns the floor for an empty sample set', () => {
    expect(calibrateRmsThreshold([])).toBe(DEFAULT_TRACKER_OPTIONS.rmsThreshold);
  });

  it('returns the floor when the room is quieter than it (silent room never lowers the gate)', () => {
    expect(calibrateRmsThreshold([0.0001, 0.0002, 0.0001])).toBe(DEFAULT_TRACKER_OPTIONS.rmsThreshold);
  });

  it('scales with the ambient median in a noisy room', () => {
    // Ambient median 0.02 -> threshold 0.06 (x3), well above the 0.01 floor.
    expect(calibrateRmsThreshold([0.02, 0.02, 0.02])).toBeCloseTo(0.06, 10);
  });

  it('uses the median, so a brief loud transient during the window does not inflate the threshold', () => {
    const ambient = [0.02, 0.02, 0.02, 0.02, 0.9]; // chair scrape at the end
    expect(calibrateRmsThreshold(ambient)).toBeCloseTo(0.06, 10);
  });

  it('honors custom floor and factor', () => {
    expect(calibrateRmsThreshold([0.05], 0.001, 2)).toBeCloseTo(0.1, 10);
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
