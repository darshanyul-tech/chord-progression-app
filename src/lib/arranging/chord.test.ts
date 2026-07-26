import { describe, expect, it } from 'vitest';
import { chordTones, degreeOf, parseChord } from './chord';
import { pitchClass } from './pitch';

describe('chord parser', () => {
  it('the seventh is small (minor) unless a maj marker is present', () => {
    const g7 = parseChord('G7')!;
    expect(g7.quality).toBe('dominant');
    expect(g7.seventh).toBe('b7');
    const gmaj7 = parseChord('Gma7')!;
    expect(gmaj7.quality).toBe('major');
    expect(gmaj7.seventh).toBe('maj7');
  });

  it('G9 contains its b7 (F); Gma7 does not', () => {
    const g9 = parseChord('G9')!;
    const tones9 = Object.values(chordTones(g9));
    expect(tones9).toContain(pitchClass(65)); // F
    const gmaj7 = parseChord('Gma7')!;
    const tonesMaj = Object.values(chordTones(gmaj7));
    expect(tonesMaj).not.toContain(pitchClass(65)); // F natural absent (F# is the maj7)
    expect(tonesMaj).toContain(pitchClass(66)); // F#
  });

  it('Brandt & Roemer maj7 variants all parse to one structure', () => {
    for (const sym of ['Cmaj7', 'CM7', 'CΔ7', 'Cma7']) {
      const c = parseChord(sym)!;
      expect(c.quality).toBe('major');
      expect(c.seventh).toBe('maj7');
      expect(c.root).toBe(0);
    }
  });

  it('parses C13(#11) into triad C, extensions, alteration', () => {
    const c = parseChord('C13(#11)')!;
    expect(c.root).toBe(0);
    expect(c.quality).toBe('dominant');
    expect(c.seventh).toBe('b7');
    expect(c.extensions).toEqual([9, 11, 13]);
    expect(c.alterations).toEqual(['#11']);
    expect(c.canonical).toBe('C13(♯11)');
  });

  it('does not mistake b9 for a natural 9th extension', () => {
    const c = parseChord('C7(b9)')!;
    expect(c.extensions).toEqual([]);
    expect(c.alterations).toEqual(['b9']);
  });

  it('#11 replaces the natural 11 in chord tones', () => {
    const c = parseChord('C13(#11)')!;
    const tones = chordTones(c);
    expect(tones['11']).toBeUndefined();
    expect(tones['#11']).toBe(pitchClass(6)); // F#
  });

  it('discriminates slash chord from polychord', () => {
    const slash = parseChord('Cma7/D')!;
    expect(slash.isPolychord).toBe(false);
    expect(slash.bass).toBe(2); // D
    expect(slash.upperChord).toBeNull();

    const poly = parseChord('Ebmi/Gb7')!;
    expect(poly.isPolychord).toBe(true);
    expect(poly.upperChord?.root).toBe(3); // Eb
    expect(poly.upperChord?.quality).toBe('minor');
  });

  it('resolves minor / half-diminished qualities', () => {
    expect(parseChord('Dmi7')!.quality).toBe('minor');
    expect(parseChord('Bmi7b5')!.quality).toBe('minor7b5');
    expect(parseChord('Bø')!.quality).toBe('minor7b5');
    expect(parseChord('C+7')!.quality).toBe('augmented');
    expect(parseChord('Cdim7')!.quality).toBe('diminished');
  });

  it('degreeOf identifies chord degrees', () => {
    const c = parseChord('C7')!;
    expect(degreeOf(c, 60)).toBe('1'); // C
    expect(degreeOf(c, 64)).toBe('3'); // E
    expect(degreeOf(c, 70)).toBe('7'); // Bb
    expect(degreeOf(c, 61)).toBe('non-chord-tone'); // C#
  });
});
