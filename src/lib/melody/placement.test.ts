import { describe, expect, it } from 'vitest';
import { resolvePlacementBeat } from './placement';
import type { PitchedMeasure } from './theory';

const note = (beat: number, duration: number, midi = 60): PitchedMeasure[number] => ({ beat, duration, rest: false, midi });

// docs/12-melodic-dictation-fixes.md MD-3 RC-3: the click-x → beat estimate
// is only ever approximately right (VexFlow's real formatter geometry isn't
// invertible exactly) — resolvePlacementBeat is what turns that estimate
// into either a legal free slot or an edit on the note the user clicked.
describe('resolvePlacementBeat', () => {
  it('places a quarter note in an empty 3/4 bar at the nearest of the three legal beats', () => {
    // gridStepVal=1 reflects a settings.durations set with only quarters active (its GCD grid step).
    const measure: PitchedMeasure = [];
    expect(resolvePlacementBeat(measure, 0.2, 1, 3, 1)).toEqual({ beat: 0, isReplace: false });
    expect(resolvePlacementBeat(measure, 1.4, 1, 3, 1)).toEqual({ beat: 1, isReplace: false });
    expect(resolvePlacementBeat(measure, 2.9, 1, 3, 1)).toEqual({ beat: 2, isReplace: false });
  });

  it('fills the third quarter after two are already placed, instead of overwriting one (the reported bug)', () => {
    const measure: PitchedMeasure = [note(0, 1), note(1, 1)];
    const result = resolvePlacementBeat(measure, 2.6, 1, 3, 1);
    expect(result).toEqual({ beat: 2, isReplace: false });
  });

  it('returns null when the remaining gap is too small for the armed duration', () => {
    // Two quarters placed (beats 0–2), one free beat left (2–3) — too small for a dotted quarter (1.5).
    const measure: PitchedMeasure = [note(0, 1), note(1, 1)];
    expect(resolvePlacementBeat(measure, 2.5, 1.5, 3, 1)).toBeNull();
  });

  it('treats a click landing inside an existing note as a direct hit (replace)', () => {
    const measure: PitchedMeasure = [note(0, 1), note(1, 0.5)];
    const result = resolvePlacementBeat(measure, 1.2, 0.5, 3, 0.25);
    expect(result).toEqual({ beat: 1, isReplace: true });
  });

  it('snaps a gap-filling placement to the nearest free beat on the grid', () => {
    const measure: PitchedMeasure = [note(0, 0.5)];
    // Gap from 0.5 to 4 in a 4/4 bar; clicking near 1 should land exactly at 0.5 (nearest free eighth-grid beat).
    const result = resolvePlacementBeat(measure, 0.6, 0.5, 4, 0.25);
    expect(result).toEqual({ beat: 0.5, isReplace: false });
  });

  // Reported live: a click aimed at the free beat right after a note (off
  // by only a little) used to fall inside that note's full [0, 1) span and
  // replace it — every attempt to add a second crotchet re-hit the first,
  // capping a 3/4 bar at one note. rawBeat=0.9 is close to beat 1 but still
  // technically inside note(0,1)'s un-shrunk span; it must resolve to the
  // free beat 1, not treat 0.9 as landing on the beat-0 note.
  describe('near-boundary clicks resolve to the adjacent free beat, not the previous note (regression)', () => {
    it('a click just short of the next beat fills that beat instead of replacing the previous note', () => {
      const measure: PitchedMeasure = [note(0, 1)];
      const result = resolvePlacementBeat(measure, 0.9, 1, 3, 1);
      expect(result).toEqual({ beat: 1, isReplace: false });
    });

    it('completes three crotchets in 3/4 even with imprecise (near-boundary) clicks each time', () => {
      let measure: PitchedMeasure = [];
      const clicks = [0.05, 0.9, 1.95];
      const expectedBeats = [0, 1, 2];
      clicks.forEach((rawBeat, i) => {
        const result = resolvePlacementBeat(measure, rawBeat, 1, 3, 1);
        expect(result).toEqual({ beat: expectedBeats[i], isReplace: false });
        measure = [...measure, note(result!.beat, 1)];
      });
      expect(measure).toHaveLength(3);
    });

    it('still treats a click well inside a note (its core) as a direct hit', () => {
      const measure: PitchedMeasure = [note(0, 1)];
      const result = resolvePlacementBeat(measure, 0.5, 1, 3, 1);
      expect(result).toEqual({ beat: 0, isReplace: true });
    });

    it('falls back to a direct hit near the edge when no free slot exists anywhere', () => {
      // Bar fully packed (three crotchets in 3/4) — a near-edge click on the
      // first note has nowhere else to go, so it should still edit that note
      // rather than being rejected outright for missing the stricter core zone.
      const measure: PitchedMeasure = [note(0, 1), note(1, 1), note(2, 1)];
      const result = resolvePlacementBeat(measure, 0.05, 1, 3, 1);
      expect(result).toEqual({ beat: 0, isReplace: true });
    });
  });
});
