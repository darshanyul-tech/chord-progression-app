import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KeySignatureView } from './KeySignatureView';

describe('KeySignatureView', () => {
  it('renders 6 accidental glyphs for F# major (6 sharps)', () => {
    const { container } = render(<KeySignatureView clef="treble" vexKeySpec="F#" />);
    const svg = container.querySelector('svg')!;
    expect(svg).not.toBeNull();
    expect(svg.querySelectorAll('.vf-keysignature text').length).toBe(6);
  });

  it('renders 3 accidental glyphs for Eb major (3 flats)', () => {
    const { container } = render(<KeySignatureView clef="bass" vexKeySpec="Eb" />);
    const svg = container.querySelector('svg')!;
    expect(svg).not.toBeNull();
    expect(svg.querySelectorAll('.vf-keysignature text').length).toBe(3);
  });

  it('renders the empty (0-accidental) C/Am signature without glitches', () => {
    const { container } = render(<KeySignatureView clef="treble" vexKeySpec="C" />);
    const svg = container.querySelector('svg')!;
    expect(svg).not.toBeNull();
    expect(svg.querySelector('.vf-keysignature')).not.toBeNull();
    expect(svg.querySelectorAll('.vf-keysignature text').length).toBe(0);
    expect(svg.querySelectorAll('.vf-stave').length).toBe(1);
  });

  it('renders every clef without throwing', () => {
    (['treble', 'bass', 'alto', 'tenor'] as const).forEach((clef) => {
      expect(() => render(<KeySignatureView clef={clef} vexKeySpec="D" />)).not.toThrow();
    });
  });
});
