// Framework-free pitch analysis (docs/09-improvement-plan.md §16.2): f0/cents
// math, plus a sustained-pitch tracker expressed as a pure reducer
// (advanceTracker(state, frame) => nextState) rather than a stateful class —
// this is what makes "unit tests drive it with scripted frame sequences"
// (wobbly attack, scooped entry, octave jump) straightforward: each test just
// calls advanceTracker in a loop and asserts the resulting state after each
// frame, with no hidden internal mutation to work around.

export function midiFromF0(f0: number): number {
  return 69 + 12 * Math.log2(f0 / 440);
}

export function f0FromMidi(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function centsBetween(freqA: number, freqB: number): number {
  return 1200 * Math.log2(freqA / freqB);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export type TrackerPhase = 'idle' | 'voicing' | 'held' | 'captured';

export interface TrackerState {
  phase: TrackerPhase;
  /** Recent frequency samples (Hz) within the current stable run, most-recent last — feeds the running-median stability check and the final captured estimate. */
  history: number[];
  /** Seconds the current run has been continuously within tolerance. */
  heldSec: number;
  /** Set only once phase reaches 'captured'; the median-smoothed pitch as a fractional MIDI number. */
  capturedMidi: number | null;
}

export function initialTrackerState(): TrackerState {
  return { phase: 'idle', history: [], heldSec: 0, capturedMidi: null };
}

export interface TrackerFrame {
  /** Detected fundamental in Hz, or null when the detector found nothing this frame. */
  frequency: number | null;
  /** Detector clarity/confidence, 0 when frequency is null. */
  clarity: number;
  /** Frame loudness (e.g. RMS of the analysis window), used as a room-noise gate. */
  rms: number;
}

export interface TrackerOptions {
  /** Minimum detector clarity to treat a frame as voiced. */
  clarityThreshold: number;
  /** Minimum RMS to treat a frame as voiced (room noise / laptop fan gate). */
  rmsThreshold: number;
  /** How far (in cents) a new frame may drift from the running median and still count as the same held pitch. */
  stabilityCents: number;
  /** Total continuous held time required before the tracker reports 'captured'. */
  requiredHoldSec: number;
  /** How many recent samples feed the running median / final estimate. */
  historySize: number;
}

export const DEFAULT_TRACKER_OPTIONS: TrackerOptions = {
  clarityThreshold: 0.85,
  rmsThreshold: 0.01,
  stabilityCents: 30,
  requiredHoldSec: 0.5,
  historySize: 8,
};

/**
 * Ambient-noise calibration (docs/10-next-phases.md §17.3, deferred from
 * 09-improvement-plan.md §16.4): given the RMS values of the first couple of
 * seconds of mic frames after the mic opens, returns the rmsThreshold the
 * tracker should use — a multiple of the ambient median so laptop fans and
 * room hiss don't count as voicing, floored at the fixed default so a dead-
 * silent room never lowers the gate below it. Median (not mean) so a brief
 * cough or chair scrape during the window doesn't inflate the threshold.
 */
export function calibrateRmsThreshold(
  ambientRms: number[],
  floor: number = DEFAULT_TRACKER_OPTIONS.rmsThreshold,
  factor = 3,
): number {
  if (!ambientRms.length) return floor;
  return Math.max(floor, median(ambientRms) * factor);
}

/**
 * Advances the tracker by one analysis frame. Pure function: never mutates
 * `state`, always returns a fresh TrackerState. Once `phase` reaches
 * 'captured' the tracker is terminal for that attempt — call
 * initialTrackerState() to start listening for the next one.
 */
export function advanceTracker(
  state: TrackerState,
  frame: TrackerFrame,
  frameSec: number,
  opts: TrackerOptions = DEFAULT_TRACKER_OPTIONS,
): TrackerState {
  if (state.phase === 'captured') return state;

  const qualifies = frame.frequency !== null && frame.clarity >= opts.clarityThreshold && frame.rms >= opts.rmsThreshold;
  if (!qualifies) {
    // A gap (silence, breath, low-confidence frame) resets the stability
    // window entirely — a wobbly attack shouldn't quietly splice its shaky
    // opening onto a later, cleaner hold.
    return initialTrackerState();
  }

  const freq = frame.frequency!;

  if (state.history.length === 0) {
    // First qualifying frame after idle/reset: nothing to compare against yet.
    return { phase: 'voicing', history: [freq], heldSec: 0, capturedMidi: null };
  }

  const runningMedian = median(state.history);
  const stable = Math.abs(centsBetween(freq, runningMedian)) <= opts.stabilityCents;

  if (!stable) {
    // Pitch moved too far from the recent median (scoop, octave jump/
    // correction) — restart the stability window on this new frame instead
    // of discarding the attempt outright; a portamento into the target note
    // should still resolve once it settles.
    return { phase: 'voicing', history: [freq], heldSec: 0, capturedMidi: null };
  }

  const nextHistory = [...state.history, freq].slice(-opts.historySize);
  const heldSec = state.heldSec + frameSec;

  if (heldSec >= opts.requiredHoldSec) {
    return { phase: 'captured', history: nextHistory, heldSec, capturedMidi: midiFromF0(median(nextHistory)) };
  }
  return { phase: 'held', history: nextHistory, heldSec, capturedMidi: null };
}
