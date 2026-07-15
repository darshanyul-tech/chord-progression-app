import { afterEach, describe, expect, it } from 'vitest';
import { setRng } from '../theory';
import {
  applyVoiceLeading,
  buildVoicing,
  chordBassName,
  chordDisplay,
  extensionRevealLabel,
  familyLabel,
  inversionLabel,
  pickByVoiceLeading,
  pitchClassSteps,
  smoothVoiceLeading,
  voicingMidis,
  type HarmonySettings,
  type ProgChord,
} from './theory';

describe('buildVoicing', () => {
  it('produces a triad-or-larger voicing within a sane register', () => {
    for (const quality of ['maj7', 'm7', '7', 'dim7', 'maj9', '13']) {
      const v = buildVoicing(0, quality, { inversion: 0 });
      expect(v.chord.length).toBeGreaterThanOrEqual(3);
      v.chord.forEach((note) => {
        expect(note).toMatch(/^[A-G]b?\d$/);
      });
    }
  });

  it('rootless voicing drops the root into an independent bass voice, one octave down', () => {
    const full = buildVoicing(0, 'maj7', { inversion: 0 });
    const rootless = buildVoicing(0, 'maj7', { inversion: 0, rootless: true });
    expect(rootless.chord).toHaveLength(full.chord.length - 1);
    expect(rootless.bass).not.toBeNull();
    expect(rootless.bassNote).toBe(rootless.bass);
  });

  it('non-rootless voicing has no independent bass', () => {
    const v = buildVoicing(0, 'maj7', { inversion: 0 });
    expect(v.bass).toBeNull();
  });

  it('applying inversions keeps the same pitch-class set', () => {
    const root = buildVoicing(0, 'maj7', { inversion: 0 });
    const firstInv = buildVoicing(0, 'maj7', { inversion: 1 });
    const pcSet = (notes: string[]) => new Set(notes.map((n) => n.replace(/-?\d+$/, '')));
    expect(pcSet(firstInv.chord)).toEqual(pcSet(root.chord));
  });
});

describe('pitchClassSteps', () => {
  it('is the shorter distance around the pitch-class circle', () => {
    expect(pitchClassSteps(0, 1)).toBe(1);
    expect(pitchClassSteps(0, 11)).toBe(1); // wraps the other way
    expect(pitchClassSteps(0, 6)).toBe(6); // tritone is its own shortest path
  });
});

describe('pickByVoiceLeading', () => {
  afterEach(() => setRng());

  it('returns null for an empty candidate list', () => {
    expect(pickByVoiceLeading([], (c: number) => c, 0)).toBeNull();
  });

  it('picks uniformly (via pick()) when there is no previous root to lead from', () => {
    setRng(() => 0);
    expect(pickByVoiceLeading([5, 7, 9], (c) => c, null)).toBe(5);
  });

  it('weights candidates closer to the previous root more heavily', () => {
    setRng(() => 0); // lands on the first (highest-weight) candidate in the running-sum draw
    const closest = pickByVoiceLeading([1, 6], (c) => c, 0);
    expect(closest).toBe(1); // pc distance 1 beats pc distance 6 in weighting
  });
});

describe('voicingMidis', () => {
  it('sorts ascending and shifts the bottom note up an octave per inversion', () => {
    const root = voicingMidis(0, 'maj7', 0, 0);
    const firstInv = voicingMidis(0, 'maj7', 1, 0);
    expect(root).toEqual([...root].sort((a, b) => a - b));
    expect(firstInv[firstInv.length - 1]).toBe(root[0]! + 12);
  });

  it('registerShift transposes the whole voicing by an octave per shift unit', () => {
    const base = voicingMidis(0, 'maj7', 0, 0);
    const shifted = voicingMidis(0, 'maj7', 0, 1);
    expect(shifted).toEqual(base.map((m) => m + 12));
  });
});

