import { afterEach, describe, expect, it } from 'vitest';
import { setRng } from '../theory';
import { CHORD_RECOGNITION_RECIPES } from '../recognition/chords';
import { ROOT_RANGE_PRESETS, type RootRangeWindow } from './question';
import {
  CHORD_SINGING_ALLOWED_IDS,
  buildChordSingingQuestion,
  defaultChordSingingSettings,
  gradeArpeggio,
  type ChordSingingSettings,
} from './chordSinging';

afterEach(() => setRng());

describe('CHORD_SINGING_ALLOWED_IDS — singable subset', () => {
  it('every allowed id has a recipe of at most 4 tones', () => {
    CHORD_SINGING_ALLOWED_IDS.forEach((id) => {
      const recipe = CHORD_RECOGNITION_RECIPES[id];
      expect(recipe, `${id} should have a recipe`).toBeDefined();
      expect(recipe!.length).toBeLessThanOrEqual(4);
    });
  });
});

function withEnabled(overrides: Partial<ChordSingingSettings> = {}): ChordSingingSettings {
  return { ...defaultChordSingingSettings(), enabledTypes: [...CHORD_SINGING_ALLOWED_IDS], ...overrides };
}

describe('buildChordSingingQuestion', () => {
  it('returns null when no enabled quality is in the singable subset', () => {
    const s: ChordSingingSettings = { ...defaultChordSingingSettings(), enabledTypes: ['maj9', 'm9'] };
    expect(buildChordSingingQuestion(s, ROOT_RANGE_PRESETS.auto)).toBeNull();
  });

  it('tone sequence matches the recipe (ascending) for every allowed quality, direction "up"', () => {
    CHORD_SINGING_ALLOWED_IDS.forEach((id) => {
      const s = withEnabled({ enabledTypes: [id], direction: 'up' });
      const q = buildChordSingingQuestion(s, ROOT_RANGE_PRESETS.auto)!;
      expect(q.qualityId).toBe(id);
      expect(q.toneOffsets).toEqual(CHORD_RECOGNITION_RECIPES[id]);
    });
  });

  it('direction "down" reverses the tone sequence (highest tone first)', () => {
    const s = withEnabled({ enabledTypes: ['m7'], direction: 'down' });
    const q = buildChordSingingQuestion(s, ROOT_RANGE_PRESETS.auto)!;
    expect(q.toneOffsets).toEqual([...CHORD_RECOGNITION_RECIPES.m7!].reverse());
  });

  it('direction "both" resolves to either up or down per question', () => {
    const s = withEnabled({ enabledTypes: ['maj7'], direction: 'both' });
    const seen = new Set<string>();
    for (let trial = 0; trial < 100; trial++) {
      const q = buildChordSingingQuestion(s, ROOT_RANGE_PRESETS.auto)!;
      seen.add(JSON.stringify(q.toneOffsets));
    }
    expect(seen.size).toBe(2); // ascending and its reverse
  });

  it('keeps root and the highest chord tone inside the range window for every quality and preset', () => {
    (Object.keys(ROOT_RANGE_PRESETS) as (keyof typeof ROOT_RANGE_PRESETS)[]).forEach((presetName) => {
      const range = ROOT_RANGE_PRESETS[presetName];
      CHORD_SINGING_ALLOWED_IDS.forEach((id) => {
        const s = withEnabled({ enabledTypes: [id] });
        for (let trial = 0; trial < 20; trial++) {
          const q = buildChordSingingQuestion(s, range)!;
          expect(q.rootMidi).toBeGreaterThanOrEqual(range.lowMidi);
          expect(q.rootMidi).toBeLessThanOrEqual(range.highMidi);
          const topMidi = q.rootMidi + Math.max(...q.toneOffsets);
          expect(topMidi).toBeLessThanOrEqual(range.highMidi);
        }
      });
    });
  });

  it('falls back to anchoring at the range low end when the quality is too wide to fit anywhere else', () => {
    const narrowRange: RootRangeWindow = { lowMidi: 60, highMidi: 61 }; // span of 1 semitone
    const s = withEnabled({ enabledTypes: ['maj7'] }); // needs 11 semitones of headroom
    const q = buildChordSingingQuestion(s, narrowRange)!;
    expect(q.rootMidi).toBe(narrowRange.lowMidi);
  });
});

describe('gradeArpeggio', () => {
  const opts = { toleranceCents: 50, octaveEquivalence: false };

  it('grades all-correct when every capture matches its target within tolerance', () => {
    const rootMidi = 60; // C4
    const toneOffsets = [0, 4, 7]; // maj triad
    const captures = [60, 64, 67];
    const result = gradeArpeggio(rootMidi, toneOffsets, captures, opts);
    expect(result.allCorrect).toBe(true);
    expect(result.tones.every((t) => t.correct)).toBe(true);
  });

  it('flags exactly the mis-sung tone when one is off', () => {
    const rootMidi = 60;
    const toneOffsets = [0, 4, 7];
    const captures = [60, 64.9, 67]; // 3rd flat by 90 cents, outside 50c tolerance
    const result = gradeArpeggio(rootMidi, toneOffsets, captures, opts);
    expect(result.allCorrect).toBe(false);
    expect(result.tones[0]!.correct).toBe(true);
    expect(result.tones[1]!.correct).toBe(false);
    expect(result.tones[2]!.correct).toBe(true);
  });

  it('accepts octave-shifted tones when octaveEquivalence is on, rejects them when off', () => {
    const rootMidi = 60;
    const toneOffsets = [0, 4, 7];
    const captures = [60, 64, 79]; // 5th sung an octave up (67 + 12)
    const withEquivalence = gradeArpeggio(rootMidi, toneOffsets, captures, { ...opts, octaveEquivalence: true });
    expect(withEquivalence.allCorrect).toBe(true);

    const withoutEquivalence = gradeArpeggio(rootMidi, toneOffsets, captures, { ...opts, octaveEquivalence: false });
    expect(withoutEquivalence.allCorrect).toBe(false);
    expect(withoutEquivalence.tones[2]!.correct).toBe(false);
  });

  it('reports signed per-tone cents so feedback can name which way each tone missed', () => {
    const rootMidi = 60;
    const toneOffsets = [0, 4];
    const captures = [60, 63.5]; // 3rd flat by 50 cents
    const result = gradeArpeggio(rootMidi, toneOffsets, captures, opts);
    expect(result.tones[1]!.centsOff).toBeCloseTo(-50, 5);
  });
});
