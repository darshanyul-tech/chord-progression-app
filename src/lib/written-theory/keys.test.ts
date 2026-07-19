import { KeySignature } from 'vexflow';
import { describe, expect, it } from 'vitest';
import {
  degreeOfLetter,
  keysWithin,
  scaleSpelling,
  signatureAccidentalForLetter,
  theoryKeyById,
  THEORY_KEYS,
  tonicPitchClass,
} from './keys';

describe('THEORY_KEYS — all 30 vexKeySpec ids verified against VexFlow 5 itself', () => {
  it('has exactly 30 keys (15 major + 15 minor)', () => {
    expect(THEORY_KEYS).toHaveLength(30);
    expect(THEORY_KEYS.filter((k) => k.mode === 'major')).toHaveLength(15);
    expect(THEORY_KEYS.filter((k) => k.mode === 'minor')).toHaveLength(15);
  });

  it.each(THEORY_KEYS.map((k) => [k.id, k] as const))(
    '%s: vexKeySpec renders and matches accidentalCount/sharps',
    (_id, k) => {
      const sig = new KeySignature(k.vexKeySpec);
      expect(() => sig.format()).not.toThrow();
      // accList is `protected` in VexFlow's .d.ts but populated as a plain
      // array at runtime by format() — this is the only way to read back
      // what VexFlow itself resolved the spec to, short of a full render.
      const accList = (sig as unknown as { accList: { type: string }[] }).accList;
      expect(accList).toHaveLength(k.accidentalCount);
      if (k.accidentalCount > 0) {
        expect(accList[0]!.type).toBe(k.sharps ? '#' : 'b');
      }
    },
  );

  it('ids are unique', () => {
    const ids = THEORY_KEYS.map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('rejects an unknown id', () => {
    expect(() => theoryKeyById('Q#')).toThrow();
  });

  it('relative major/minor pairs point at each other', () => {
    for (const k of THEORY_KEYS) {
      const rel = theoryKeyById(k.relativeId);
      expect(rel.relativeId).toBe(k.id);
      expect(rel.mode).not.toBe(k.mode);
    }
  });

  it('a relative pair shares the same accidental count and sharp/flat side', () => {
    for (const k of THEORY_KEYS) {
      const rel = theoryKeyById(k.relativeId);
      expect(rel.accidentalCount).toBe(k.accidentalCount);
      if (k.accidentalCount > 0) expect(rel.sharps).toBe(k.sharps);
    }
  });
});

describe('keysWithin', () => {
  it('bounds by accidental count and filters by mode', () => {
    const majorsTo3 = keysWithin(3, 'major');
    expect(majorsTo3.every((k) => k.mode === 'major' && k.accidentalCount <= 3)).toBe(true);
    // Ab major has 4 flats, so it's excluded at a bound of 3.
    expect(majorsTo3.map((k) => k.id).sort()).toEqual(['A', 'Bb', 'C', 'D', 'Eb', 'F', 'G'].sort());
  });

  it('"both" includes every key within the bound', () => {
    const within0 = keysWithin(0, 'both');
    expect(within0.map((k) => k.id).sort()).toEqual(['Am', 'C']);
  });

  it('the 0-accidental key is always included at any bound >= 0', () => {
    expect(keysWithin(7, 'major').some((k) => k.id === 'C')).toBe(true);
    expect(keysWithin(7, 'minor').some((k) => k.id === 'Am')).toBe(true);
  });
});

describe('scaleSpelling — hand-checked cases', () => {
  it('C major', () => {
    expect(scaleSpelling(theoryKeyById('C'))).toEqual([
      { letter: 'C', acc: '' },
      { letter: 'D', acc: '' },
      { letter: 'E', acc: '' },
      { letter: 'F', acc: '' },
      { letter: 'G', acc: '' },
      { letter: 'A', acc: '' },
      { letter: 'B', acc: '' },
    ]);
  });

  it('Eb major — 6th degree is C (docs/15-theory-topics/03 canonical example)', () => {
    const degrees = scaleSpelling(theoryKeyById('Eb'));
    expect(degrees[5]).toEqual({ letter: 'C', acc: '' });
  });

  it('B major — 4th degree is E', () => {
    const degrees = scaleSpelling(theoryKeyById('B'));
    expect(degrees[3]).toEqual({ letter: 'E', acc: '' });
  });

  it('F# major — 7th degree is E# (leading note), not F natural', () => {
    const degrees = scaleSpelling(theoryKeyById('F#'));
    expect(degrees[6]).toEqual({ letter: 'E', acc: '#' });
  });

  it('C# minor (natural minor form) — 7th degree is subtonic B natural', () => {
    const degrees = scaleSpelling(theoryKeyById('C#m'));
    expect(degrees[6]).toEqual({ letter: 'B', acc: '' });
  });

  it('every key spells 7 distinct letters', () => {
    for (const k of THEORY_KEYS) {
      const letters = scaleSpelling(k).map((d) => d.letter);
      expect(new Set(letters).size).toBe(7);
    }
  });
});

describe('degreeOfLetter', () => {
  it('Eb major: C is degree 6', () => {
    expect(degreeOfLetter(theoryKeyById('Eb'), 'C', '')).toBe(6);
  });

  it('B minor: A is degree 7 (subtonic)', () => {
    expect(degreeOfLetter(theoryKeyById('Bm'), 'A', '')).toBe(7);
  });

  it('returns null for a non-diatonic letter+accidental', () => {
    expect(degreeOfLetter(theoryKeyById('C'), 'C', '#')).toBeNull();
  });
});

describe('signatureAccidentalForLetter', () => {
  it('D major: every F is implicitly sharp (not just the scale-degree use)', () => {
    expect(signatureAccidentalForLetter(theoryKeyById('D'), 'F')).toBe('#');
    expect(signatureAccidentalForLetter(theoryKeyById('D'), 'C')).toBe('#');
    expect(signatureAccidentalForLetter(theoryKeyById('D'), 'G')).toBe('');
  });

  it('Bb major: B and E are implicitly flat', () => {
    expect(signatureAccidentalForLetter(theoryKeyById('Bb'), 'B')).toBe('b');
    expect(signatureAccidentalForLetter(theoryKeyById('Bb'), 'E')).toBe('b');
  });

  it('C major / Am: every letter is natural', () => {
    for (const letter of ['C', 'D', 'E', 'F', 'G', 'A', 'B']) {
      expect(signatureAccidentalForLetter(theoryKeyById('C'), letter)).toBe('');
      expect(signatureAccidentalForLetter(theoryKeyById('Am'), letter)).toBe('');
    }
  });

  it('a minor key carries the same per-letter accidentals as its relative major', () => {
    for (const k of THEORY_KEYS.filter((k) => k.mode === 'minor')) {
      const relative = theoryKeyById(k.relativeId);
      for (const letter of ['C', 'D', 'E', 'F', 'G', 'A', 'B']) {
        expect(signatureAccidentalForLetter(k, letter)).toBe(signatureAccidentalForLetter(relative, letter));
      }
    }
  });
});

describe('tonicPitchClass', () => {
  it('C and Am share pitch class 0; enharmonic keys share a pitch class too', () => {
    expect(tonicPitchClass(theoryKeyById('C'))).toBe(0);
    expect(tonicPitchClass(theoryKeyById('Am'))).toBe(9);
    expect(tonicPitchClass(theoryKeyById('F#'))).toBe(tonicPitchClass(theoryKeyById('Gb')));
  });
});
