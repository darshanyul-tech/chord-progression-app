import { describe, expect, it } from 'vitest';
import { buildChordStack, CHORD_WRONG_COLOR } from './chordStack';
import type { SpelledPitch } from './spelledPitch';

describe('buildChordStack', () => {
  it('renders a single muted placeholder for an empty column', () => {
    const container = document.createElement('div');
    const result = buildChordStack(container, { clef: 'treble', columns: [{ stack: [] }] });
    const svg = container.querySelector('svg')!;
    expect(svg.querySelectorAll('.vf-stavenote')).toHaveLength(1);
    expect(result.columnX).toHaveLength(1);
  });

  it('renders one StaveNote with multiple keys for a filled stack', () => {
    const container = document.createElement('div');
    const stack: SpelledPitch[] = [
      { letter: 'C', acc: '', octave: 4 },
      { letter: 'E', acc: '', octave: 4 },
      { letter: 'G', acc: '', octave: 4 },
    ];
    const { columnX } = buildChordStack(container, { clef: 'treble', columns: [{ stack }] });
    const svg = container.querySelector('svg')!;
    expect(svg.querySelectorAll('.vf-stavenote')).toHaveLength(1);
    expect(svg.querySelectorAll('.vf-notehead')).toHaveLength(3);
    expect(columnX).toHaveLength(1);
  });

  it('renders two columns (user stack + red reveal) without throwing', () => {
    const container = document.createElement('div');
    const userStack: SpelledPitch[] = [{ letter: 'C', acc: '', octave: 4 }];
    const expectedStack: SpelledPitch[] = [{ letter: 'A', acc: '', octave: 3 }, { letter: 'C', acc: '#', octave: 4 }, { letter: 'F', acc: '#', octave: 4 }];
    const { columnX } = buildChordStack(container, {
      clef: 'treble',
      columns: [{ stack: userStack }, { stack: expectedStack, color: CHORD_WRONG_COLOR }],
    });
    const svg = container.querySelector('svg')!;
    expect(svg.querySelectorAll('.vf-stavenote')).toHaveLength(2);
    expect(columnX).toHaveLength(2);
    expect(columnX[1]).toBeGreaterThan(columnX[0]!);
  });

  it('renders a key signature when vexKeySpec is given', () => {
    const container = document.createElement('div');
    buildChordStack(container, { clef: 'treble', vexKeySpec: 'F#', columns: [{ stack: [] }] });
    const svg = container.querySelector('svg')!;
    expect(svg.querySelectorAll('.vf-keysignature text').length).toBe(6);
  });

  it('throws for a double-accidental tone (pool-filter guarantee, defensive)', () => {
    const container = document.createElement('div');
    expect(() =>
      buildChordStack(container, { clef: 'treble', columns: [{ stack: [{ letter: 'F', acc: '##', octave: 4 }] }] }),
    ).toThrow();
  });
});
