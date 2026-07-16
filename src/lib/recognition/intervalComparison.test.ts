import { afterEach, describe, expect, it } from 'vitest';
import { setRng } from '../theory';
import {
  DIFFICULTY_FLOORS,
  buildIntervalComparisonQuestion,
  defaultIntervalComparisonSettings,
  getIntervalComparisonChoiceDefs,
  type IntervalComparisonSettings,
} from './intervalComparison';
import { INTERVAL_TYPES } from './intervals';

afterEach(() => setRng());

function withAllEnabled(overrides: Partial<IntervalComparisonSettings> = {}): IntervalComparisonSettings {
  const enabledIntervals: Record<string, boolean> = {};
  INTERVAL_TYPES.forEach((t) => {
    enabledIntervals[t.id] = true;
  });
  return { ...defaultIntervalComparisonSettings(), enabledIntervals, ...overrides };
}

describe('buildIntervalComparisonQuestion — difficulty floor', () => {
  (['easy', 'medium', 'hard'] as const).forEach((difficulty) => {
    it(`always keeps a semitone gap >= the ${difficulty} floor across 500 questions`, () => {
      const s = withAllEnabled({ difficulty });
      for (let trial = 0; trial < 500; trial++) {
        const q = buildIntervalComparisonQuestion(s);
        expect(q).not.toBeNull();
        if (q!.answerId === 'same') {
          expect(q!.first.semitones).toBe(q!.second.semitones);
        } else {
          const gap = Math.abs(q!.first.semitones - q!.second.semitones);
          expect(gap).toBeGreaterThanOrEqual(DIFFICULTY_FLOORS[difficulty]);
        }
      }
    });
  });

  it('returns null when the pool cannot satisfy the floor (m2+M2 at easy difficulty)', () => {
    const enabledIntervals: Record<string, boolean> = { m2: true, M2: true };
    const s: IntervalComparisonSettings = { ...defaultIntervalComparisonSettings(), enabledIntervals, difficulty: 'easy' };
    expect(buildIntervalComparisonQuestion(s)).toBeNull();
  });

  it('still generates with only m2+M2 enabled at hard difficulty (gap of 1 satisfies floor 1)', () => {
    const enabledIntervals: Record<string, boolean> = { m2: true, M2: true };
    const s: IntervalComparisonSettings = { ...defaultIntervalComparisonSettings(), enabledIntervals, difficulty: 'hard' };
    for (let trial = 0; trial < 50; trial++) {
      expect(buildIntervalComparisonQuestion(s)).not.toBeNull();
    }
  });

  it('returns null when fewer than two intervals are enabled', () => {
    const enabledIntervals: Record<string, boolean> = { m2: true };
    const s: IntervalComparisonSettings = { ...defaultIntervalComparisonSettings(), enabledIntervals };
    expect(buildIntervalComparisonQuestion(s)).toBeNull();
  });

  it('does not anchor on a middle value with no valid partner even though the pool overall has a valid pair', () => {
    // {m2=1, P4=5, TT=6} at floor 5: only m2<->TT(5) and m2<->P4... wait pick values
    // deliberately: {3, 5, 7} semitones -> m3(3), P4(5), P5(7) at floor 3: only
    // m3<->P5 (gap 4) qualifies; P4 (gap 2 to both neighbours) has no partner.
    const enabledIntervals: Record<string, boolean> = { m3: true, P4: true, P5: true };
    const s: IntervalComparisonSettings = { ...defaultIntervalComparisonSettings(), enabledIntervals, difficulty: 'easy' };
    for (let trial = 0; trial < 200; trial++) {
      const q = buildIntervalComparisonQuestion(s);
      expect(q).not.toBeNull();
      // Only m3<->P5 (or the same-pair) can appear.
      const ids = [q!.first.typeId, q!.second.typeId].sort();
      if (q!.answerId !== 'same') {
        expect(ids).toEqual(['P5', 'm3']);
      }
    }
  });
});

