import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SlotStaffInput } from './SlotStaffInput';
import { theoryKeyById } from '../../lib/written-theory/keys';
import type { SpelledPitch } from '../../lib/written-theory/spelledPitch';

describe('SlotStaffInput', () => {
  it('renders one notehead per slot: muted placeholders for empty, normal for filled', () => {
    const slots: (SpelledPitch | null)[] = [{ letter: 'C', acc: '', octave: 4 }, null, null];
    const { container } = render(
      <SlotStaffInput clef="treble" slots={slots} armedAccidental="" disabled={false} onPlace={vi.fn()} />,
    );
    const svg = container.querySelector('svg')!;
    expect(svg.querySelectorAll('.vf-stavenote')).toHaveLength(3);
  });

  it('renders without a key signature when vexKeySpec is omitted', () => {
    const { container } = render(
      <SlotStaffInput clef="treble" slots={[null]} armedAccidental="" disabled={false} onPlace={vi.fn()} />,
    );
    const svg = container.querySelector('svg')!;
    expect(svg.querySelectorAll('.vf-keysignature text').length).toBe(0);
  });

  it('renders a key signature when vexKeySpec is given', () => {
    const { container } = render(
      <SlotStaffInput clef="treble" vexKeySpec="D" slots={[null]} armedAccidental="" disabled={false} onPlace={vi.fn()} />,
    );
    const svg = container.querySelector('svg')!;
    expect(svg.querySelectorAll('.vf-keysignature text').length).toBe(2);
  });

  it('renders across all four clefs and various slot counts without throwing', () => {
    (['treble', 'bass', 'alto', 'tenor'] as const).forEach((clef) => {
      [1, 2, 7, 8].forEach((count) => {
        const slots: (SpelledPitch | null)[] = Array.from({ length: count }, () => null);
        expect(() =>
          render(<SlotStaffInput clef={clef} slots={slots} armedAccidental="" disabled={false} onPlace={vi.fn()} />),
        ).not.toThrow();
      });
    });
  });

  it('throws for a double-accidental filled slot (pool-filter guarantee, defensive)', () => {
    const slots: (SpelledPitch | null)[] = [{ letter: 'F', acc: '##', octave: 4 }];
    expect(() =>
      render(<SlotStaffInput clef="treble" slots={slots} armedAccidental="" disabled={false} onPlace={vi.fn()} />),
    ).toThrow();
  });

  it('accepts a signatureKey without throwing (Transposition\'s keyed-staff mode)', () => {
    const slots: (SpelledPitch | null)[] = [null, null];
    expect(() =>
      render(
        <SlotStaffInput
          clef="treble"
          vexKeySpec="D"
          signatureKey={theoryKeyById('D')}
          slots={slots}
          armedAccidental=""
          disabled={false}
          onPlace={vi.fn()}
        />,
      ),
    ).not.toThrow();
  });

  it('applies slotColors to filled slots (post-grading recolor)', () => {
    const slots: (SpelledPitch | null)[] = [{ letter: 'C', acc: '', octave: 4 }];
    expect(() =>
      render(
        <SlotStaffInput
          clef="treble"
          slots={slots}
          slotColors={['#b3261e']}
          armedAccidental=""
          disabled={true}
          onPlace={vi.fn()}
        />,
      ),
    ).not.toThrow();
  });
});
