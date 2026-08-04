import { describe, expect, it } from 'vitest';
import { parseChord } from './chord';
import { checkFaults, classifyMotion, type FaultCode } from './rules';
import type { Voicing } from './voicing';

function v(symbol: string, pitches: number[], instruments: string[] | null = null): Voicing {
  return { chord: parseChord(symbol)!, pitches, declaredType: null, instruments };
}

function codes(pitches: Voicing): FaultCode[] {
  return checkFaults(pitches).map((f) => f.code);
}

describe('checkFaults — each code has a trigger and a near-miss', () => {
  it('MINOR_NINTH: 13 semitones triggers, 14 (M9) does not', () => {
    expect(codes(v('Cma7', [72, 59]))).toContain('MINOR_NINTH'); // C5 over B3 = m9
    expect(codes(v('Cma7', [74, 60]))).not.toContain('MINOR_NINTH'); // D5 over C4 = M9
  });

  it('SECOND_ON_TOP: a 2nd between the top two voices (caution)', () => {
    expect(codes(v('C7', [74, 72, 64, 60]))).toContain('SECOND_ON_TOP'); // D5–C5 = M2
    expect(codes(v('C7', [72, 67, 64, 60]))).not.toContain('SECOND_ON_TOP');
  });

  it('EXCESSIVE_GAP: >M6 between non-bottom voices triggers; bottom pair octave is fine', () => {
    expect(codes(v('C7', [79, 67, 64, 60]))).toContain('EXCESSIVE_GAP'); // 79–67 = m7 gap
    expect(codes(v('C7', [72, 67, 64, 48]))).not.toContain('EXCESSIVE_GAP'); // bottom pair = P8+
  });

  it('DOUBLED_THIRD: the 3rd in two voices triggers', () => {
    expect(codes(v('C7', [76, 72, 67, 64]))).toContain('DOUBLED_THIRD'); // E5 and E4 both = 3rd
    expect(codes(v('C7', [72, 70, 67, 64]))).not.toContain('DOUBLED_THIRD');
  });

  it('LEAD_NOT_ON_TOP: pitches[0] below another voice triggers', () => {
    expect(codes(v('C7', [64, 72, 67, 60]))).toContain('LEAD_NOT_ON_TOP');
    expect(codes(v('C7', [72, 67, 64, 60]))).not.toContain('LEAD_NOT_ON_TOP');
  });

  it('assumed-root LIL: C7 passes, A-7 fails (lecture example)', () => {
    // Bottom = C3 (48). For C7 that IS the root → no assumed-root violation.
    expect(codes(v('C7', [67, 64, 48]))).not.toContain('LIL_VIOLATION');
    // For A-7 the bottom C3 is the ♭3; assume A2 beneath → m3 below C3 → violation.
    expect(codes(v('Ami7', [67, 64, 48]))).toContain('LIL_VIOLATION');
  });

  it('OUT_OF_RANGE fires only with instruments assigned', () => {
    const low = v('C7', [67, 64, 60, 36], ['trumpet', 'trumpet', 'trumpet', 'trumpet']);
    expect(codes(low)).toContain('OUT_OF_RANGE'); // 36 well below trumpet range
  });
});

describe('classifyMotion', () => {
  it('classifies the four motion types', () => {
    expect(classifyMotion([60, 62], [64, 66])).toBe('parallel'); // both up, gap kept
    expect(classifyMotion([60, 64], [64, 65])).toBe('similar'); // both up, gap changes
    expect(classifyMotion([60, 60], [64, 66])).toBe('oblique'); // one static
    expect(classifyMotion([60, 58], [64, 66])).toBe('contrary'); // opposite
  });
});
