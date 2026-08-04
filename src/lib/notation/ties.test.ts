import { describe, expect, it, vi } from 'vitest';
import { Stave, StaveNote, StaveTie } from 'vexflow';
import { drawTies, tieSpansSystemBreak, type TieAdapter } from './ties';

function noteOn(stave: Stave): StaveNote {
  const n = new StaveNote({ keys: ['c/5'], duration: 'w' });
  n.setStave(stave);
  return n;
}

interface TN {
  beat: number;
  duration: number;
  rest: boolean;
  tied: boolean;
}
const adapter: TieAdapter<TN> = {
  beat: (n) => n.beat,
  duration: (n) => n.duration,
  isRest: (n) => n.rest,
  isTied: (n) => n.tied,
};

describe('tieSpansSystemBreak', () => {
  it('is true when the two notes sit on staves at different y (different rows)', () => {
    expect(tieSpansSystemBreak(noteOn(new Stave(10, 40, 200)), noteOn(new Stave(10, 220, 200)))).toBe(true);
  });

  it('is false when both notes share a row (same y, next measure across the barline)', () => {
    expect(tieSpansSystemBreak(noteOn(new Stave(10, 40, 200)), noteOn(new Stave(210, 40, 200)))).toBe(false);
  });
});

describe('drawTies — system-break split', () => {
  const ctx = {} as ReturnType<import('vexflow').Renderer['getContext']>;

  function run(topY: number, bottomY: number) {
    const a: TN = { beat: 0, duration: 4, rest: false, tied: true };
    const b: TN = { beat: 0, duration: 4, rest: false, tied: false };
    const map = new Map<TN, StaveNote>([
      [a, noteOn(new Stave(10, topY, 200))],
      [b, noteOn(new Stave(10, bottomY, 200))],
    ]);
    drawTies(ctx, [[a], [b]], map, adapter);
  }

  it('draws two partial ties (to the barline, then from the barline) when the tie crosses a system break', () => {
    const spy = vi.spyOn(StaveTie.prototype, 'draw').mockReturnValue(true);
    run(40, 220);
    const notes = (spy.mock.instances as unknown as StaveTie[]).map((t) => (t as unknown as { notes: { firstNote?: unknown; lastNote?: unknown } }).notes);
    expect(notes).toHaveLength(2);
    // one fragment runs from the first note to its barline (firstNote only),
    expect(notes.some((n) => n.firstNote && !n.lastNote)).toBe(true);
    // the other from the next row's barline to the following note (lastNote only).
    expect(notes.some((n) => !n.firstNote && n.lastNote)).toBe(true);
    spy.mockRestore();
  });

  it('draws one full tie when both notes are on the same row', () => {
    const spy = vi.spyOn(StaveTie.prototype, 'draw').mockReturnValue(true);
    run(40, 40);
    const notes = (spy.mock.instances as unknown as StaveTie[]).map((t) => (t as unknown as { notes: { firstNote?: unknown; lastNote?: unknown } }).notes);
    expect(notes).toHaveLength(1);
    expect(notes[0]!.firstNote && notes[0]!.lastNote).toBeTruthy();
    spy.mockRestore();
  });
});
