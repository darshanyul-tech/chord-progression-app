import { describe, expect, it } from 'vitest';
import {
  fromNoteSpelling,
  intervalById,
  parseSpelling,
  spelledToMidi,
  spellingLabel,
  spellingsEqual,
  transposeDown,
  transposeUp,
  type SpelledPitch,
} from './spelledPitch';

describe('spelledToMidi', () => {
  it('C4 is 60 (app-wide convention)', () => {
    expect(spelledToMidi({ letter: 'C', acc: '', octave: 4 })).toBe(60);
  });

  it('B#3 sounds as C4 but keeps the letter octave (3), per lib/melody/theory.ts NoteSpelling rule', () => {
    expect(spelledToMidi({ letter: 'B', acc: '#', octave: 3 })).toBe(60);
  });

  it('Cb4 equals B3', () => {
    expect(spelledToMidi({ letter: 'C', acc: 'b', octave: 4 })).toBe(59);
    expect(spelledToMidi({ letter: 'B', acc: '', octave: 3 })).toBe(59);
  });

  it('handles double accidentals', () => {
    expect(spelledToMidi({ letter: 'F', acc: '##', octave: 4 })).toBe(67); // F## = G
    expect(spelledToMidi({ letter: 'B', acc: 'bb', octave: 4 })).toBe(69); // Bbb = A
  });
});

describe('transposeUp / transposeDown — interval math spot grid (docs/15-theory-topics/05 §5)', () => {
  it('M6 above C4 = A4', () => {
    const result = transposeUp({ letter: 'C', acc: '', octave: 4 }, intervalById('M6'));
    expect(result).toEqual({ letter: 'A', acc: '', octave: 4 });
  });

  it('m3 below C4 = A3', () => {
    const result = transposeDown({ letter: 'C', acc: '', octave: 4 }, intervalById('m3'));
    expect(result).toEqual({ letter: 'A', acc: '', octave: 3 });
  });

  it('A4 above F4 = B4', () => {
    const result = transposeUp({ letter: 'F', acc: '', octave: 4 }, intervalById('A4'));
    expect(result).toEqual({ letter: 'B', acc: '', octave: 4 });
  });

  it('d5 above B3 = F4', () => {
    const result = transposeUp({ letter: 'B', acc: '', octave: 3 }, intervalById('d5'));
    expect(result).toEqual({ letter: 'F', acc: '', octave: 4 });
  });

  it('M7 below Eb5 = Fb4 (single accidental)', () => {
    const result = transposeDown({ letter: 'E', acc: 'b', octave: 5 }, intervalById('M7'));
    expect(result).toEqual({ letter: 'F', acc: 'b', octave: 4 });
  });

  it('A4 above C#4 = F##4 (double sharp — the genuine pool-filter exclusion case)', () => {
    const result = transposeUp({ letter: 'C', acc: '#', octave: 4 }, intervalById('A4'));
    expect(result).toEqual({ letter: 'F', acc: '##', octave: 4 });
  });

  it('P8 above C4 = C5 (octave carry)', () => {
    const result = transposeUp({ letter: 'C', acc: '', octave: 4 }, intervalById('P8'));
    expect(result).toEqual({ letter: 'C', acc: '', octave: 5 });
  });

  it('m2 below C4 = B3 (octave carry downward)', () => {
    const result = transposeDown({ letter: 'C', acc: '', octave: 4 }, intervalById('m2'));
    expect(result).toEqual({ letter: 'B', acc: '', octave: 3 });
  });

  it('m2 above B#3 = C#4 (single sharp, not a double — verified against raw MIDI arithmetic)', () => {
    const result = transposeUp({ letter: 'B', acc: '#', octave: 3 }, intervalById('m2'));
    expect(result).toEqual({ letter: 'C', acc: '#', octave: 4 });
  });

  it('semitone distance always matches the interval, across every interval in the table', () => {
    const root: SpelledPitch = { letter: 'D', acc: '', octave: 4 };
    for (const interval of [
      'P1',
      'm2',
      'M2',
      'm3',
      'M3',
      'P4',
      'A4',
      'd5',
      'P5',
      'm6',
      'M6',
      'm7',
      'M7',
      'P8',
    ] as const) {
      const iv = intervalById(interval);
      expect(spelledToMidi(transposeUp(root, iv)) - spelledToMidi(root)).toBe(iv.semitones);
      expect(spelledToMidi(root) - spelledToMidi(transposeDown(root, iv))).toBe(iv.semitones);
    }
  });

  it('throws for an interval id that does not exist', () => {
    expect(() => intervalById('bogus')).toThrow();
  });
});

describe('spellingsEqual', () => {
  it('is true only for identical letter+accidental+octave', () => {
    const a: SpelledPitch = { letter: 'F', acc: '#', octave: 4 };
    expect(spellingsEqual(a, { letter: 'F', acc: '#', octave: 4 })).toBe(true);
    expect(spellingsEqual(a, { letter: 'G', acc: 'b', octave: 4 })).toBe(false); // enharmonic, not equal
    expect(spellingsEqual(a, { letter: 'F', acc: '#', octave: 5 })).toBe(false);
  });
});

describe('spellingLabel', () => {
  it('renders unicode accidental glyphs', () => {
    expect(spellingLabel({ letter: 'F', acc: '#', octave: 4 })).toBe('F♯');
    expect(spellingLabel({ letter: 'B', acc: 'b', octave: 4 })).toBe('B♭');
    expect(spellingLabel({ letter: 'C', acc: '', octave: 4 })).toBe('C');
    expect(spellingLabel({ letter: 'F', acc: '##', octave: 4 })).toBe('F𝄪');
    expect(spellingLabel({ letter: 'B', acc: 'bb', octave: 4 })).toBe('B𝄫');
  });
});

describe('parseSpelling', () => {
  it('round-trips through spelledToMidi', () => {
    expect(parseSpelling('F#4')).toEqual({ letter: 'F', acc: '#', octave: 4 });
    expect(parseSpelling('Bb3')).toEqual({ letter: 'B', acc: 'b', octave: 3 });
    expect(parseSpelling('C4')).toEqual({ letter: 'C', acc: '', octave: 4 });
    expect(spelledToMidi(parseSpelling('F#4'))).toBe(66);
  });

  it('throws on an unparsable spec', () => {
    expect(() => parseSpelling('H4')).toThrow();
  });
});

describe('fromNoteSpelling', () => {
  it('maps NoteSpelling shape (absent accidental = natural)', () => {
    expect(fromNoteSpelling('F', '#', 4)).toEqual({ letter: 'F', acc: '#', octave: 4 });
    expect(fromNoteSpelling('C', undefined, 4)).toEqual({ letter: 'C', acc: '', octave: 4 });
  });
});
