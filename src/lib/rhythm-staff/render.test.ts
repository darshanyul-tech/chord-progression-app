import { describe, expect, it } from 'vitest';
import type { Measure } from '../rhythm/time';
import { MUTED_COLOR, WRONG_COLOR, renderStaff, type RhythmStaffModel } from './render';

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
