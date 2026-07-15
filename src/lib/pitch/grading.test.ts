import { describe, expect, it } from 'vitest';
import { gradeSungInterval } from './grading';

const LENIENT = { toleranceCents: 50, octaveEquivalence: false };
const OCTAVE_EQ = { toleranceCents: 50, octaveEquivalence: true };

describe('gradeSungInterval — basic accuracy', () => {
  it('grades a dead-on-target pitch as correct with ~0 cents off', () => {
    // root C4 (60), major 3rd above = E4 (64)
    const result = gradeSungInterval(60, 4, 64, LENIENT);
    expect(result.correct).toBe(true);
    expect(result.centsOff).toBeCloseTo(0, 5);
    expect(result.sungLabel).toBe('E4');
  });

  it('grades within tolerance as correct', () => {
    const result = gradeSungInterval(60, 4, 64.3, LENIENT); // 30 cents sharp
    expect(result.correct).toBe(true);
    expect(result.centsOff).toBeCloseTo(30, 1);
  });

  it('grades outside tolerance as incorrect', () => {
    const result = gradeSungInterval(60, 4, 64.7, LENIENT); // 70 cents sharp, tolerance 50
    expect(result.correct).toBe(false);
    expect(result.centsOff).toBeCloseTo(70, 1);
  });
});

describe('gradeSungInterval — direction (sign of targetSemitones)', () => {
  it('a positive targetSemitones grades an interval above the root', () => {
    const result = gradeSungInterval(60, 7, 67, LENIENT); // P5 above C4 = G4
    expect(result.correct).toBe(true);
  });

  it('a negative targetSemitones grades an interval below the root', () => {
    const result = gradeSungInterval(60, -7, 53, LENIENT); // P5 below C4 = F3
    expect(result.correct).toBe(true);
  });

  it('singing the interval in the wrong direction is graded incorrect without octave equivalence', () => {
    // Asked for a P5 above (G4=67) but sang a P5 below (F3=53) instead.
    const result = gradeSungInterval(60, 7, 53, LENIENT);
    expect(result.correct).toBe(false);
  });
});

describe('gradeSungInterval — octave equivalence', () => {
  it('accepts the correct pitch class an octave higher when enabled', () => {
    // Target: major 3rd above C4 = E4 (64). Sung E5 (76) instead — same pitch class, +1 octave.
    const result = gradeSungInterval(60, 4, 76, OCTAVE_EQ);
    expect(result.correct).toBe(true);
    expect(result.centsOff).toBeCloseTo(0, 5);
  });

  it('accepts the correct pitch class an octave lower when enabled', () => {
    const result = gradeSungInterval(60, 4, 52, OCTAVE_EQ); // E3, one octave below E4
    expect(result.correct).toBe(true);
    expect(result.centsOff).toBeCloseTo(0, 5);
  });

  it('still rejects a genuinely wrong pitch class regardless of octave', () => {
    const result = gradeSungInterval(60, 4, 65, OCTAVE_EQ); // F4, a semitone off from E4/E5/E3/...
    expect(result.correct).toBe(false);
  });

  it('without octave equivalence, an octave-shifted correct pitch class is graded incorrect', () => {
    const result = gradeSungInterval(60, 4, 76, LENIENT); // E5 instead of E4, no octave folding
    expect(result.correct).toBe(false);
    expect(result.centsOff).toBeCloseTo(1200, 5);
  });

  it('folds cents symmetrically near the octave boundary (599 vs 601 cents off)', () => {
    const justUnder = gradeSungInterval(60, 0, 60 + 599 / 100, OCTAVE_EQ);
    const justOver = gradeSungInterval(60, 0, 60 + 601 / 100, OCTAVE_EQ);
    expect(justUnder.centsOff).toBeCloseTo(599, 1);
    expect(justOver.centsOff).toBeCloseTo(-599, 1); // wraps to the other side of the octave
  });
});
