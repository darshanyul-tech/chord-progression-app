import { describe, expect, it } from 'vitest';
import { spellingLabel, type SpelledPitch } from './spelledPitch';
import {
  scaleNeedsDoubleAccidentals,
  spellWrittenScale,
  WRITTEN_SCALE_TYPES,
  writtenScaleTypeById,
} from './scaleSpelling';

function labels(notes: SpelledPitch[]): string {
  return notes.map((n) => `${spellingLabel(n)}${n.octave}`).join(' ');
}

describe('spellWrittenScale — hand-checked cases (docs/15-theory-topics/06 §5)', () => {
  it('Bb major = Bb4 C5 D5 Eb5 F5 G5 A5 Bb5', () => {
    const notes = spellWrittenScale({ letter: 'B', acc: 'b', octave: 4 }, writtenScaleTypeById('major'));
    expect(labels(notes)).toBe('B♭4 C5 D5 E♭5 F5 G5 A5 B♭5');
  });

  it('C# natural minor = C# D# E F# G# A B C#', () => {
    const notes = spellWrittenScale({ letter: 'C', acc: '#', octave: 4 }, writtenScaleTypeById('naturalMinor'));
    expect(notes.map((n) => n.letter + n.acc)).toEqual(['C#', 'D#', 'E', 'F#', 'G#', 'A', 'B', 'C#']);
  });

  it('D harmonic minor = D E F G A Bb C# D', () => {
    const notes = spellWrittenScale({ letter: 'D', acc: '', octave: 4 }, writtenScaleTypeById('harmonicMinor'));
    expect(notes.map((n) => n.letter + n.acc)).toEqual(['D', 'E', 'F', 'G', 'A', 'Bb', 'C#', 'D']);
  });

  it('F melodic minor ascending = F G Ab Bb C D E F', () => {
    const notes = spellWrittenScale({ letter: 'F', acc: '', octave: 4 }, writtenScaleTypeById('melodicMinor'));
    expect(notes.map((n) => n.letter + n.acc)).toEqual(['F', 'G', 'Ab', 'Bb', 'C', 'D', 'E', 'F']);
  });

  it('E Lydian = E4 F#4 G#4 A#4 B4 C#5 D#5 E5', () => {
    const notes = spellWrittenScale({ letter: 'E', acc: '', octave: 4 }, writtenScaleTypeById('lydian'));
    expect(labels(notes)).toBe('E4 F♯4 G♯4 A♯4 B4 C♯5 D♯5 E5');
  });

  it('every scale type spells 8 notes using each letter exactly once (the octave tonic repeats the first)', () => {
    const tonic: SpelledPitch = { letter: 'D', acc: '', octave: 4 };
    for (const type of WRITTEN_SCALE_TYPES) {
      const notes = spellWrittenScale(tonic, type);
      expect(notes).toHaveLength(8);
      expect(notes[0]!.letter).toBe(notes[7]!.letter);
      expect(new Set(notes.slice(0, 7).map((n) => n.letter)).size).toBe(7);
    }
  });
});

describe('scaleNeedsDoubleAccidentals — pool filter', () => {
  it('excludes G# harmonic minor (needs F##)', () => {
    expect(scaleNeedsDoubleAccidentals({ letter: 'G', acc: '#', octave: 4 }, writtenScaleTypeById('harmonicMinor'))).toBe(
      true,
    );
  });

  it('excludes D# major (needs F## and C##)', () => {
    expect(scaleNeedsDoubleAccidentals({ letter: 'D', acc: '#', octave: 4 }, writtenScaleTypeById('major'))).toBe(true);
  });

  it('includes Ab major (single accidentals only)', () => {
    expect(scaleNeedsDoubleAccidentals({ letter: 'A', acc: 'b', octave: 4 }, writtenScaleTypeById('major'))).toBe(false);
  });

  it('includes C# major (single sharps only, despite 7 accidentals)', () => {
    expect(scaleNeedsDoubleAccidentals({ letter: 'C', acc: '#', octave: 4 }, writtenScaleTypeById('major'))).toBe(false);
  });
});

describe('writtenScaleTypeById', () => {
  it('throws for an unknown id', () => {
    expect(() => writtenScaleTypeById('bogus')).toThrow();
  });

  it('ids match lib/recognition/scales.ts for the shared major-mode names', () => {
    const ids = WRITTEN_SCALE_TYPES.map((t) => t.id);
    for (const id of ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian']) {
      expect(ids).toContain(id);
    }
  });
});
