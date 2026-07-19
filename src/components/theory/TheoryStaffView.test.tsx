import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TheoryStaffView } from './TheoryStaffView';
import type { SpelledPitch } from '../../lib/written-theory/spelledPitch';

function notes(...specs: [string, SpelledPitch['acc'], number][]): SpelledPitch[] {
  return specs.map(([letter, acc, octave]) => ({ letter, acc, octave }));
}

describe('TheoryStaffView', () => {
  it('renders one notehead per note, no time signature, no internal barline', () => {
    const { container } = render(
      <TheoryStaffView clef="treble" notes={notes(['C', '', 4], ['D', '', 4], ['E', '', 4])} />,
    );
    const svg = container.querySelector('svg')!;
    expect(svg).not.toBeNull();
    expect(svg.querySelectorAll('.vf-stavenote')).toHaveLength(3);
    // A single measure never gets an internal barline — VexFlow only draws
    // begin/end lines for one Stave, which addTimeSignature suppression
    // doesn't affect; the absence of any StaveBarline in the middle is
    // implicit in there being exactly one Stave rendered.
    expect(svg.querySelectorAll('.vf-stave')).toHaveLength(1);
  });

  it('renders no accidental glyphs in the key signature when vexKeySpec is omitted (empty C/Am signature)', () => {
    const { container } = render(<TheoryStaffView clef="treble" notes={notes(['C', '', 4])} />);
    const svg = container.querySelector('svg')!;
    expect(svg.querySelector('.vf-keysignature')).not.toBeNull();
    expect(svg.querySelectorAll('.vf-keysignature text').length).toBe(0);
  });

  it('renders 6 accidental glyphs in the key signature for F# major (6 sharps)', () => {
    const { container } = render(<TheoryStaffView clef="treble" vexKeySpec="F#" notes={notes(['C', '', 4])} />);
    const svg = container.querySelector('svg')!;
    expect(svg.querySelectorAll('.vf-keysignature text').length).toBe(6);
  });

  it('renders an explicit accidental glyph for a spelled sharp note on an open staff', () => {
    const sharpSvg = render(<TheoryStaffView clef="treble" notes={notes(['F', '#', 4])} />).container.querySelector(
      'svg',
    )!;
    const naturalSvg = render(<TheoryStaffView clef="treble" notes={notes(['F', '', 4])} />).container.querySelector(
      'svg',
    )!;
    // A sharped notehead group carries an extra <text> for the accidental
    // glyph alongside the notehead's own — VexFlow doesn't give the
    // accidental its own CSS class, so counting is the only signal.
    expect(sharpSvg.querySelectorAll('.vf-notehead text').length).toBeGreaterThan(
      naturalSvg.querySelectorAll('.vf-notehead text').length,
    );
  });

  it('suppresses the redundant accidental when the key signature already implies it', () => {
    // F# under an F# major signature needs no glyph — the signature already
    // says every F is sharp (engine §10's courtesy-accidental rule).
    const { container } = render(<TheoryStaffView clef="treble" vexKeySpec="F#" notes={notes(['F', '#', 4])} />);
    const svg = container.querySelector('svg')!;
    expect(svg.querySelectorAll('.vf-notehead text').length).toBe(1);
  });

  it('renders each of the four clefs without throwing', () => {
    (['treble', 'bass', 'alto', 'tenor'] as const).forEach((clef) => {
      expect(() => render(<TheoryStaffView clef={clef} notes={notes(['C', '', 4])} />)).not.toThrow();
    });
  });

  it('throws for a double-accidental spelling (pool-filter guarantee, defensive)', () => {
    expect(() => render(<TheoryStaffView clef="treble" notes={notes(['F', '##', 4])} />)).toThrow();
  });
});
