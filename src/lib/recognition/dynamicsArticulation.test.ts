import { afterEach, describe, expect, it } from 'vitest';
import { setRng } from '../theory';
import {
  ARTICULATION_TABLE,
  DA_VELOCITY_GAP,
  buildDynamicsArticulationQuestion,
  buildPhrase,
  defaultDynamicsArticulationSettings,
  type ArticulationId,
  type ArticulationQuestion,
  type DADifficulty,
  type DASettings,
  type DynamicsQuestion,
} from './dynamicsArticulation';

afterEach(() => setRng());

const MAJOR_SCALE_STEPS = [0, 2, 4, 5, 7, 9, 11];

function withSettings(overrides: Partial<DASettings> = {}): DASettings {
  return { ...defaultDynamicsArticulationSettings(), ...overrides };
}

// buildPhrase's root can be any of the 12 pitch classes (the phrase is
// diatonic to whatever major scale that root implies, not necessarily C
// major), so "diatonic" is checked as "explainable by *some* major scale"
// rather than against a fixed C-major pitch-class set.
function isDiatonicToSomeMajorScale(midis: number[]): boolean {
  const pcs = new Set(midis.map((m) => ((m % 12) + 12) % 12));
  for (let rootPc = 0; rootPc < 12; rootPc++) {
    const scalePcs = new Set(MAJOR_SCALE_STEPS.map((s) => (rootPc + s) % 12));
    if ([...pcs].every((pc) => scalePcs.has(pc))) return true;
  }
  return false;
}

describe('buildPhrase', () => {
  it('always returns exactly phraseLen notes', () => {
    [3, 4, 5].forEach((phraseLen) => {
      for (let trial = 0; trial < 50; trial++) {
        expect(buildPhrase(phraseLen)).toHaveLength(phraseLen);
      }
    });
  });

  it('every note is diatonic to a major scale', () => {
    for (let trial = 0; trial < 200; trial++) {
      const phrase = buildPhrase(5);
      expect(isDiatonicToSomeMajorScale(phrase)).toBe(true);
    }
  });

  it('moves by a single scale step except for at most one leap of a third', () => {
    for (let trial = 0; trial < 300; trial++) {
      const phrase = buildPhrase(6);
      // Reconstruct scale-degree deltas is awkward from MIDI alone (steps
      // aren't uniform semitones); instead assert consecutive semitone
      // gaps are one of the plausible step/leap sizes a diatonic walk
      // produces, and that "leap-sized" gaps (>=3 semitones) occur at most once.
      let leapCount = 0;
      for (let i = 1; i < phrase.length; i++) {
        const gap = Math.abs(phrase[i]! - phrase[i - 1]!);
        expect(gap).toBeGreaterThan(0);
        expect(gap).toBeLessThanOrEqual(4); // a third is at most 4 semitones (major 3rd)
        if (gap >= 3) leapCount++;
      }
      expect(leapCount).toBeLessThanOrEqual(1);
    }
  });
});

