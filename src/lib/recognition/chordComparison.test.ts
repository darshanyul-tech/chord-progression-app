import { afterEach, describe, expect, it } from 'vitest';
import { setRng } from '../theory';
import { CHORD_ROOT_MIDI_MAX, CHORD_ROOT_MIDI_MIN, CHORD_RECOGNITION_TYPES, chordTypeById } from './chords';
import {
  CHORD_CONFUSION_TIER_1,
  CHORD_CONFUSION_TIER_2,
  CHORD_CONFUSION_TIER_3,
  buildChordComparisonQuestion,
  defaultChordComparisonSettings,
  eligibleConfusionPairs,
  getChordComparisonChoiceDefs,
  type ChordComparisonSettings,
} from './chordComparison';

afterEach(() => setRng());

const ALL_TIERS = [CHORD_CONFUSION_TIER_1, CHORD_CONFUSION_TIER_2, CHORD_CONFUSION_TIER_3];
const ALL_PAIRS = ALL_TIERS.flat();

describe('confusion tables — integrity', () => {
  it('every referenced id exists in CHORD_RECOGNITION_TYPES', () => {
    ALL_PAIRS.forEach((p) => {
      expect(chordTypeById(p.a), `${p.a} should exist`).toBeDefined();
      expect(chordTypeById(p.b), `${p.b} should exist`).toBeDefined();
    });
  });

  it('has no self-pairs', () => {
    ALL_PAIRS.forEach((p) => {
      expect(p.a).not.toBe(p.b);
    });
  });

  it('no unordered pair appears in two tiers', () => {
    const seen = new Set<string>();
    ALL_TIERS.forEach((tier) => {
      tier.forEach((p) => {
        const key = [p.a, p.b].sort().join('|');
        expect(seen.has(key), `${key} duplicated across tiers`).toBe(false);
        seen.add(key);
      });
    });
  });
});

function allEnabled(): string[] {
  return CHORD_RECOGNITION_TYPES.map((t) => t.id);
}

function withAllEnabled(overrides: Partial<ChordComparisonSettings> = {}): ChordComparisonSettings {
  return { ...defaultChordComparisonSettings(), enabledTypes: allEnabled(), ...overrides };
}

describe('eligibleConfusionPairs', () => {
  it('difficulty is cumulative — tier 2 includes tier 1 pairs, tier 3 includes tier 1+2', () => {
    const pairs1 = eligibleConfusionPairs(1, allEnabled());
    const pairs2 = eligibleConfusionPairs(2, allEnabled());
    const pairs3 = eligibleConfusionPairs(3, allEnabled());
    expect(pairs1.length).toBe(CHORD_CONFUSION_TIER_1.length);
    expect(pairs2.length).toBe(CHORD_CONFUSION_TIER_1.length + CHORD_CONFUSION_TIER_2.length);
    expect(pairs3.length).toBe(CHORD_CONFUSION_TIER_1.length + CHORD_CONFUSION_TIER_2.length + CHORD_CONFUSION_TIER_3.length);
  });

  it('a pair is only eligible when both qualities are enabled', () => {
    const enabled = ['maj', 'dim']; // covers only maj<->dim from tier 1
    const pairs = eligibleConfusionPairs(1, enabled);
    expect(pairs).toEqual([{ a: 'maj', b: 'dim' }]);
  });

  it('disabling one quality of a pair removes that pair', () => {
    const withM = eligibleConfusionPairs(1, ['maj', 'm', 'dim']);
    expect(withM.some((p) => (p.a === 'maj' && p.b === 'm') || (p.a === 'm' && p.b === 'maj'))).toBe(true);
    const withoutM = eligibleConfusionPairs(1, ['maj', 'dim']);
    expect(withoutM.some((p) => p.a === 'm' || p.b === 'm')).toBe(false);
  });
});

