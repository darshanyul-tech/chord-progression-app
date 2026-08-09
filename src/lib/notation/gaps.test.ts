import { describe, expect, it } from 'vitest';
import type { RhythmNote } from '../rhythm/time';
import { applyPlacement, defaultRestMeasure, type RestAdapter } from './gaps';

const rhythmAdapter: RestAdapter<RhythmNote> = {
  beat: (n) => n.beat,
  duration: (n) => n.duration,
  isRest: (n) => n.isRest,
  makeRest: (beat, duration) => ({ beat, duration, isRest: true }),
};

function byBeat(measure: RhythmNote[]): RhythmNote[] {
  return [...measure].sort((a, b) => a.beat - b.beat);
}

// applyPlacement is the single function both the commit path and the hover
// preview call — it's what turns "place this note at this beat" into the
// bar's actual new state, including any rest a placement needs to leave
// behind. Its `added` diff is what a hover preview colors.
describe('applyPlacement', () => {
  it("the user's own reported case: a quaver on 1+ in a 2/4 bar of two crotchet rests leaves a quaver rest on beat 1", () => {
    const measure = defaultRestMeasure(2, 1, rhythmAdapter); // [{0,1,rest},{1,1,rest}]
    const newNote: RhythmNote = { beat: 0.5, duration: 0.5, isRest: false };
    const { notes, added } = applyPlacement(measure, newNote, 2, 1, rhythmAdapter);

    expect(byBeat(notes)).toEqual([
      { beat: 0, duration: 0.5, isRest: true },
      { beat: 0.5, duration: 0.5, isRest: false },
      { beat: 1, duration: 1, isRest: true },
    ]);
    // added = the placed note itself + the new quaver rest it left behind on
    // beat 0. The untouched beat-1 crotchet rest is the same object as
    // before — not part of the preview set.
    expect(byBeat(added)).toEqual([
      { beat: 0, duration: 0.5, isRest: true },
      { beat: 0.5, duration: 0.5, isRest: false },
    ]);
    expect(notes.find((n) => n.beat === 1)).toBe(measure.find((n) => n.beat === 1));
  });

  it('clears a real note that a new placement only partially covers, refilling the leftover as rests', () => {
    const measure: RhythmNote[] = [{ beat: 1, duration: 1, isRest: false }]; // a crotchet on beat 1 in 2/4
    const newNote: RhythmNote = { beat: 1.5, duration: 0.5, isRest: false }; // a quaver on 1+ overlaps it
    const { notes, added } = applyPlacement(measure, newNote, 2, 1, rhythmAdapter);

    expect(byBeat(notes)).toEqual([
      { beat: 0, duration: 1, isRest: true },
      { beat: 1, duration: 0.5, isRest: true },
      { beat: 1.5, duration: 0.5, isRest: false },
    ]);
    // Every entry is new — nothing survives from the original measure, since
    // the crotchet was fully displaced and the rest of the bar was empty.
    expect(byBeat(added)).toEqual(byBeat(notes));
  });

  it('a placement that exactly matches an existing span leaves everything else untouched', () => {
    const measure = defaultRestMeasure(4, 1, rhythmAdapter);
    const newNote: RhythmNote = { beat: 1, duration: 1, isRest: false };
    const { notes, added } = applyPlacement(measure, newNote, 4, 1, rhythmAdapter);

    expect(byBeat(notes)).toEqual([
      { beat: 0, duration: 1, isRest: true },
      { beat: 1, duration: 1, isRest: false },
      { beat: 2, duration: 1, isRest: true },
      { beat: 3, duration: 1, isRest: true },
    ]);
    expect(added).toEqual([newNote]);
  });
});
