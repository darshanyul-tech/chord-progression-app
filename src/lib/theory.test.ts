import { describe, expect, it } from 'vitest';
import { midiToNoteName, mod12, noteName, pick, shuffle } from './theory';

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
