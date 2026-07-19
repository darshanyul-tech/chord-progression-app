import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Measure } from '../../lib/rhythm/time';
import { SourceRhythmStaff } from './SourceRhythmStaff';

describe('SourceRhythmStaff', () => {
  it('renders the given rhythm read-only, without throwing', () => {
    const measures: Measure[] = [
      [
        { beat: 0, duration: 1, isRest: false },
        { beat: 1, duration: 0.5, isRest: false },
        { beat: 1.5, duration: 0.5, isRest: false },
        { beat: 2, duration: 1, isRest: false },
      ],
    ];
    const { container } = render(<SourceRhythmStaff beatsPerBar={6} beatValue={8} measures={measures} />);
    const svg = container.querySelector('svg')!;
    expect(svg.querySelectorAll('.vf-stavenote').length).toBe(4);
  });

  it('has no interactive affordances (role="img", not "application")', () => {
    const { container } = render(<SourceRhythmStaff beatsPerBar={2} beatValue={4} measures={[[]]} />);
    const root = container.firstElementChild!;
    expect(root.getAttribute('role')).toBe('img');
  });
});