describe('buildChordComparisonQuestion', () => {
  it('returns null when no confusion pair is eligible', () => {
    const s = withAllEnabled({ enabledTypes: ['maj'] }); // needs >=2 qualities forming a pair
    expect(buildChordComparisonQuestion(s)).toBeNull();
  });

  it('"different" questions always come from an eligible tier at the current difficulty', () => {
    const s = withAllEnabled({ difficulty: 1 });
    const eligible = eligibleConfusionPairs(1, s.enabledTypes);
    const eligibleKeys = new Set(eligible.map((p) => [p.a, p.b].sort().join('|')));
    for (let trial = 0; trial < 500; trial++) {
      const q = buildChordComparisonQuestion(s)!;
      if (q.answerId === 'different') {
        const key = [q.first.typeId, q.second.typeId].sort().join('|');
        expect(eligibleKeys.has(key)).toBe(true);
      } else {
        expect(q.first.typeId).toBe(q.second.typeId);
      }
    }
  });

  it('same/different is roughly 50/50 across many trials', () => {
    const s = withAllEnabled({ difficulty: 3 });
    let sameCount = 0;
    const iterations = 2000;
    for (let i = 0; i < iterations; i++) {
      const q = buildChordComparisonQuestion(s)!;
      if (q.answerId === 'same') sameCount++;
    }
    const ratio = sameCount / iterations;
    expect(ratio).toBeGreaterThan(0.4);
    expect(ratio).toBeLessThan(0.6);
  });

  it('root B === root A when rootRelationship is "same"', () => {
    const s = withAllEnabled({ rootRelationship: 'same' });
    for (let trial = 0; trial < 200; trial++) {
      const q = buildChordComparisonQuestion(s)!;
      expect(q.second.rootMidi).toBe(q.first.rootMidi);
    }
  });

  it('transposed mode: root B !== root A, offset within +-5, and both roots stay in the register window', () => {
    const s = withAllEnabled({ rootRelationship: 'transposed' });
    for (let trial = 0; trial < 500; trial++) {
      const q = buildChordComparisonQuestion(s)!;
      expect(q.second.rootMidi).not.toBe(q.first.rootMidi);
      const offset = Math.abs(q.second.rootMidi - q.first.rootMidi);
      expect(offset).toBeGreaterThanOrEqual(1);
      expect(offset).toBeLessThanOrEqual(5);
      expect(q.first.rootMidi).toBeGreaterThanOrEqual(CHORD_ROOT_MIDI_MIN);
      expect(q.first.rootMidi).toBeLessThanOrEqual(CHORD_ROOT_MIDI_MAX);
      expect(q.second.rootMidi).toBeGreaterThanOrEqual(CHORD_ROOT_MIDI_MIN);
      expect(q.second.rootMidi).toBeLessThanOrEqual(CHORD_ROOT_MIDI_MAX);
    }
  });

  it('never produces a transposed root outside the register window even when root A sits at an extreme', () => {
    // Force pickChordRootMidi's Math.floor(random()*12) to 0 and the chosen
    // root candidate to the lowest option by biasing rng toward 0.
    setRng(() => 0);
    const s = withAllEnabled({ rootRelationship: 'transposed' });
    for (let trial = 0; trial < 50; trial++) {
      const q = buildChordComparisonQuestion(s)!;
      expect(q.first.rootMidi).toBe(CHORD_ROOT_MIDI_MIN);
      expect(q.second.rootMidi).toBeGreaterThanOrEqual(CHORD_ROOT_MIDI_MIN);
      expect(q.second.rootMidi).toBeLessThanOrEqual(CHORD_ROOT_MIDI_MAX);
      expect(q.second.rootMidi).not.toBe(q.first.rootMidi);
    }
  });
});

describe('getChordComparisonChoiceDefs', () => {
  it('is always Same/Different', () => {
    expect(getChordComparisonChoiceDefs().map((c) => c.id)).toEqual(['same', 'different']);
  });
});

describe('defaultChordComparisonSettings', () => {
  it('matches chord recognition defaults (maj, m, maj7, m7, 7)', () => {
    const s = defaultChordComparisonSettings();
    expect(new Set(s.enabledTypes)).toEqual(new Set(['maj', 'm', 'maj7', 'm7', '7']));
  });
});
