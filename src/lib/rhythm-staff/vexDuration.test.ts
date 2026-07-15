import { describe, expect, it } from 'vitest';
import { vexDurationFor } from './vexDuration';

describe('vexDurationFor', () => {
  it('maps every internal beat-unit duration to its VexFlow code + dot count', () => {
    expect(vexDurationFor(4)).toEqual({ duration: 'w', dots: 0 });
    expect(vexDurationFor(2)).toEqual({ duration: 'h', dots: 0 });
    expect(vexDurationFor(3)).toEqual({ duration: 'h', dots: 1 });
    expect(vexDurationFor(1)).toEqual({ duration: 'q', dots: 0 });
    expect(vexDurationFor(1.5)).toEqual({ duration: 'q', dots: 1 });
    expect(vexDurationFor(0.5)).toEqual({ duration: '8', dots: 0 });
    expect(vexDurationFor(0.75)).toEqual({ duration: '8', dots: 1 });
    expect(vexDurationFor(0.25)).toEqual({ duration: '16', dots: 0 });
    expect(vexDurationFor(0.333)).toEqual({ duration: '8', dots: 0 });
    expect(vexDurationFor(0.667)).toEqual({ duration: 'q', dots: 0 });
  });

  it('falls back to an unstemmed quarter for an unrecognized duration', () => {
    expect(vexDurationFor(7)).toEqual({ duration: 'q', dots: 0 });
  });
});
