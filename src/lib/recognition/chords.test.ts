import { describe, expect, it } from 'vitest';
import {
  CHORD_RECOGNITION_GROUPS,
  CHORD_RECOGNITION_TYPES,
  CHORD_ROOT_MIDI_MAX,
  CHORD_ROOT_MIDI_MIN,
  buildChordChoiceGroups,
  buildChordExamChoiceGrouped,
  buildChordQuestion,
  defaultChordRecognitionSettings,
  enabledInversionCombos,
  getChordRecognitionMidis,
  pickChordQuestion,
  pickChordRootMidi,
} from './chords';

describe('defaultChordRecognitionSettings', () => {
  it('enables exactly the legacy-default chord types', () => {
    const defaults = defaultChordRecognitionSettings();
    expect(defaults.enabledTypes.sort()).toEqual(['7', 'm', 'm7', 'maj', 'maj7'].sort());
    expect(defaults.playbackStyle).toBe('block');
  });
});

describe('sus2 addition', () => {
  it('is present, in the triads group, off by default, and voices as 0-2-7', () => {
    const sus2 = CHORD_RECOGNITION_TYPES.find((t) => t.id === 'sus2');
    expect(sus2).toBeDefined();
    expect(sus2?.group).toBe('triads');
    expect(sus2?.default).toBe(false);
    expect(getChordRecognitionMidis(60, 'sus2')).toEqual([60, 62, 67]);
  });
});

describe('chord catalogue coverage', () => {
  // group id -> [label, expected voicing from root C (midi 60)]
  const required: Record<string, Array<[string, number[]]>> = {
    triads: [
      ['Major triad', [60, 64, 67]],
      ['Minor triad', [60, 63, 67]],
      ['Augmented', [60, 64, 68]],
      ['Diminished', [60, 63, 66]],
      ['Suspended', [60, 65, 67]],
    ],
    sixths: [
      ['Major 6', [60, 64, 67, 69]],
      ['Minor 6', [60, 63, 67, 69]],
    ],
    sevenths: [
      ['Major 7', [60, 64, 67, 71]],
      ['Minor 7', [60, 63, 67, 70]],
      ['Dominant 7', [60, 64, 67, 70]],
      ['Diminished 7', [60, 63, 66, 69]],
      ['Dominant 7 sus4', [60, 65, 67, 70]],
      ['Minor–major 7', [60, 63, 67, 71]],
    ],
    varied7: [
      ['Minor 7 ♭5', [60, 63, 66, 70]],
      ['Major 7 ♯5', [60, 64, 68, 71]],
      ['Major 7 ♭5', [60, 64, 66, 71]],
      ['Dominant 7 ♯5 (aug 7)', [60, 64, 68, 70]],
      ['Dominant 7 ♭5', [60, 64, 66, 70]],
    ],
    ninths: [
      ['Major add9', [60, 64, 67, 74]],
      ['Minor add9', [60, 63, 67, 74]],
      ['Major 9', [60, 64, 67, 71, 74]],
      ['Minor 9', [60, 63, 67, 70, 74]],
      ['Dominant 9', [60, 64, 67, 70, 74]],
      ['Dominant 9 sus4', [60, 65, 67, 70, 74]],
      ['Minor–major 9', [60, 63, 67, 71, 74]],
      ['Major 6/9', [60, 64, 67, 69, 74]],
      ['Minor 6/9', [60, 63, 67, 69, 74]],
    ],
    varied9: [
      ['Dominant 7 ♯9', [60, 64, 67, 70, 75]],
      ['Dominant 7 ♭9', [60, 64, 67, 70, 73]],
      ['Dominant 7 ♯5 ♭9', [60, 64, 68, 70, 73]],
      ['Dominant 7 ♯5 ♯9', [60, 64, 68, 70, 75]],
      ['Dominant 7 sus4 ♭9', [60, 65, 67, 70, 73]],
    ],
    elevenths: [
      ['Minor 11', [60, 63, 67, 70, 74, 77]],
      ['Dominant 11 (9sus4)', [60, 65, 67, 70, 74]],
    ],
    varied11: [
      ['Major 9 ♯11', [60, 64, 67, 71, 74, 78]],
      ['Dominant 9 ♯11', [60, 64, 67, 70, 74, 78]],
    ],
  };

  for (const [group, entries] of Object.entries(required)) {
    for (const [label, voicing] of entries) {
      it(`offers "${label}" in ${group} voiced ${voicing.join('-')}`, () => {
        const def = CHORD_RECOGNITION_TYPES.find((t) => t.label === label);
        expect(def, `missing chord "${label}"`).toBeTruthy();
        expect(def?.group).toBe(group);
        expect(getChordRecognitionMidis(60, def!.quality)).toEqual(voicing);
      });
    }
  }

  it('renders every requested group in order', () => {
    expect(CHORD_RECOGNITION_GROUPS.map((g) => g.title)).toEqual([
      'Triads',
      '6th Chords',
      '7th Chords',
      'Varied 7th Chords',
      '9th Chords',
      'Varied 9th Chords',
      '11th Chords',
      'Varied 11th Chords',
    ]);
  });

  it('marks the retained extras with a divider before them', () => {
    for (const id of ['sus2', '7alt', '13']) {
      expect(CHORD_RECOGNITION_TYPES.find((t) => t.id === id)?.dividerBefore).toBe(true);
    }
  });

  it('suppresses the choice-grid divider when the extra leads its group', () => {
    // sus2 alone in triads → no preceding chip → no divider.
    const solo = buildChordExamChoiceGrouped(['sus2']);
    expect(solo.find((g) => g.title === 'Triads')?.items[0]?.dividerBefore).toBeFalsy();
    // sus2 after Major → divider shows.
    const withMajor = buildChordExamChoiceGrouped(['maj', 'sus2']);
    const triads = withMajor.find((g) => g.title === 'Triads')!;
    expect(triads.items.find((it) => it.id === 'sus2')?.dividerBefore).toBe(true);
  });
});