describe('buildDynamicsArticulationQuestion — dynamics mode', () => {
  (['easy', 'medium', 'hard'] as const).forEach((difficulty: DADifficulty) => {
    it(`velocity gap is exactly 0 (same) or the ${difficulty} gap across 500 questions`, () => {
      const s = withSettings({ mode: 'dynamics', difficulty });
      for (let trial = 0; trial < 500; trial++) {
        const q = buildDynamicsArticulationQuestion(s) as DynamicsQuestion;
        const gap = Math.abs(q.velocityB - q.velocityA);
        if (q.answerId === 'same') {
          expect(gap).toBe(0);
          expect(q.velocityB).toBe(q.velocityA);
        } else {
          expect(gap).toBeCloseTo(DA_VELOCITY_GAP[difficulty], 10);
        }
      }
    });
  });

  it('answerId matches the actual velocity direction', () => {
    const s = withSettings({ mode: 'dynamics' });
    for (let trial = 0; trial < 300; trial++) {
      const q = buildDynamicsArticulationQuestion(s) as DynamicsQuestion;
      if (q.answerId === 'louder') expect(q.velocityB).toBeGreaterThan(q.velocityA);
      else if (q.answerId === 'softer') expect(q.velocityB).toBeLessThan(q.velocityA);
      else expect(q.velocityB).toBe(q.velocityA);
    }
  });

  it('same/louder/softer each occur within sane bounds across many trials', () => {
    const s = withSettings({ mode: 'dynamics' });
    const counts = { louder: 0, softer: 0, same: 0 };
    const iterations = 3000;
    for (let i = 0; i < iterations; i++) {
      counts[(buildDynamicsArticulationQuestion(s) as DynamicsQuestion).answerId]++;
    }
    expect(counts.same / iterations).toBeGreaterThan(0.25);
    expect(counts.same / iterations).toBeLessThan(0.42);
  });

  it('both velocities always stay inside the comfortable window regardless of gap size', () => {
    const s = withSettings({ mode: 'dynamics', difficulty: 'easy' }); // largest gap -> most likely to need the reflect
    for (let trial = 0; trial < 1000; trial++) {
      const q = buildDynamicsArticulationQuestion(s) as DynamicsQuestion;
      [q.velocityA, q.velocityB].forEach((v) => {
        expect(v).toBeGreaterThanOrEqual(0.15);
        expect(v).toBeLessThanOrEqual(0.95);
      });
    }
  });

  it('reflects rather than clamps: the gap never shrinks below the difficulty value even when the base sits near an edge', () => {
    // A fixed rng near 1 pushes velocityA to BASE_VELOCITY_MAX (0.75) and
    // biases the louder/softer coin-flip toward "louder" every time. At the
    // easy gap (0.30), base + gap = 1.05 — outside the window — so a naive
    // "clamp to 0.95" would shrink the gap to only 0.20. The reflect logic
    // must instead place velocityB on the other side, at exactly base - gap,
    // preserving the full 0.30 gap every time.
    setRng(() => 0.999);
    const s = withSettings({ mode: 'dynamics', difficulty: 'easy' });
    for (let trial = 0; trial < 20; trial++) {
      const q = buildDynamicsArticulationQuestion(s) as DynamicsQuestion;
      if (q.answerId !== 'same') {
        expect(Math.abs(q.velocityB - q.velocityA)).toBeCloseTo(DA_VELOCITY_GAP.easy, 10);
      }
    }
  });
});

describe('buildDynamicsArticulationQuestion — articulation mode', () => {
  it('only produces enabled articulations', () => {
    const enabled: ArticulationId[] = ['staccato', 'legato'];
    const s = withSettings({ mode: 'articulation', enabledArticulations: enabled });
    for (let trial = 0; trial < 200; trial++) {
      const q = buildDynamicsArticulationQuestion(s) as ArticulationQuestion;
      expect(enabled).toContain(q.articulationId);
    }
  });

  it('returns null when fewer than 2 articulations are enabled', () => {
    const s = withSettings({ mode: 'articulation', enabledArticulations: ['staccato'] });
    expect(buildDynamicsArticulationQuestion(s)).toBeNull();
  });

  it('choiceDefs only include the enabled articulations', () => {
    const enabled: ArticulationId[] = ['accented', 'tenuto'];
    const s = withSettings({ mode: 'articulation', enabledArticulations: enabled });
    const q = buildDynamicsArticulationQuestion(s) as ArticulationQuestion;
    expect(q.choiceDefs.map((c) => c.id).sort()).toEqual([...enabled].sort());
  });
});

describe('ARTICULATION_TABLE — integrity', () => {
  it('every entry has a duration fraction and a velocity', () => {
    ARTICULATION_TABLE.forEach((a) => {
      expect(typeof a.noteLenFraction).toBe('number');
      expect(a.noteLenFraction).toBeGreaterThan(0);
      expect(typeof a.velocity).toBe('number');
      expect(a.velocity).toBeGreaterThan(0);
      expect(a.velocity).toBeLessThanOrEqual(1);
    });
  });

  it('covers exactly the four documented articulations', () => {
    expect(ARTICULATION_TABLE.map((a) => a.id).sort()).toEqual(['accented', 'legato', 'staccato', 'tenuto']);
  });
});
