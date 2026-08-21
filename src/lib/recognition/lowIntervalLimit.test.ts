import { describe, expect, it } from 'vitest';
import { LIL_LOWER_LIMIT_MIDI, lowIntervalLimitMidi } from './lowIntervalLimit';
import { CHORD_ROOT_MIDI_MIN, getChordRecognitionMidis, minRootForChord } from './chords';

// The rule mirrors the arranging course's coded Principle 1 (src/lib/arranging/
// rules.ts): an interval SMALLER than a major 3rd must not sit below C3; a major
// 3rd or wider is permitted lower.
describe('lowIntervalLimitMidi', () => {
  it('holds intervals smaller than a major 3rd at C3', () => {
    expect(lowIntervalLimitMidi(1)).toBe(LIL_LOWER_LIMIT_MIDI); // m2
    expect(lowIntervalLimitMidi(2)).toBe(LIL_LOWER_LIMIT_MIDI); // M2
    expect(lowIntervalLimitMidi(3)).toBe(LIL_LOWER_LIMIT_MIDI); // m3
    expect(LIL_LOWER_LIMIT_MIDI).toBe(48); // C3
  });

  it('imposes no floor on a major 3rd or wider', () => {
    expect(lowIntervalLimitMidi(4)).toBe(0); // M3
    expect(lowIntervalLimitMidi(5)).toBe(0); // P4
    expect(lowIntervalLimitMidi(7)).toBe(0); // P5
  });
});

describe('minRootForChord', () => {
  it('lifts sub-major-3rd-bottomed chords to C3, leaves the rest at the C2 floor', () => {
    // Minor 3rd on the bottom → held at C3.
    expect(minRootForChord('m')).toBe(48); // C3
    expect(minRootForChord('dim')).toBe(48);
    expect(minRootForChord('m7')).toBe(48);
    // Major 2nd on the bottom (sus2) → also held at C3.
    expect(minRootForChord('sus2')).toBe(48);
    // Major 3rd / perfect 4th on the bottom → permitted down to the C2 floor.
    expect(minRootForChord('maj')).toBe(CHORD_ROOT_MIDI_MIN); // 36, C2
    expect(minRootForChord('7')).toBe(CHORD_ROOT_MIDI_MIN);
    expect(minRootForChord('sus4')).toBe(CHORD_ROOT_MIDI_MIN);
  });

  it('never voices a sub-major-3rd bottom interval below C3', () => {
    for (const q of ['m', 'dim', 'sus2', 'm7', 'm7b5', 'dim7', 'm6', 'mMaj7']) {
      const root = minRootForChord(q);
      const midis = getChordRecognitionMidis(root, q);
      const bottomInterval = midis[1]! - midis[0]!;
      if (bottomInterval < 4) expect(midis[0]!).toBeGreaterThanOrEqual(48);
      expect(root).toBeGreaterThanOrEqual(CHORD_ROOT_MIDI_MIN);
    }
  });

  it('accounts for the raised bass of an inversion', () => {
    // maj7 1st inversion puts a m3 (3rd→5th) on the bottom, so the sounding bass
    // must clear C3 even though the nominal root may sit lower.
    const root = minRootForChord('maj7', 1);
    const midis = getChordRecognitionMidis(root, 'maj7', 1);
    const bottomInterval = midis[1]! - midis[0]!;
    if (bottomInterval < 4) expect(midis[0]!).toBeGreaterThanOrEqual(48);
  });
});
