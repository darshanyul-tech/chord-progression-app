import { afterEach, describe, expect, it } from 'vitest';
import { centsBetween, f0FromMidi } from '../pitch/analysis';
import { setRng } from '../theory';
import {
  TUNING_DETUNE_CENTS,
  buildTuningQuestion,
  defaultTuningSettings,
  getTuningChoiceDefs,
  type TuningDifficulty,
  type TuningRegister,
  type TuningSettings,
} from './tuning';

afterEach(() => setRng());

function withSettings(overrides: Partial<TuningSettings> = {}): TuningSettings {
  return { ...defaultTuningSettings(), ...overrides };
}

const REGISTER_WINDOWS: Record<TuningRegister, { lowMidi: number; highMidi: number }> = {
  low: { lowMidi: 48, highMidi: 59 },
  mid: { lowMidi: 60, highMidi: 71 },
  high: { lowMidi: 72, highMidi: 83 },
  any: { lowMidi: 48, highMidi: 83 },
};

describe('buildTuningQuestion — difficulty magnitude', () => {
  (['easy', 'medium', 'hard'] as const).forEach((difficulty: TuningDifficulty) => {
    it(`detune is always exactly 0 or the ${difficulty} magnitude across 500 questions`, () => {
      const s = withSettings({ difficulty });
      for (let trial = 0; trial < 500; trial++) {
        const q = buildTuningQuestion(s);
        if (q.answerId === 'intune') {
          expect(q.detuneCents).toBe(0);
        } else {
          expect(Math.abs(q.detuneCents)).toBe(TUNING_DETUNE_CENTS[difficulty]);
        }
      }
    });
  });

  it('answerId matches the sign of detuneCents', () => {
    const s = withSettings();
    for (let trial = 0; trial < 200; trial++) {
      const q = buildTuningQuestion(s);
      if (q.detuneCents > 0) expect(q.answerId).toBe('sharp');
      else if (q.detuneCents < 0) expect(q.answerId).toBe('flat');
      else expect(q.answerId).toBe('intune');
    }
  });
});

describe('buildTuningQuestion — distribution', () => {
  it('flat/in-tune/sharp each occur within sane bounds across many trials', () => {
    const s = withSettings();
    const counts = { flat: 0, intune: 0, sharp: 0 };
    const iterations = 3000;
    for (let i = 0; i < iterations; i++) {
      counts[buildTuningQuestion(s).answerId]++;
    }
    // In-tune ~1/3; flat/sharp split the remaining ~2/3 evenly (~1/3 each).
    expect(counts.intune / iterations).toBeGreaterThan(0.25);
    expect(counts.intune / iterations).toBeLessThan(0.42);
    expect(counts.flat / iterations).toBeGreaterThan(0.22);
    expect(counts.flat / iterations).toBeLessThan(0.45);
    expect(counts.sharp / iterations).toBeGreaterThan(0.22);
    expect(counts.sharp / iterations).toBeLessThan(0.45);
  });

  it('base note always lands inside the selected register window', () => {
    (['low', 'mid', 'high', 'any'] as const).forEach((register) => {
      const s = withSettings({ register });
      const win = REGISTER_WINDOWS[register];
      for (let trial = 0; trial < 200; trial++) {
        const q = buildTuningQuestion(s);
        expect(q.baseMidi).toBeGreaterThanOrEqual(win.lowMidi);
        expect(q.baseMidi).toBeLessThanOrEqual(win.highMidi);
      }
    });
  });
});

describe('buildTuningQuestion — Hz math', () => {
  it('the test frequency is exactly the base frequency for an in-tune question (bit-identical schedule)', () => {
    setRng(() => 0); // 0 < 1/3 -> in-tune branch every time
    const s = withSettings();
    const q = buildTuningQuestion(s);
    expect(q.detuneCents).toBe(0);
    expect(q.testFrequencyHz).toBe(f0FromMidi(q.baseMidi));
  });

  it('the test frequency round-trips back to exactly detuneCents via centsBetween (no hand-computed constant)', () => {
    const s = withSettings({ difficulty: 'medium' }); // 15 cents
    for (let trial = 0; trial < 200; trial++) {
      const q = buildTuningQuestion(s);
      const measuredCents = centsBetween(q.testFrequencyHz, f0FromMidi(q.baseMidi));
      expect(measuredCents).toBeCloseTo(q.detuneCents, 9);
    }
  });
});

describe('getTuningChoiceDefs', () => {
  it('is always exactly flat/intune/sharp in that order', () => {
    expect(getTuningChoiceDefs().map((c) => c.id)).toEqual(['flat', 'intune', 'sharp']);
  });
});
