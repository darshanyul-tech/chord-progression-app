import { describe, expect, it } from 'vitest';
import type { Measure } from '../rhythm/time';
import { CURSOR_COLOR, HOVER_COLOR, KEYBOARD_CURSOR_COLOR, MUTED_COLOR, WRONG_COLOR, renderStaff, type RhythmStaffModel } from './render';

const userMeasure: Measure = [{ beat: 0, duration: 4, isRest: false }];
const correctMeasure: Measure = [{ beat: 0, duration: 2, isRest: false }];

function baseModel(overrides: Partial<RhythmStaffModel>): RhythmStaffModel {
  return {
    beatsPerBar: 4,
    beatValue: 4,
    numMeasures: 1,
    measures: [userMeasure],
    hasSubmitted: false,
    measureResults: [],
    correctPattern: [correctMeasure],
    flashMeasure: null,
    playbackFraction: null,
    cursorMeasureIndex: 0,
    cursorBeat: null,
    hover: null,
    ...overrides,
  };
}

// docs/09-improvement-plan.md §12.3 — the reveal used to draw the user's
// wrong notes in the same black as an unsubmitted answer, indistinguishable
// from the red correct pattern at the same y. Also adds a ✗ badge symmetric
// with the existing ✓.
describe('renderStaff reveal styling', () => {
  it('greys the user voice and marks the measure ✗ when wrong', () => {
    const container = document.createElement('div');
    renderStaff(container, baseModel({ hasSubmitted: true, measureResults: [false] }));
    const svg = container.querySelector('svg')!;

    const muted = [...svg.querySelectorAll('g,path')].some(
      (el) => el.getAttribute('stroke') === MUTED_COLOR || el.getAttribute('fill') === MUTED_COLOR,
    );
    expect(muted).toBe(true);

    const wrongCorrect = [...svg.querySelectorAll('g,path')].some(
      (el) => el.getAttribute('stroke') === WRONG_COLOR || el.getAttribute('fill') === WRONG_COLOR,
    );
    expect(wrongCorrect).toBe(true);

    const badge = [...svg.querySelectorAll('text')].map((t) => t.textContent);
    expect(badge).toContain('✗');
    expect(badge).not.toContain('✓');
  });

  it('marks the measure ✓ and does not grey anything when correct', () => {
    const container = document.createElement('div');
    renderStaff(container, baseModel({ hasSubmitted: true, measureResults: [true] }));
    const svg = container.querySelector('svg')!;

    const muted = [...svg.querySelectorAll('g,path')].some(
      (el) => el.getAttribute('stroke') === MUTED_COLOR || el.getAttribute('fill') === MUTED_COLOR,
    );
    expect(muted).toBe(false);

    const badge = [...svg.querySelectorAll('text')].map((t) => t.textContent);
    expect(badge).toContain('✓');
    expect(badge).not.toContain('✗');
  });

  it('shows no badge before submission', () => {
    const container = document.createElement('div');
    renderStaff(container, baseModel({}));
    const svg = container.querySelector('svg')!;
    const badge = [...svg.querySelectorAll('text')].map((t) => t.textContent);
    expect(badge).not.toContain('✓');
    expect(badge).not.toContain('✗');
  });
});

// Playback cursor (04-notation-engine.md, teal) vs. keyboard insertion cursor
// (09-improvement-plan.md §14.1, purple) — distinct markers, drawn only when
// their respective model field is non-null.
describe('renderStaff cursors', () => {
  it('draws a playback cursor in CURSOR_COLOR when playbackFraction is set', () => {
    const container = document.createElement('div');
    renderStaff(container, baseModel({ playbackFraction: 0.5 }));
    const svg = container.querySelector('svg')!;
    const cursor = [...svg.querySelectorAll('path')].some((p) => p.getAttribute('stroke') === CURSOR_COLOR);
    expect(cursor).toBe(true);
  });

  it('draws no playback cursor when playbackFraction is null', () => {
    const container = document.createElement('div');
    renderStaff(container, baseModel({ playbackFraction: null }));
    const svg = container.querySelector('svg')!;
    const cursor = [...svg.querySelectorAll('path')].some((p) => p.getAttribute('stroke') === CURSOR_COLOR);
    expect(cursor).toBe(false);
  });

  it('draws a keyboard insertion cursor in KEYBOARD_CURSOR_COLOR when cursorBeat is set', () => {
    const container = document.createElement('div');
    renderStaff(container, baseModel({ cursorMeasureIndex: 0, cursorBeat: 1 }));
    const svg = container.querySelector('svg')!;
    const cursor = [...svg.querySelectorAll('path')].some((p) => p.getAttribute('fill') === KEYBOARD_CURSOR_COLOR);
    expect(cursor).toBe(true);
  });

  it('draws no keyboard cursor when cursorBeat is null (staff doesn\'t have focus)', () => {
    const container = document.createElement('div');
    renderStaff(container, baseModel({ cursorBeat: null }));
    const svg = container.querySelector('svg')!;
    const cursor = [...svg.querySelectorAll('path')].some((p) => p.getAttribute('fill') === KEYBOARD_CURSOR_COLOR);
    expect(cursor).toBe(false);
  });
});

