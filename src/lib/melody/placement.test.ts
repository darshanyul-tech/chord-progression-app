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
});
