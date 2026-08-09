import { describe, expect, it } from 'vitest';
import {
  RECOGNITION_MAX_TOP_MIDI,
  SCALE_RECOGNITION_TYPES,
  buildScaleExamChoiceGrouped,
  buildScalePlaybackMidis,
  buildScaleQuestion,
  defaultScaleRecognitionSettings,
  pickScaleQuestion,
  pickScaleRootMidi,
} from './scales';

describe('defaultScaleRecognitionSettings', () => {
  it('enables exactly the legacy-default scales, ascending only', () => {
    const defaults = defaultScaleRecognitionSettings();
    expect(defaults.enabledScales.sort()).toEqual(['aeolian', 'dorian', 'ionian', 'mixolydian'].sort());
    expect(defaults.descend).toBe(false);
  });
});

describe('scale catalogue coverage', () => {
  // The scales the aural exercise must offer, per group.
  const required: Record<string, string[]> = {
    majorModes: ['Ionian (major)', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 'Aeolian', 'Locrian'],
    melodicMinorModes: ['Lydian dominant', 'Locrian ♯2', 'Altered scale'],
    minorScales: ['Harmonic minor', 'Jazz minor'],
    fiveSixNote: ['Major pentatonic', 'Minor pentatonic', 'Blues scale', 'Whole tone'],
    eightNote: [
      'Major bebop',
      'Dominant bebop',
      'Minor bebop',
      'Jazz minor bebop',
      'Dominant 8 note / Half-Whole diminished',
      'Diminished (whole–half)',
    ],
  };

  for (const [group, labels] of Object.entries(required)) {
    for (const label of labels) {
      it(`offers "${label}" in ${group}`, () => {
        const found = SCALE_RECOGNITION_TYPES.find((t) => t.label === label);
        expect(found, `missing scale "${label}"`).toBeTruthy();
        expect(found?.group).toBe(group);
      });
    }
  }

  it('separates the two melodic-minor extras with a divider before Dorian ♭2', () => {
    const group = SCALE_RECOGNITION_TYPES.filter((t) => t.group === 'melodicMinorModes');
    const spec = ['lydianDominant', 'locrianSharp2', 'altered'];
    const extras = ['dorianFlat2', 'mixolydianFlat6'];
    // The three spec'd modes come first, then the two extras.
    expect(group.map((t) => t.id)).toEqual([...spec, ...extras]);
    const dorian = group.find((t) => t.id === 'dorianFlat2');
    expect(dorian?.dividerBefore).toBe(true);
  });

  it('flags the divider in the choice grid only when preceded by an enabled item', () => {
    const withPreceding = buildScaleExamChoiceGrouped(['lydianDominant', 'dorianFlat2']);
    const mm1 = withPreceding.find((g) => g.title === 'Melodic minor modes')!;
    expect(mm1.items.find((it) => it.id === 'dorianFlat2')?.dividerBefore).toBe(true);

    // Divider suppressed when the extra is the first visible chip in its group.
    const dorianFirst = buildScaleExamChoiceGrouped(['dorianFlat2', 'mixolydianFlat6']);
    const mm2 = dorianFirst.find((g) => g.title === 'Melodic minor modes')!;
    expect(mm2.items[0]?.dividerBefore).toBeFalsy();
  });
});

describe('buildScalePlaybackMidis', () => {
  it('plays up to and including the octave, ascending only by default', () => {
    const midis = buildScalePlaybackMidis(60, [0, 2, 4, 5, 7, 9, 11], false);
    expect(midis).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
  });

  it('appends the descent (excluding the octave repeat) when descend is true', () => {
    const midis = buildScalePlaybackMidis(60, [0, 2, 4, 5, 7, 9, 11], true);
    expect(midis).toEqual([60, 62, 64, 65, 67, 69, 71, 72, 71, 69, 67, 65, 64, 62, 60]);
  });
});

describe('pickScaleRootMidi', () => {
  it('keeps the scale top at or below RECOGNITION_MAX_TOP_MIDI', () => {
    const intervals = [0, 2, 4, 5, 7, 9, 11]; // span 12 after octave
    for (let i = 0; i < 30; i++) {
      const root = pickScaleRootMidi(intervals);
      expect(root + 12).toBeLessThanOrEqual(RECOGNITION_MAX_TOP_MIDI);
    }
  });

  it('produces at least 2 distinct roots across 10 draws with one scale enabled', () => {
    const roots = new Set<number>();
    for (let i = 0; i < 10; i++) {
      roots.add(pickScaleRootMidi([0, 2, 4, 5, 7, 9, 11]));
    }
    expect(roots.size).toBeGreaterThanOrEqual(2);
  });
});

describe('buildScaleQuestion / pickScaleQuestion', () => {
  it('returns null when nothing is enabled', () => {
    const settings = { ...defaultScaleRecognitionSettings(), enabledScales: [] };
    expect(pickScaleQuestion(settings)).toBeNull();
    expect(buildScaleQuestion(settings)).toBeNull();
  });

  it('always draws from enabledScales and groups choices to match', () => {
    const settings = defaultScaleRecognitionSettings();
    for (let i = 0; i < 30; i++) {
      const q = pickScaleQuestion(settings);
      expect(q).not.toBeNull();
      if (!q) continue;
      expect(settings.enabledScales).toContain(q.id);
      const allChoiceIds = q.choiceGrouped.flatMap((g) => g.items.map((it) => it.id));
      expect(allChoiceIds.sort()).toEqual([...settings.enabledScales].sort());
    }
  });
});