// Mouse-hover placement ghost — mirrors Melodic Dictation's VexStaffHost
// hover mechanism (docs/12 MD-4), now shared by rhythm dictation too.
describe('renderStaff hover ghost', () => {
  it('draws a hover-styled note when hover is set on an empty measure', () => {
    const container = document.createElement('div');
    renderStaff(
      container,
      baseModel({ measures: [[]], hover: { measureIndex: 0, beat: 0, duration: 1, isRest: false } }),
    );
    const svg = container.querySelector('svg')!;
    const ghost = [...svg.querySelectorAll('g,path')].some(
      (el) => el.getAttribute('fill') === HOVER_COLOR || el.getAttribute('stroke') === HOVER_COLOR,
    );
    expect(ghost).toBe(true);
  });

  it('draws nothing hover-styled when hover is null', () => {
    const container = document.createElement('div');
    renderStaff(container, baseModel({ measures: [[]], hover: null }));
    const svg = container.querySelector('svg')!;
    const ghost = [...svg.querySelectorAll('g,path')].some(
      (el) => el.getAttribute('fill') === HOVER_COLOR || el.getAttribute('stroke') === HOVER_COLOR,
    );
    expect(ghost).toBe(false);
  });

  it('suppresses the hover ghost once the answer is submitted', () => {
    const container = document.createElement('div');
    renderStaff(
      container,
      baseModel({
        measures: [[]],
        hasSubmitted: true,
        measureResults: [true],
        hover: { measureIndex: 0, beat: 0, duration: 1, isRest: false },
      }),
    );
    const svg = container.querySelector('svg')!;
    const ghost = [...svg.querySelectorAll('g,path')].some(
      (el) => el.getAttribute('fill') === HOVER_COLOR || el.getAttribute('stroke') === HOVER_COLOR,
    );
    expect(ghost).toBe(false);
  });
});

// docs/12-melodic-dictation-fixes.md RC-3, ported to rhythm dictation: a
// note's x-position must be proportional to its actual beat, not packed
// sequentially with no regard for empty beats before it.
describe('renderStaff gap-proportional spacing', () => {
  function noteX(measures: Measure[]): number {
    const container = document.createElement('div');
    renderStaff(container, baseModel({ measures }));
    const svg = container.querySelector('svg')!;
    // happy-dom doesn't implement real layout (getBBox always returns
    // zeros), but VexFlow's SMuFL noteheads are positioned <text> elements
    // with a real x attribute, which is enough to prove relative ordering.
    const notehead = svg.querySelector('.vf-notehead text')!;
    return Number(notehead.getAttribute('x'));
  }

  it('positions a lone note further right when it starts later in the bar', () => {
    const early = noteX([[{ beat: 0, duration: 1, isRest: false }]]);
    const late = noteX([[{ beat: 3, duration: 1, isRest: false }]]);
    expect(late).toBeGreaterThan(early);
  });
});

// Beaming used to lump every non-rest note in the whole bar into a single
// Beam.generateBeams() call with no gap/rest/beat-boundary awareness — a
// beam could bridge across a rest or a quarter note sitting between two
// eighth-note pairs, since VexFlow's own grouping only sees the list it's
// handed, not the notes that were filtered out of it. Now mirrors Melodic
// Dictation's VexStaffHost exactly: beamableRuns (time-adjacent, sub-beat,
// non-rest runs) + getDefaultBeamGroups (meter-aware main-beat splits).
describe('renderStaff beaming', () => {
  function beamCount(measures: Measure[], beatsPerBar = 4, beatValue = 4): number {
    const container = document.createElement('div');
    renderStaff(container, baseModel({ measures, beatsPerBar, beatValue }));
    const svg = container.querySelector('svg')!;
    return svg.querySelectorAll('.vf-beam').length;
  }

  it('beams two time-adjacent eighths into one group', () => {
    expect(
      beamCount([
        [
          { beat: 0, duration: 0.5, isRest: false },
          { beat: 0.5, duration: 0.5, isRest: false },
          { beat: 1, duration: 3, isRest: true },
        ],
      ]),
    ).toBe(1);
  });

  it('does not beam eighths separated by a rest', () => {
    expect(
      beamCount([
        [
          { beat: 0, duration: 0.5, isRest: false },
          { beat: 0.5, duration: 0.5, isRest: true },
          { beat: 1, duration: 0.5, isRest: false },
          { beat: 1.5, duration: 2.5, isRest: true },
        ],
      ]),
    ).toBe(0);
  });

  it('does not beam across a quarter note sitting between two eighth-note pairs', () => {
    expect(
      beamCount([
        [
          { beat: 0, duration: 0.5, isRest: false },
          { beat: 0.5, duration: 0.5, isRest: false },
          { beat: 1, duration: 1, isRest: false },
          { beat: 2, duration: 0.5, isRest: false },
          { beat: 2.5, duration: 0.5, isRest: false },
          { beat: 3, duration: 1, isRest: false },
        ],
      ]),
    ).toBe(2); // one beam either side of the quarter note, never a single beam spanning it
  });

  it('splits four consecutive eighths crossing a main beat into two groups (meter-aware, not one long beam)', () => {
    expect(
      beamCount([
        [
          { beat: 0, duration: 0.5, isRest: false },
          { beat: 0.5, duration: 0.5, isRest: false },
          { beat: 1, duration: 0.5, isRest: false },
          { beat: 1.5, duration: 0.5, isRest: false },
          { beat: 2, duration: 2, isRest: true },
        ],
      ]),
    ).toBe(2);
  });

  it('never beams a lone eighth, or quarter notes and longer', () => {
    expect(beamCount([[{ beat: 0, duration: 0.5, isRest: false }, { beat: 0.5, duration: 3.5, isRest: true }]])).toBe(0);
    expect(
      beamCount([
        [
          { beat: 0, duration: 1, isRest: false },
          { beat: 1, duration: 1, isRest: false },
          { beat: 2, duration: 2, isRest: false },
        ],
      ]),
    ).toBe(0);
  });
});
