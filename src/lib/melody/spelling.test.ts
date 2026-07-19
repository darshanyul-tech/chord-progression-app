import { describe, expect, it } from 'vitest';
import { MELODY_KEYS, diatonicPcs, keyById } from './theory';
import { midiToVexKey, spellMidi, spellingTableFor } from './spelling';

function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

const LETTER_NATURAL_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

describe('spellingTableFor', () => {
  it('covers all 12 pitch classes for every one of the 14 supported keys', () => {
    MELODY_KEYS.forEach((key) => {
      const table = spellingTableFor(key);
      for (let pc = 0; pc < 12; pc++) {
        expect(table[pc], `${key.id} pc ${pc}`).toBeDefined();
        // Accidental must actually resolve back to the target pc (round trip).
        const off = table[pc]!.accidental === '#' ? 1 : table[pc]!.accidental === 'b' ? -1 : 0;
        expect(mod12(LETTER_NATURAL_PC[table[pc]!.letter]! + off)).toBe(pc);
      }
    });
  });

  it('diatonic pitch classes spell using single, non-clashing letters (one per diatonic degree)', () => {
    MELODY_KEYS.forEach((key) => {
      const table = spellingTableFor(key);
      const pcs = diatonicPcs(key);
      const letters = pcs.map((pc) => table[pc]!.letter);
      expect(new Set(letters).size).toBe(7);
    });
  });

  it('spot-checks known key signatures (G major = F#, Bb major = Bb+Eb, F major = Bb)', () => {
    const g = spellingTableFor(keyById('G'));
    expect(g[6]).toEqual({ letter: 'F', accidental: '#' }); // F# diatonic 7th
    const bb = spellingTableFor(keyById('Bb'));
    expect(bb[10]).toEqual({ letter: 'B', accidental: 'b' });
    expect(bb[3]).toEqual({ letter: 'E', accidental: 'b' });
    const f = spellingTableFor(keyById('F'));
    expect(f[10]).toEqual({ letter: 'B', accidental: 'b' });
  });

  it('prefers sharps in sharp keys and flats in flat keys / C for the same chromatic pc', () => {
    // pc 1 (C#/Db) is a "true chromatic" pc in both C and F major (neither alters C or D).
    const c = spellingTableFor(keyById('C'));
    expect(c[1]!.accidental).toBe('b');
    const g = spellingTableFor(keyById('G'));
    expect(g[1]!.accidental).toBe('#');
  });
});

describe('spellMidi / midiToVexKey', () => {
  it('produces a well-formed VexFlow key string for every key and every pc', () => {
    MELODY_KEYS.forEach((key) => {
      for (let midi = 60; midi < 72; midi++) {
        const vexKey = midiToVexKey(midi, key);
        expect(vexKey).toMatch(/^[a-g](#|b)?\/\d+$/);
      }
    });
  });

  it('octave matches standard MIDI convention (C4 = midi 60) regardless of key', () => {
    MELODY_KEYS.forEach((key) => {
      const spelled = spellMidi(60, key);
      expect(spelled.octave).toBe(4);
    });
  });

  it('honors an explicit preferAccidental for a chromatic (out-of-key) pc — the melodic-dictation Sharp/Flat bug', () => {
    // C major has no sharps or flats: pc 1 (C#/Db) is purely chromatic there,
    // and the default table ties toward flat (sharpKey: false). Before this
    // fix, spellMidi had no way to honor an explicit Sharp choice at all —
    // every chromatic note rendered as a flat regardless of which accidental
    // button placed it.
    const c = keyById('C');
    expect(spellMidi(61, c, '#')).toEqual({ letter: 'C', accidental: '#', octave: 4 });
    expect(spellMidi(61, c, 'b')).toEqual({ letter: 'D', accidental: 'b', octave: 4 });
    expect(spellMidi(61, c)).toEqual({ letter: 'D', accidental: 'b', octave: 4 }); // unchanged default
  });

  it('ignores preferAccidental for a pc that is diatonic to the key, even if it needs an accidental', () => {
    // F# (pc 6) is G major's diatonic 4th degree — it must always render as
    // F# there (matching the key signature), never as Gb, regardless of
    // which accidental button was armed when the note was placed.
    const g = keyById('G');
    expect(spellMidi(66, g, 'b')).toEqual({ letter: 'F', accidental: '#', octave: 4 });
    expect(spellMidi(66, g, '#')).toEqual({ letter: 'F', accidental: '#', octave: 4 });
  });

  it('ignores preferAccidental for a natural-letter pc even when non-diatonic (avoids an octave-crossing respelling like B#/Cb)', () => {
    // pc 0 (C) is non-diatonic to E major, but it already has its own
    // natural-letter spelling (plain C) via the courtesy-natural rule —
    // respelling it as "B#" to honor a Sharp hint would silently shift the
    // octave digit (B#3 sounds the same as C4, not "B#4").
    const e = keyById('E');
    expect(spellMidi(60, e, '#')).toEqual({ letter: 'C', accidental: '', octave: 4 });
  });

  it('midiToVexKey threads preferAccidental through to the VexFlow key string', () => {
    const c = keyById('C');
    expect(midiToVexKey(61, c, '#')).toBe('c#/4');
    expect(midiToVexKey(61, c, 'b')).toBe('db/4');
    expect(midiToVexKey(61, c)).toBe('db/4');
  });
});
