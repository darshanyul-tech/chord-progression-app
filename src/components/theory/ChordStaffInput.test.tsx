import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChordStaffInput } from './ChordStaffInput';
import type { SpelledPitch } from '../../lib/written-theory/spelledPitch';

describe('ChordStaffInput', () => {
  it('renders a muted placeholder for an empty stack', () => {
    const { container } = render(
      <ChordStaffInput clef="treble" maxTones={3} stack={[]} armedAccidental="" disabled={false} onToggle={vi.fn()} />,
    );
    const svg = container.querySelector('svg')!;
    expect(svg.querySelectorAll('.vf-stavenote')).toHaveLength(1);
  });

  it('renders one multi-key StaveNote for a filled stack', () => {
    const stack: SpelledPitch[] = [
      { letter: 'C', acc: '', octave: 4 },
      { letter: 'E', acc: '', octave: 4 },
      { letter: 'G', acc: '', octave: 4 },
    ];
    const { container } = render(
      <ChordStaffInput clef="treble" maxTones={3} stack={stack} armedAccidental="" disabled={false} onToggle={vi.fn()} />,
    );
    const svg = container.querySelector('svg')!;
    expect(svg.querySelectorAll('.vf-stavenote')).toHaveLength(1);
    expect(svg.querySelectorAll('.vf-notehead')).toHaveLength(3);
  });

  it('renders a second red column when revealStack is set', () => {
    const stack: SpelledPitch[] = [{ letter: 'C', acc: '', octave: 4 }];
    const revealStack: SpelledPitch[] = [
      { letter: 'A', acc: '', octave: 3 },
      { letter: 'C', acc: '#', octave: 4 },
      { letter: 'F', acc: '#', octave: 4 },
    ];
    const { container } = render(
      <ChordStaffInput
        clef="treble"
        maxTones={3}
        stack={stack}
        revealStack={revealStack}
        armedAccidental=""
        disabled={true}
        onToggle={vi.fn()}
      />,
    );
    const svg = container.querySelector('svg')!;
    expect(svg.querySelectorAll('.vf-stavenote')).toHaveLength(2);
  });

  it('renders across all four clefs without throwing', () => {
    (['treble', 'bass', 'alto', 'tenor'] as const).forEach((clef) => {
      expect(() =>
        render(<ChordStaffInput clef={clef} maxTones={4} stack={[]} armedAccidental="" disabled={false} onToggle={vi.fn()} />),
      ).not.toThrow();
    });
  });

  it('throws for a double-accidental stack tone (pool-filter guarantee, defensive)', () => {
    const stack: SpelledPitch[] = [{ letter: 'F', acc: '##', octave: 4 }];
    expect(() =>
      render(<ChordStaffInput clef="treble" maxTones={3} stack={stack} armedAccidental="" disabled={false} onToggle={vi.fn()} />),
    ).toThrow();
  });
});
