import { afterEach, describe, expect, it } from 'vitest';
import { midiToNoteName, mod12, noteName, pick, random, setRng, shuffle } from './theory';

describe('mod12', () => {
  it('wraps negative numbers into 0-11', () => {
    expect(mod12(-1)).toBe(11);
    expect(mod12(13)).toBe(1);
    expect(mod12(0)).toBe(0);
  });
});

describe('noteName', () => {
  it('maps pitch classes to names', () => {
    expect(noteName(0)).toBe('C');
    expect(noteName(11)).toBe('B');
    expect(noteName(12)).toBe('C');
  });
});

describe('midiToNoteName', () => {
  it('matches known reference points', () => {
    expect(midiToNoteName(60)).toBe('C4');
    expect(midiToNoteName(69)).toBe('A4');
    expect(midiToNoteName(21)).toBe('A0');
  });
});

describe('pick', () => {
  it('always returns an element of the array', () => {
    const arr = [1, 2, 3];
    for (let i = 0; i < 20; i++) {
      expect(arr).toContain(pick(arr));
    }
  });
});

describe('shuffle', () => {
  it('returns a permutation without mutating the input', () => {
    const arr = [1, 2, 3, 4, 5];
    const copy = [...arr];
    const result = shuffle(arr);
    expect(arr).toEqual(copy);
    expect(result.slice().sort()).toEqual(arr.slice().sort());
  });
});

// Seedable RNG (09-improvement-plan.md §15.1) — every generator's randomness
// routes through random(), so setRng() makes pick()/shuffle() (and by
// extension every exercise generator and the exam paper-builder's shuffle)
// deterministic under test.
describe('setRng / random', () => {
  afterEach(() => setRng());

  it('random() falls through to Math.random() by default', () => {
    for (let i = 0; i < 20; i++) {
      const v = random();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('setRng overrides random() with a fixed value', () => {
    setRng(() => 0.5);
    expect(random()).toBe(0.5);
    expect(random()).toBe(0.5);
  });

  it('setRng() with no argument restores Math.random()', () => {
    setRng(() => 0);
    expect(random()).toBe(0);
    setRng();
    const v = random();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });

  it('spying on Math.random still works after setRng() is reset — the module never captures a stale reference', () => {
    // Regression: an earlier draft stored `let currentRng = Math.random`,
    // which froze the reference before any later vi.spyOn(Math, 'random')
    // could take effect. random() must re-read Math.random on every call.
    setRng();
    const original = Math.random;
    try {
      Math.random = () => 0.25;
      expect(random()).toBe(0.25);
    } finally {
      Math.random = original;
    }
  });

  it('pick() is deterministic under a fixed rng', () => {
    setRng(() => 0);
    expect(pick([10, 20, 30])).toBe(10);
    setRng(() => 0.999);
    expect(pick([10, 20, 30])).toBe(30);
  });

  it('shuffle() produces an exact, assertable permutation from a scripted rng sequence', () => {
    // Fisher-Yates draws, i = 4,3,2,1 (4-th..1st swap), scripted:
    // i=4: j=floor(0.9*5)=4 (no-op) -> [1,2,3,4,5]
    // i=3: j=floor(0.5*4)=2         -> [1,2,4,3,5]
    // i=2: j=floor(0.1*3)=0         -> [4,2,1,3,5]
    // i=1: j=floor(0*2)=0           -> [2,4,1,3,5]
    const seq = [0.9, 0.5, 0.1, 0];
    let idx = 0;
    setRng(() => seq[idx++]!);
    expect(shuffle([1, 2, 3, 4, 5])).toEqual([2, 4, 1, 3, 5]);
  });
});
