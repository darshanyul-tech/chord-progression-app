import { describe, expect, it } from 'vitest';
import { setRng } from '../theory';
import { theoryKeyById } from './keys';
import { spellingLabel } from './spelledPitch';
import {
  buildTranspositionQuestion,
  defaultTranspositionSettings,
  transpositionPromptText,
  type TranspositionSettings,
} from './transposition';

describe('buildTranspositionQuestion', () => {
  it('returns null when by-interval-only mode has no interval enabled', () => {
    expect(buildTranspositionQuestion({ ...defaultTranspositionSettings(), mode: 'byInterval', intervals: [] })).toBeNull();
  });

  it('source spelling: every note is a diatonic letter+acc pair, matching the source key scale', () => {
    for (let i = 0; i < 100; i++) {
      const q = buildTranspositionQuestion(defaultTranspositionSettings())!;
      const sourceKey = theoryKeyById(q.sourceKeyId);
      const scaleLetters = new Set(scaleLetterAccPairs(sourceKey));
      q.sourceSpelled.forEach((n) => {
        if (!n) return;
        expect(scaleLetters.has(`${n.letter}${n.acc}`)).toBe(true);
      });
    }
  });

  it('to-key mode: source and target keys are always different', () => {
    const settings: TranspositionSettings = { ...defaultTranspositionSettings(), mode: 'toKey' };
    for (let i = 0; i < 300; i++) {
      const q = buildTranspositionQuestion(settings)!;
      expect(q.mode).toBe('toKey');
      expect(q.targetKeyId).not.toBe(q.sourceKeyId);
      expect(theoryKeyById(q.targetKeyId).accidentalCount).toBeLessThanOrEqual(5);
    }
  });

  it('to-key mode: C -> F picks the smaller-magnitude candidate (P4 up, 5 semitones) over P5 down (7 semitones) when both fit', () => {
    const settings: TranspositionSettings = { ...defaultTranspositionSettings(), mode: 'toKey' };
    let found = false;
    for (let i = 0; i < 500 && !found; i++) {
      const q = buildTranspositionQuestion(settings)!;
      if (q.sourceKeyId === 'C' && q.targetKeyId === 'F') {
        expect(q.interval.id).toBe('P4');
        expect(q.direction).toBe('up');
        found = true;
      }
    }
    expect(found).toBe(true);
  });

  it('by-interval mode: up M2 from F major lands in G major with correct spellings (Bb -> C etc.)', () => {
    const settings: TranspositionSettings = { ...defaultTranspositionSettings(), mode: 'byInterval', intervals: ['M2'] };
    let found = false;
    for (let i = 0; i < 500 && !found; i++) {
      const q = buildTranspositionQuestion(settings)!;
      if (q.sourceKeyId === 'F' && q.direction === 'up') {
        expect(q.targetKeyId).toBe('G');
        const bIndex = q.sourceSpelled.findIndex((n) => n && n.letter === 'B' && n.acc === 'b');
        if (bIndex >= 0) {
          expect(spellingLabel(q.expected[bIndex]!)).toBe('C');
        }
        found = true;
      }
    }
    expect(found).toBe(true);
  });

  it('by-interval mode: target keys are always in the table, direction-fitting respected over 500 draws', () => {
    const settings: TranspositionSettings = { ...defaultTranspositionSettings(), mode: 'byInterval' };
    for (let i = 0; i < 500; i++) {
      const q = buildTranspositionQuestion(settings)!;
      expect(() => theoryKeyById(q.targetKeyId)).not.toThrow();
      q.expected.forEach((n) => {
        if (!n) return;
        expect(n.acc).not.toBe('##');
        expect(n.acc).not.toBe('bb');
      });
    }
  });

  it('semitone phrasing: prompt says semitones, expected spellings identical to interval-name phrasing', () => {
    const namesSettings: TranspositionSettings = {
      ...defaultTranspositionSettings(),
      mode: 'byInterval',
      intervals: ['M2'],
      phrasing: 'names',
    };
    const semitoneSettings: TranspositionSettings = { ...namesSettings, phrasing: 'semitones' };

    setRng(() => 0);
    const namesQ = buildTranspositionQuestion(namesSettings)!;
    setRng(() => 0);
    const semitoneQ = buildTranspositionQuestion(semitoneSettings)!;
    setRng();

    expect(transpositionPromptText(semitoneQ)).toContain('semitone');
    expect(transpositionPromptText(namesQ)).not.toContain('semitone');
    expect(semitoneQ.expected).toEqual(namesQ.expected);
  });

  it('is deterministic under a seeded rng', () => {
    setRng(() => 0);
    const a = buildTranspositionQuestion(defaultTranspositionSettings());
    setRng(() => 0);
    const b = buildTranspositionQuestion(defaultTranspositionSettings());
    expect(a).toEqual(b);
    setRng();
  });
});

// Local helper mirroring keys.ts's scaleSpelling, to independently verify
// source-spelling membership without importing the exact internal table.
function scaleLetterAccPairs(key: ReturnType<typeof theoryKeyById>): string[] {
  const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
  const NATURAL_MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10];
  const steps = key.mode === 'major' ? MAJOR_STEPS : NATURAL_MINOR_STEPS;
  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const NATURAL_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const tonicIdx = LETTERS.indexOf(key.tonic.letter);
  const tonicOffset = key.tonic.acc === '#' ? 1 : key.tonic.acc === 'b' ? -1 : 0;
  return steps.map((semitones, i) => {
    const letter = LETTERS[(tonicIdx + i) % 7]!;
    const targetPc = ((NATURAL_PC[key.tonic.letter]! + tonicOffset + semitones) % 12 + 12) % 12;
    const naturalPc = NATURAL_PC[letter]!;
    let offset = targetPc - naturalPc;
    if (offset > 6) offset -= 12;
    if (offset < -6) offset += 12;
    const acc = offset === 0 ? '' : offset === 1 ? '#' : offset === -1 ? 'b' : offset === 2 ? '##' : 'bb';
    return `${letter}${acc}`;
  });
}
