import { describe, expect, it } from 'vitest';
import { findMeasureAt, resolvePlacementBeat } from './placement';
import type { PitchedMeasure } from './theory';
import type { MeasureGeometry } from './vexscore';

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

  // "Approaching a barline": a click near the boundary between an existing
  // note and the one free beat left in the bar is *always* numerically
  // nearest to that candidate (there's nothing else it could be), so this
  // still resolves there — a hard "too far, do nothing" cutoff turned out
  // to be indistinguishable from breaking the very near-boundary clicks the
  // MD-3 fix above depends on, given how narrow the actual ambiguous buffer
  // between a note's core and a candidate's own confident zone is (both
  // shrink by the same margin). What actually changed: the confident zone
  // is checked *first*, so a click well inside a candidate's own space
  // always resolves to that candidate outright, rather than a raw
  // nearest-distance calculation (or an existing note's unshrunk full
  // span) pulling it the wrong way — which is what let some barline-
  // approaching clicks snap onto a note they weren't visually near.
  describe('candidate resolution near a boundary (natural-writing breathing room)', () => {
    it('resolves a click in the ambiguous buffer between a note and the only free candidate', () => {
      const measure: PitchedMeasure = [note(0, 1), note(1, 1)];
      // note(1,1)'s core ends at 1.75; candidate 2's confident zone (margined
      // on its touching left side) starts at 2.25 — 2.0 sits in neither, but
      // it's still unambiguously closer to 2 than to anything else.
      const result = resolvePlacementBeat(measure, 2.0, 1, 3, 1);
      expect(result).toEqual({ beat: 2, isReplace: false });
    });

    it('resolves confidently once the click is well inside the candidate\'s own core', () => {
      const measure: PitchedMeasure = [note(0, 1), note(1, 1)];
      const result = resolvePlacementBeat(measure, 2.6, 1, 3, 1);
      expect(result).toEqual({ beat: 2, isReplace: false });
    });

    it('an isolated candidate with free space on both sides accepts a click across its full width (no regression for open space)', () => {
      const measure: PitchedMeasure = [note(0, 1)];
      // Candidates are 1 and 2; candidate 1 touches an existing note on its
      // left, but candidate 2 is fully isolated (free on both sides) and
      // should accept any click closer to it than to candidate 1.
      const result = resolvePlacementBeat(measure, 2.1, 1, 3, 1);
      expect(result).toEqual({ beat: 2, isReplace: false });
    });
  });
});

// findMeasureAt: two same-row measures share a topLineY, so picking between
// them near their shared barline can't rely on row-distance alone — it used
// to always keep whichever measure was found first (the earlier one),
// regardless of which side of the barline x was actually nearer to.
describe('findMeasureAt', () => {
  const measure0: MeasureGeometry = { index: 0, noteStartX: 10, noteEndX: 490, topLineY: 100, spacing: 10 };
  const measure1: MeasureGeometry = { index: 1, noteStartX: 510, noteEndX: 990, topLineY: 100, spacing: 10 };

  it('picks the measure whose note area actually contains x', () => {
    expect(findMeasureAt([measure0, measure1], 250, 100)?.index).toBe(0);
    expect(findMeasureAt([measure0, measure1], 750, 100)?.index).toBe(1);
  });

  it('picks measure 1 for a click just past the shared barline, even though it is inside measure 0\'s tolerance band too', () => {
    // 495 is within measure0.noteEndX(490)+20 *and* measure1.noteStartX(510)-20 —
    // the classic case where both used to match and the tie always broke
    // toward measure 0 regardless of x. It's nearer measure1's own start.
    const result = findMeasureAt([measure0, measure1], 505, 100);
    expect(result?.index).toBe(1);
  });

  it('picks measure 0 for a click just before the shared barline, in the same overlapping tolerance band', () => {
    const result = findMeasureAt([measure0, measure1], 495, 100);
    expect(result?.index).toBe(0);
  });

  it('returns null when x is outside every measure’s tolerance band', () => {
    expect(findMeasureAt([measure0, measure1], -100, 100)).toBeNull();
  });

  it('prefers the row nearer to y when measures are on different rows', () => {
    const row2: MeasureGeometry = { index: 2, noteStartX: 10, noteEndX: 490, topLineY: 250, spacing: 10 };
    expect(findMeasureAt([measure0, row2], 250, 240)?.index).toBe(2);
    expect(findMeasureAt([measure0, row2], 250, 110)?.index).toBe(0);
  });
});
