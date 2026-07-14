import { describe, expect, it } from 'vitest';
import { buildVoicing } from './theory';

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