describe('buildIntervalComparisonQuestion — position and same-question distribution', () => {
  it("the larger interval's position is roughly 50/50 across many trials", () => {
    // Real Math.random (each call advances independently) — a fixed-value rng
    // stub would correlate the coin-flip with the anchor/partner picks since
    // they'd all read the same stubbed value within one build() call.
    const s = withAllEnabled({ difficulty: 'hard' });
    let firstIsLarger = 0;
    let total = 0;
    for (let i = 0; i < 2000; i++) {
      const q = buildIntervalComparisonQuestion(s);
      if (!q || q.answerId === 'same') continue;
      total++;
      if (q.answerId === 'first') firstIsLarger++;
    }
    const ratio = firstIsLarger / total;
    expect(ratio).toBeGreaterThan(0.4);
    expect(ratio).toBeLessThan(0.6);
  });

  it('"same" questions appear only when allowSame is on, and roughly at the configured frequency', () => {
    const off = withAllEnabled({ allowSame: false });
    for (let trial = 0; trial < 300; trial++) {
      const q = buildIntervalComparisonQuestion(off);
      expect(q!.answerId).not.toBe('same');
    }

    const on = withAllEnabled({ allowSame: true });
    let sameCount = 0;
    const iterations = 4000;
    for (let i = 0; i < iterations; i++) {
      const q = buildIntervalComparisonQuestion(on);
      if (q!.answerId === 'same') sameCount++;
    }
    const ratio = sameCount / iterations;
    expect(ratio).toBeGreaterThan(0.15);
    expect(ratio).toBeLessThan(0.35);
  });
});

describe('buildIntervalComparisonQuestion — root relationship', () => {
  it('forces root B === root A in every question when rootRelationship is "same"', () => {
    const s = withAllEnabled({ rootRelationship: 'same' });
    for (let trial = 0; trial < 200; trial++) {
      const q = buildIntervalComparisonQuestion(s);
      expect(q!.second.rootMidi).toBe(q!.first.rootMidi);
    }
  });

  it('keeps every root within the recognition root window regardless of relationship', () => {
    const s = withAllEnabled({ rootRelationship: 'different' });
    for (let trial = 0; trial < 200; trial++) {
      const q = buildIntervalComparisonQuestion(s)!;
      [q.first, q.second].forEach((member) => {
        expect(member.rootMidi).toBeGreaterThanOrEqual(48);
        expect(member.rootMidi + member.semitones).toBeLessThanOrEqual(72);
      });
    }
  });
});

describe('buildIntervalComparisonQuestion — direction', () => {
  it('both intervals of a pair always share one direction', () => {
    const s = withAllEnabled({ direction: 'both' });
    for (let trial = 0; trial < 100; trial++) {
      const q = buildIntervalComparisonQuestion(s)!;
      expect(['asc', 'desc']).toContain(q.direction);
    }
  });

  it('honors a fixed direction setting', () => {
    const asc = withAllEnabled({ direction: 'asc' });
    const desc = withAllEnabled({ direction: 'desc' });
    for (let trial = 0; trial < 50; trial++) {
      expect(buildIntervalComparisonQuestion(asc)!.direction).toBe('asc');
      expect(buildIntervalComparisonQuestion(desc)!.direction).toBe('desc');
    }
  });
});

describe('getIntervalComparisonChoiceDefs', () => {
  it('is First/Second only when allowSame is off', () => {
    expect(getIntervalComparisonChoiceDefs({ allowSame: false }).map((c) => c.id)).toEqual(['first', 'second']);
  });

  it('adds Same when allowSame is on', () => {
    expect(getIntervalComparisonChoiceDefs({ allowSame: true }).map((c) => c.id)).toEqual(['first', 'second', 'same']);
  });
});

describe('defaultIntervalComparisonSettings', () => {
  it('enables m2 through P5 by default (matches recognition\'s default band)', () => {
    const s = defaultIntervalComparisonSettings();
    INTERVAL_TYPES.forEach((t) => {
      expect(s.enabledIntervals[t.id]).toBe(t.semitones <= 7);
    });
  });
});
