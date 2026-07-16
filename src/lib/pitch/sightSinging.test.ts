import { afterEach, describe, expect, it } from 'vitest';
import { setRng } from '../theory';
import { keyById, diatonicPcs } from '../melody/theory';
import { ROOT_RANGE_PRESETS } from './question';
import {
  buildSightSingingQuestion,
  defaultSightSingingSettings,
  gradeSungMelody,
  type SightSingingSettings,
} from './sightSinging';

afterEach(() => setRng());

function withSettings(overrides: Partial<SightSingingSettings> = {}): SightSingingSettings {
  return { ...defaultSightSingingSettings(), ...overrides };
}

describe('buildSightSingingQuestion — vocal-window fitting', () => {
  (['auto', 'male', 'female'] as const).forEach((preset) => {
    (['steps', 'mixed'] as const).forEach((motion) => {
      it(`every target stays inside the ${preset} vocal window with motion=${motion} (50 trials)`, () => {
        const s = withSettings({ motion, randomKey: true });
        const window = ROOT_RANGE_PRESETS[preset];
        for (let trial = 0; trial < 50; trial++) {
          const q = buildSightSingingQuestion(s, window);
          q.targetMidis.forEach((midi) => {
            expect(midi).toBeGreaterThanOrEqual(window.lowMidi);
            expect(midi).toBeLessThanOrEqual(window.highMidi);
          });
        }
      });
    });
  });

  it('every specific key stays inside the window across many trials', () => {
    const window = ROOT_RANGE_PRESETS.auto;
    ['C', 'G', 'F', 'Eb', 'Am', 'Gm'].forEach((key) => {
      const s = withSettings({ key, randomKey: false });
      for (let trial = 0; trial < 20; trial++) {
        const q = buildSightSingingQuestion(s, window);
        q.targetMidis.forEach((midi) => {
          expect(midi).toBeGreaterThanOrEqual(window.lowMidi);
          expect(midi).toBeLessThanOrEqual(window.highMidi);
        });
      }
    });
  });

  it('flattening preserves onset order and count (no rests were allowed)', () => {
    const s = withSettings({ measures: 2 });
    const q = buildSightSingingQuestion(s, ROOT_RANGE_PRESETS.auto);
    const flatFromMeasures = q.melody.measures.flatMap((bar) => bar.filter((n) => !n.rest).map((n) => n.midi));
    expect(q.targetMidis).toEqual(flatFromMeasures);
    expect(q.targetMidis.length).toBeGreaterThan(0);
  });

  it('the transposition fallback lands every note in-window even for a narrow custom range', () => {
    // A one-octave window far from the generator's own default register —
    // only reachable via the octave-shift fallback, not the raw output.
    const narrowWindow = { lowMidi: 72, highMidi: 83 }; // C5-B5
    const s = withSettings({ key: 'C', randomKey: false });
    for (let trial = 0; trial < 30; trial++) {
      const q = buildSightSingingQuestion(s, narrowWindow);
      q.targetMidis.forEach((midi) => {
        expect(midi).toBeGreaterThanOrEqual(narrowWindow.lowMidi);
        expect(midi).toBeLessThanOrEqual(narrowWindow.highMidi);
      });
    }
  });

  it('chromatic "none" yields only in-key notes', () => {
    const s = withSettings({ key: 'G', randomKey: false, chromatic: 'none', measures: 2 });
    const key = keyById('G');
    const pcs = new Set(diatonicPcs(key));
    for (let trial = 0; trial < 30; trial++) {
      const q = buildSightSingingQuestion(s, ROOT_RANGE_PRESETS.auto);
      q.targetMidis.forEach((midi) => {
        expect(pcs.has(((midi % 12) + 12) % 12)).toBe(true);
      });
    }
  });

  it('tonicMidi carries the key\'s tonic pitch class', () => {
    const s = withSettings({ key: 'D', randomKey: false });
    const key = keyById('D');
    for (let trial = 0; trial < 20; trial++) {
      const q = buildSightSingingQuestion(s, ROOT_RANGE_PRESETS.auto);
      expect(((q.tonicMidi % 12) + 12) % 12).toBe(key.tonicPc);
    }
  });
});

describe('gradeSungMelody', () => {
  const opts = { toleranceCents: 50, octaveEquivalence: false };

  it('grades all-correct when every capture matches its target within tolerance', () => {
    const targetMidis = [60, 62, 64, 65];
    const captures = [60, 62, 64, 65];
    const result = gradeSungMelody(targetMidis, captures, opts);
    expect(result.allCorrect).toBe(true);
    expect(result.tones.every((t) => t.correct)).toBe(true);
  });

  it('flags exactly the mis-sung note and reports its index via array position', () => {
    const targetMidis = [60, 62, 64, 65];
    const captures = [60, 62.9, 64, 65]; // 2nd note sharp by 90 cents
    const result = gradeSungMelody(targetMidis, captures, opts);
    expect(result.allCorrect).toBe(false);
    expect(result.tones.map((t) => t.correct)).toEqual([true, false, true, true]);
  });

  it('accepts octave-shifted notes when octaveEquivalence is on, rejects them when off', () => {
    const targetMidis = [60, 64];
    const captures = [60, 76]; // 2nd note sung an octave up (64 + 12)
    expect(gradeSungMelody(targetMidis, captures, { ...opts, octaveEquivalence: true }).allCorrect).toBe(true);
    expect(gradeSungMelody(targetMidis, captures, { ...opts, octaveEquivalence: false }).allCorrect).toBe(false);
  });

  it('reports signed per-note cents', () => {
    const targetMidis = [60, 64];
    const captures = [60, 63.5]; // 2nd note flat by 50 cents
    const result = gradeSungMelody(targetMidis, captures, opts);
    expect(result.tones[1]!.centsOff).toBeCloseTo(-50, 5);
  });
});

describe('settings mapping — fixed dictation fields', () => {
  it('always maps to treble clef, 4/4, quarter/eighth-only durations, no rests, no syncopation', () => {
    // Indirect assertion via generated output: no rests appear (targetMidis
    // length equals the number of onsets VexFlow would actually render), and
    // every note duration is either a quarter or an eighth.
    const s = withSettings({ measures: 2 });
    for (let trial = 0; trial < 20; trial++) {
      const q = buildSightSingingQuestion(s, ROOT_RANGE_PRESETS.auto);
      expect(q.melody.clef).toBe('treble');
      expect(`${q.melody.timeSig.beatsPerBar}/${q.melody.timeSig.beatValue}`).toBe('4/4');
      q.melody.measures.forEach((bar) => {
        bar.forEach((n) => {
          expect(n.rest).toBe(false);
          expect([1, 0.5]).toContain(n.duration);
        });
      });
    }
  });
});
