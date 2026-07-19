import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SourceStaff } from './SourceStaff';
import type { PitchedMeasure } from '../../lib/melody/theory';
import type { SpelledPitch } from '../../lib/written-theory/spelledPitch';

describe('SourceStaff', () => {
  it('renders the real rhythm (not forced to whole notes) without throwing', () => {
    const rhythmMeasures: PitchedMeasure[] = [
      [
        { beat: 0, duration: 1, rest: false, midi: 60 },
        { beat: 1, duration: 0.5, rest: false, midi: 62 },
        { beat: 1.5, duration: 0.5, rest: false, midi: 64 },
        { beat: 2, duration: 2, rest: false, midi: 65 },
      ],
    ];
    const spelledNotes: (SpelledPitch | null)[] = [
      { letter: 'C', acc: '', octave: 4 },
      { letter: 'D', acc: '', octave: 4 },
      { letter: 'E', acc: '', octave: 4 },
      { letter: 'F', acc: '', octave: 4 },
    ];
    const { container } = render(
      <SourceStaff
        clef="treble"
        vexKeySpec="C"
        timeSig={{ beatsPerBar: 4, beatValue: 4, measureBeats: 4 }}
        rhythmMeasures={rhythmMeasures}
        spelledNotes={spelledNotes}
      />,
    );
    const svg = container.querySelector('svg')!;
    expect(svg.querySelectorAll('.vf-stavenote')).toHaveLength(4);
  });

  it('renders across all four clefs without throwing', () => {
    const rhythmMeasures: PitchedMeasure[] = [[{ beat: 0, duration: 4, rest: false, midi: 60 }]];
    const spelledNotes: (SpelledPitch | null)[] = [{ letter: 'C', acc: '', octave: 4 }];
    (['treble', 'bass', 'alto', 'tenor'] as const).forEach((clef) => {
      expect(() =>
        render(
          <SourceStaff
            clef={clef}
            vexKeySpec="C"
            timeSig={{ beatsPerBar: 4, beatValue: 4, measureBeats: 4 }}
            rhythmMeasures={rhythmMeasures}
            spelledNotes={spelledNotes}
          />,
        ),
      ).not.toThrow();
    });
  });
});