describe('chord inversions', () => {
  it('voices Nth inversion by lifting the lowest tones an octave', () => {
    expect(getChordRecognitionMidis(60, 'maj7', 0)).toEqual([60, 64, 67, 71]);
    expect(getChordRecognitionMidis(60, 'maj7', 1)).toEqual([64, 67, 71, 72]); // 3rd in bass
    expect(getChordRecognitionMidis(60, 'maj7', 2)).toEqual([67, 71, 72, 76]); // 5th in bass
    expect(getChordRecognitionMidis(60, 'maj9', 3)).toEqual([71, 72, 74, 76, 79]); // 7th in bass
  });

  it('enabledInversionCombos crosses enabled chords with their subsection inversions', () => {
    const settings = {
      ...defaultChordRecognitionSettings(),
      inversionChords: ['maj7', 'm9'],
      seventhInversions: [1, 2],
      ninthInversions: [0, 3],
    };
    const combos = enabledInversionCombos(settings);
    expect(combos.map((c) => c.id)).toEqual(['inv:maj7:1', 'inv:maj7:2', 'inv:m9:0', 'inv:m9:3']);
    expect(combos.find((c) => c.id === 'inv:maj7:2')?.label).toBe('Maj7 · 2nd inv');
  });

  it('builds an inversion question whose voicing matches its quality and inversion', () => {
    const settings = {
      ...defaultChordRecognitionSettings(),
      enabledTypes: [],
      inversionChords: ['7'],
      seventhInversions: [2],
      ninthInversions: [],
    };
    const q = buildChordQuestion(settings);
    expect(q).not.toBeNull();
    expect(q!.id).toBe('inv:7:2');
    expect(q!.quality).toBe('7');
    expect(q!.inversion).toBe(2);
    // the answer grid offers exactly the enabled pool
    const ids = q!.choiceGrouped.flatMap((g) => g.items.map((it) => it.id));
    expect(ids).toEqual(['inv:7:2']);
  });

  it('adds an Inversion chords group with a divider between 7ths and 9ths', () => {
    const settings = {
      ...defaultChordRecognitionSettings(),
      inversionChords: ['maj7', 'maj9'],
      seventhInversions: [1],
      ninthInversions: [1],
    };
    const groups = buildChordChoiceGroups(settings);
    const inv = groups.find((g) => g.title === 'Inversion chords')!;
    expect(inv.items.map((it) => it.id)).toEqual(['inv:maj7:1', 'inv:maj9:1']);
    expect(inv.items.find((it) => it.id === 'inv:maj9:1')?.dividerBefore).toBe(true);
    expect(inv.items.find((it) => it.id === 'inv:maj7:1')?.dividerBefore).toBeFalsy();
  });
});

describe('pickChordRootMidi', () => {
  it('always returns a MIDI value in range matching the requested pitch class', () => {
    for (let pc = 0; pc < 12; pc++) {
      for (let i = 0; i < 10; i++) {
        const midi = pickChordRootMidi(pc);
        expect(midi).toBeGreaterThanOrEqual(CHORD_ROOT_MIDI_MIN);
        expect(midi).toBeLessThanOrEqual(CHORD_ROOT_MIDI_MAX);
        expect(((midi % 12) + 12) % 12).toBe(pc);
      }
    }
  });
});

describe('buildChordQuestion / pickChordQuestion', () => {
  it('returns null when nothing is enabled', () => {
    const settings = { ...defaultChordRecognitionSettings(), enabledTypes: [] };
    expect(pickChordQuestion(settings)).toBeNull();
    expect(buildChordQuestion(settings)).toBeNull();
  });

  it('always draws from enabledTypes and groups choices to match', () => {
    const settings = defaultChordRecognitionSettings();
    for (let i = 0; i < 30; i++) {
      const q = pickChordQuestion(settings);
      expect(q).not.toBeNull();
      if (!q) continue;
      expect(settings.enabledTypes).toContain(q.id);
      const allChoiceIds = q.choiceGrouped.flatMap((g) => g.items.map((it) => it.id));
      expect(allChoiceIds.sort()).toEqual([...settings.enabledTypes].sort());
    }
  });
});
