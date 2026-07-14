import { describe, expect, it } from 'vitest';
import {
  CHORD_RECOGNITION_TYPES,
  CHORD_ROOT_MIDI_MAX,
  CHORD_ROOT_MIDI_MIN,
  buildChordQuestion,
  defaultChordRecognitionSettings,
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
