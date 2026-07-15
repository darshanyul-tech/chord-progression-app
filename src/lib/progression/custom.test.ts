import { describe, expect, it } from 'vitest';
import {
  buildProgressionFromGuesses,
  chordFromGuessRow,
  makePlaceholderChord,
  makePlaceholderProgression,
  type GuessRowInput,
} from './custom';
import { defaultProgressionSettings, resolvePracticeSettings } from './settings';

function settings(overrides: Partial<ReturnType<typeof defaultProgressionSettings>> = {}) {
  return resolvePracticeSettings({ ...defaultProgressionSettings(), ...overrides });
}

// docs/09-improvement-plan.md §15.3-adjacent — custom.ts had ~0% coverage.
// Also regression-guards the fixed `sc` ReferenceError noted in the file's
// own header comment (makePlaceholderChord used to throw immediately).
describe('makePlaceholderChord / makePlaceholderProgression', () => {
  it('builds a tonic placeholder chord without throwing', () => {
    const s = settings();
    const chord = makePlaceholderChord(s);
    expect(chord.fn).toBe('tonic');
    expect(chord.rootPc).toBe(s.keyPc);
    expect(chord.roman).toBe(s.scale.tonicRoman);
  });

  it('repeats the placeholder chord once per bar', () => {
    const s = settings({ bars: 3 });
    const prog = makePlaceholderProgression(s);
    expect(prog).toHaveLength(3);
    prog.forEach((c) => expect(c.fn).toBe('tonic'));
  });
});

describe('chordFromGuessRow', () => {
  it('returns null for an undefined row (bar not yet filled in)', () => {
    expect(chordFromGuessRow(undefined, settings())).toBeNull();
  });

  it('builds a chord from a filled-in guess row', () => {
    const row: GuessRowInput = { off: 7, fam: 'maj', ext: 3, inv: null, romanLabel: 'V' };
    const chord = chordFromGuessRow(row, settings());
    expect(chord).not.toBeNull();
    expect(chord!.roman).toBe('V');
    expect(chord!.rootPc).toBe(7);
  });

  it('applies the inversion only when settings.inversions is on', () => {
    const row: GuessRowInput = { off: 0, fam: 'maj', ext: 3, inv: 2, romanLabel: 'I' };
    expect(chordFromGuessRow(row, settings({ inversions: false }))!.inversion).toBe(0);
    expect(chordFromGuessRow(row, settings({ inversions: true }))!.inversion).toBe(2);
  });
});

describe('buildProgressionFromGuesses', () => {
  it('fails with a message when any bar is missing a guess', () => {
    const s = settings({ bars: 2 });
    const rows: (GuessRowInput | undefined)[] = [{ off: 0, fam: 'maj', ext: 3, inv: null, romanLabel: 'I' }, undefined];
    const result = buildProgressionFromGuesses(rows, s);
    expect(result.ok).toBe(false);
    expect(result.message).toBeTruthy();
    expect(result.prog).toBeUndefined();
  });

  it('succeeds when every bar has a guess', () => {
    const s = settings({ bars: 2 });
    const rows: (GuessRowInput | undefined)[] = [
      { off: 0, fam: 'maj', ext: 3, inv: null, romanLabel: 'I' },
      { off: 7, fam: 'maj', ext: 3, inv: null, romanLabel: 'V' },
    ];
    const result = buildProgressionFromGuesses(rows, s);
    expect(result.ok).toBe(true);
    expect(result.prog).toHaveLength(2);
  });
});
