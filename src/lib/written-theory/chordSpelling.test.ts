import { describe, expect, it } from 'vitest';
import { spelledToMidi, spellingLabel, type SpelledPitch } from './spelledPitch';
import { chordNeedsDoubleAccidentals, chordQualityById, spellChord, WRITTEN_CHORD_QUALITIES } from './chordSpelling';

function labels(notes: SpelledPitch[]): string {
  return notes.map((n) => `${spellingLabel(n)}${n.octave}`).join(' ');
}

describe('spellChord — hand-checked cases (docs/15-theory-topics/07 §5)', () => {
  it('F# minor, 1st inversion = A C# F#', () => {
    const notes = spellChord({ letter: 'F', acc: '#', octave: 4 }, chordQualityById('min'), 1);
    expect(notes.map((n) => n.letter + n.acc)).toEqual(['A', 'C#', 'F#']);
  });

  it('Ab major, root position = Ab C Eb', () => {
    const notes = spellChord({ letter: 'A', acc: 'b', octave: 4 }, chordQualityById('maj'), 0);
    expect(notes.map((n) => n.letter + n.acc)).toEqual(['Ab', 'C', 'Eb']);
  });

  it('B diminished = B D F', () => {
    const notes = spellChord({ letter: 'B', acc: '', octave: 4 }, chordQualityById('dim'), 0);
    expect(notes.map((n) => n.letter + n.acc)).toEqual(['B', 'D', 'F']);
  });

  it('C augmented = C E G#', () => {
    const notes = spellChord({ letter: 'C', acc: '', octave: 4 }, chordQualityById('aug'), 0);
    expect(notes.map((n) => n.letter + n.acc)).toEqual(['C', 'E', 'G#']);
  });

  it('G dominant 7th, 2nd inversion = D F G B (closed position, ascending)', () => {
    const notes = spellChord({ letter: 'G', acc: '', octave: 4 }, chordQualityById('dom7'), 2);
    expect(labels(notes)).toBe('D5 F5 G5 B5');
  });

  it('C# half-diminished 7th, root position = C# E G B', () => {
    const notes = spellChord({ letter: 'C', acc: '#', octave: 4 }, chordQualityById('halfDim7'), 0);
    expect(notes.map((n) => n.letter + n.acc)).toEqual(['C#', 'E', 'G', 'B']);
  });

  it('inversions stay strictly ascending (by real pitch) for every quality and root position', () => {
    const root: SpelledPitch = { letter: 'D', acc: '', octave: 4 };
    for (const q of WRITTEN_CHORD_QUALITIES) {
      for (let inv = 0; inv < q.intervals.length + 1; inv++) {
        const stack = spellChord(root, q, inv);
        expect(stack).toHaveLength(q.intervals.length + 1);
        for (let i = 1; i < stack.length; i++) {
          expect(spelledToMidi(stack[i]!)).toBeGreaterThan(spelledToMidi(stack[i - 1]!));
        }
      }
    }
  });

  it('throws for an inversion out of range', () => {
    expect(() => spellChord({ letter: 'C', acc: '', octave: 4 }, chordQualityById('maj'), 3)).toThrow();
    expect(() => spellChord({ letter: 'C', acc: '', octave: 4 }, chordQualityById('maj'), -1)).toThrow();
  });
});

describe('chordNeedsDoubleAccidentals — pool filter', () => {
  it('excludes D# major triad (needs F##)', () => {
    expect(chordNeedsDoubleAccidentals({ letter: 'D', acc: '#', octave: 4 }, chordQualityById('maj'))).toBe(true);
  });

  it('includes Eb minor and F# major triads (single accidentals only)', () => {
    expect(chordNeedsDoubleAccidentals({ letter: 'E', acc: 'b', octave: 4 }, chordQualityById('min'))).toBe(false);
    expect(chordNeedsDoubleAccidentals({ letter: 'F', acc: '#', octave: 4 }, chordQualityById('maj'))).toBe(false);
  });
});

describe('chordQualityById', () => {
  it('has 4 triads and 5 sevenths', () => {
    expect(WRITTEN_CHORD_QUALITIES.filter((q) => q.intervals.length === 2)).toHaveLength(4);
    expect(WRITTEN_CHORD_QUALITIES.filter((q) => q.intervals.length === 3)).toHaveLength(5);
  });

  it('throws for an unknown id', () => {
    expect(() => chordQualityById('bogus')).toThrow();
  });
});
