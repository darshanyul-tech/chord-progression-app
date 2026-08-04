import { describe, expect, it } from 'vitest';
import { interval, midiToName, nameToMidi, midiToDisplay } from './pitch';

describe('pitch', () => {
  it('C4 = middle C = 60', () => {
    expect(nameToMidi({ letter: 'C', accidental: null, octave: 4 })).toBe(60);
    expect(midiToName(60)).toEqual({ letter: 'C', accidental: null, octave: 4 });
  });

  it('spells black keys per spelling context', () => {
    expect(midiToDisplay(61, 'sharp')).toBe('C♯4');
    expect(midiToDisplay(61, 'flat')).toBe('D♭4');
    expect(midiToDisplay(63, 'flat')).toBe('E♭4');
  });

  it('round-trips name↔midi across octaves', () => {
    for (let m = 24; m <= 96; m++) {
      expect(nameToMidi(midiToName(m, 'sharp'))).toBe(m);
      expect(nameToMidi(midiToName(m, 'flat'))).toBe(m);
    }
  });

  it('names intervals traditionally', () => {
    expect(interval(60, 63).name).toBe('m3');
    expect(interval(60, 64).name).toBe('M3');
    expect(interval(60, 65).name).toBe('P4');
    expect(interval(60, 66).name).toBe('TT');
    expect(interval(60, 69).name).toBe('M6');
    expect(interval(60, 73).name).toBe('m9');
    expect(interval(60, 73).compound).toBe(true);
    expect(interval(60, 72).name).toBe('P8');
  });
});
