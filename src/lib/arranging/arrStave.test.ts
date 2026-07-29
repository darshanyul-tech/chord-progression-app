import { describe, expect, it } from 'vitest';
import { buildArrStave } from './arrStave';

describe('grand-stave note alignment', () => {
  it('lines up a bass note under a treble chord even when the treble has an accidental', () => {
    const container = document.createElement('div');
    const res = buildArrStave(container, {
      grand: true,
      tones: [
        { pitch: { letter: 'B', acc: 'b', octave: 4 } }, // treble, carries a flat
        { pitch: { letter: 'D', acc: '', octave: 5 } }, // treble, natural
        { pitch: { letter: 'E', acc: '', octave: 3 } }, // bass, natural (no accidental)
      ],
    });
    expect(res.trebleNoteX).not.toBeNull();
    expect(res.bassNoteX).not.toBeNull();
    // The accidental must not shove the treble noteheads sideways relative to the
    // bass note — they share a formatter tick, so the x's match.
    expect(Math.abs(res.trebleNoteX! - res.bassNoteX!)).toBeLessThanOrEqual(1);
  });

  it('single-stave (no grand) renders only a treble note', () => {
    const container = document.createElement('div');
    const res = buildArrStave(container, { grand: false, tones: [{ pitch: { letter: 'G', acc: '', octave: 4 } }] });
    expect(res.bass).toBeNull();
    expect(res.bassNoteX).toBeNull();
    expect(res.trebleNoteX).not.toBeNull();
  });
});