describe('applyVoiceLeading / smoothVoiceLeading', () => {
  const s: HarmonySettings = {
    keyPc: 0,
    tonality: 'major',
    scale: { offsets: [0, 2, 4, 5, 7, 9, 11], quality: {}, roman: {}, tonicQuality: 'maj7', tonicRoman: 'I', chromatic: [] },
    minorVm7: false,
    minorV7: false,
    extensions: [7],
    inversions: true,
    rootless: false,
  };

  it('defaults to root position when there is no previous chord', () => {
    const ch: ProgChord = {
      degree: 1, fn: 'tonic', rootPc: 0, rootName: 'C', quality: 'maj7', rootDegree: 1,
      family: 'maj', ext: 7, symbol: 'Cmaj7', roman: 'I', inversion: 0, secondary: false,
    };
    applyVoiceLeading(ch, s, null);
    expect(ch.inversion).toBe(0);
    expect(ch.registerShift).toBe(0);
  });

  it('a chromatic chord picks a register shift (never an inversion) to minimize bass movement', () => {
    const ch: ProgChord = {
      degree: null, fn: 'dominant', rootPc: 6, rootName: 'Gb', quality: '7', rootDegree: null,
      family: 'dom', ext: 7, symbol: 'Gb7', roman: 'subV/V', inversion: 5, secondary: true, chromatic: true,
    };
    applyVoiceLeading(ch, s, 52); // an arbitrary previous bass midi
    expect(ch.inversion).toBe(0);
    expect(typeof ch.registerShift).toBe('number');
  });

  it('smoothVoiceLeading assigns an inversion/registerShift to every chord in sequence', () => {
    const prog: ProgChord[] = [
      { degree: 1, fn: 'tonic', rootPc: 0, rootName: 'C', quality: 'maj7', rootDegree: 1, family: 'maj', ext: 7, symbol: 'Cmaj7', roman: 'I', inversion: 0, secondary: false },
      { degree: 5, fn: 'dominant', rootPc: 7, rootName: 'G', quality: '7', rootDegree: 5, family: 'dom', ext: 7, symbol: 'G7', roman: 'V', inversion: 0, secondary: false },
    ];
    smoothVoiceLeading(prog, s);
    prog.forEach((ch) => {
      expect(typeof ch.inversion).toBe('number');
      expect(typeof ch.registerShift).toBe('number');
    });
  });
});

describe('inversionLabel', () => {
  it('names root position and ordinal inversions', () => {
    expect(inversionLabel(0)).toBe('Root position');
    expect(inversionLabel(1)).toBe('1st inv');
    expect(inversionLabel(2)).toBe('2nd inv');
  });

  it('falls back to an "Nth" ordinal beyond the named list', () => {
    expect(inversionLabel(6)).toBe('6th inv');
  });
});

describe('chordBassName / chordDisplay', () => {
  const chord: ProgChord = {
    degree: 1, fn: 'tonic', rootPc: 0, rootName: 'C', quality: 'maj7', rootDegree: 1,
    family: 'maj', ext: 7, symbol: 'Cmaj7', roman: 'I', inversion: 1, secondary: false,
  };

  it('chordBassName resolves the bass note for the given inversion', () => {
    expect(chordBassName(chord)).toBe('E'); // 1st inversion of Cmaj7 -> E in bass
  });

  it('chordDisplay appends "/bass" only when inverted', () => {
    expect(chordDisplay(chord)).toBe('Cmaj7/E');
    expect(chordDisplay({ ...chord, inversion: 0 })).toBe('Cmaj7');
  });
});

describe('familyLabel / extensionRevealLabel', () => {
  it('familyLabel maps known families and falls back to the raw string', () => {
    expect(familyLabel('halfdim')).toBe('Half-diminished');
    expect(familyLabel('unknown')).toBe('unknown');
  });

  it('extensionRevealLabel special-cases triad/7th and falls back to "Nth"', () => {
    expect(extensionRevealLabel(3)).toBe('Triad');
    expect(extensionRevealLabel(7)).toBe('7th');
    expect(extensionRevealLabel(9)).toBe('9th');
  });
});
