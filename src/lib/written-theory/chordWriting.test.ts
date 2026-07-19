import { describe, expect, it } from 'vitest';
import { setRng } from '../theory';
import { spellingLabel } from './spelledPitch';
import {
  buildChordWritingQuestion,
  chordWritingPromptText,
  defaultChordWritingSettings,
  gradeChordAnswer,
  type ChordWritingSettings,
} from './chordWriting';

function labels(q: ReturnType<typeof buildChordWritingQuestion>): string {
  return q!.expected.map((n) => spellingLabel(n)).join(' ');
}

describe('buildChordWritingQuestion', () => {
  it('returns null when no legal (quality, inversion) pair or no clef is enabled', () => {
    expect(buildChordWritingQuestion({ ...defaultChordWritingSettings(), qualities: [] })).toBeNull();
    expect(buildChordWritingQuestion({ ...defaultChordWritingSettings(), clefs: [] })).toBeNull();
  });

  it('3rd inversion is never generated for triads-only settings (illegal for a 3-tone chord)', () => {
    const settings: ChordWritingSettings = {
      ...defaultChordWritingSettings(),
      qualities: ['maj', 'min', 'dim', 'aug'],
      inversions: [0, 1, 2, 3],
    };
    for (let i = 0; i < 300; i++) {
      const q = buildChordWritingQuestion(settings)!;
      expect(q.inversion).toBeLessThan(q.quality.intervals.length + 1);
    }
  });

  it('hand-checked cases (docs §5)', () => {
    // F# minor, 1st inversion.
    let settings: ChordWritingSettings = { ...defaultChordWritingSettings(), qualities: ['min'], inversions: [1] };
    let found = false;
    for (let i = 0; i < 500 && !found; i++) {
      const q = buildChordWritingQuestion(settings)!;
      if (`${q.root.letter}${q.root.acc}` === 'F#') {
        expect(labels(q)).toBe('A C♯ F♯');
        found = true;
      }
    }
    expect(found).toBe(true);

    // Ab major, root position.
    settings = { ...defaultChordWritingSettings(), qualities: ['maj'], inversions: [0] };
    found = false;
    for (let i = 0; i < 500 && !found; i++) {
      const q = buildChordWritingQuestion(settings)!;
      if (`${q.root.letter}${q.root.acc}` === 'Ab') {
        expect(labels(q)).toBe('A♭ C E♭');
        found = true;
      }
    }
    expect(found).toBe(true);

    // C# half-diminished 7th, root position.
    settings = { ...defaultChordWritingSettings(), qualities: ['halfDim7'], inversions: [0] };
    found = false;
    for (let i = 0; i < 500 && !found; i++) {
      const q = buildChordWritingQuestion(settings)!;
      if (`${q.root.letter}${q.root.acc}` === 'C#') {
        expect(labels(q)).toBe('C♯ E G B');
        found = true;
      }
    }
    expect(found).toBe(true);
  });

  it('pool filter excludes double-accidental chords (e.g. D# major)', () => {
    const settings: ChordWritingSettings = { ...defaultChordWritingSettings(), qualities: ['maj'], inversions: [0] };
    for (let i = 0; i < 500; i++) {
      const q = buildChordWritingQuestion(settings)!;
      expect(`${q.root.letter}${q.root.acc}`).not.toBe('D#');
      q.expected.forEach((n) => {
        expect(n.acc).not.toBe('##');
        expect(n.acc).not.toBe('bb');
      });
    }
  });

  it('is deterministic under a seeded rng', () => {
    setRng(() => 0);
    const a = buildChordWritingQuestion(defaultChordWritingSettings());
    setRng(() => 0);
    const b = buildChordWritingQuestion(defaultChordWritingSettings());
    expect(a).toEqual(b);
    setRng();
  });
});

describe('chordWritingPromptText', () => {
  it('states root, quality, and inversion in full words', () => {
    const settings: ChordWritingSettings = { ...defaultChordWritingSettings(), qualities: ['min'], inversions: [1] };
    let q = buildChordWritingQuestion(settings)!;
    for (let i = 0; i < 500 && `${q.root.letter}${q.root.acc}` !== 'F#'; i++) q = buildChordWritingQuestion(settings)!;
    expect(chordWritingPromptText(q)).toBe('Write F♯ Minor triad, first inversion.');
  });
});

describe('gradeChordAnswer', () => {
  const expected = [
    { letter: 'A', acc: '' as const, octave: 4 },
    { letter: 'C', acc: '#' as const, octave: 5 },
    { letter: 'F', acc: '#' as const, octave: 5 },
  ];

  it('an octave-shifted correct stack passes', () => {
    const userStack = expected.map((n) => ({ ...n, octave: n.octave - 1 }));
    const result = gradeChordAnswer(userStack, expected);
    expect(result.correct).toBe(true);
    expect(result.correctToneCount).toBe(3);
  });

  it('right pitch classes in open (non-closed) spacing fails with closedPositionRequired', () => {
    // Same pitch classes, but the middle tone is an octave too high (open spacing).
    const userStack = [
      { letter: 'A', acc: '' as const, octave: 4 },
      { letter: 'C', acc: '#' as const, octave: 6 },
      { letter: 'F', acc: '#' as const, octave: 5 },
    ];
    const result = gradeChordAnswer(userStack, expected);
    expect(result.correct).toBe(false);
    expect(result.closedPositionRequired).toBe(true);
  });

  it('an enharmonic tone fails outright (not a spacing issue)', () => {
    const userStack = [
      { letter: 'A', acc: '' as const, octave: 4 },
      { letter: 'D', acc: 'b' as const, octave: 5 }, // enharmonic to C#, wrong letter
      { letter: 'F', acc: '#' as const, octave: 5 },
    ];
    const result = gradeChordAnswer(userStack, expected);
    expect(result.correct).toBe(false);
    expect(result.closedPositionRequired).toBe(false);
    expect(result.correctToneCount).toBe(2);
  });

  it('wrong tone count fails immediately', () => {
    const result = gradeChordAnswer(expected.slice(0, 2), expected);
    expect(result.correct).toBe(false);
    expect(result.total).toBe(3);
  });
});
