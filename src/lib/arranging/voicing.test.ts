import { describe, expect, it } from 'vitest';
import { parseChord } from './chord';
import { pitchClass } from './pitch';
import {
  analyse,
  applySkipRule,
  buildClose,
  buildVoicing,
  type MechanicalVoicingType,
} from './voicing';

const QUALITIES = ['ma7', 'mi7', '7', 'mi7b5'];
const ROOTS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const MECHANICAL: MechanicalVoicingType[] = ['close', 'drop-2', 'drop-3', 'drop-2+4', 'close-doubled'];

describe('voicing round-trip (spec §9)', () => {
  it('buildVoicing → analyse detects the declared type across qualities, roots and chord-tone leads', () => {
    for (const root of ROOTS) {
      for (const q of QUALITIES) {
        const chord = parseChord(root + q)!;
        const close = buildClose(chord, 72); // lead near C5
        for (const leadMidi of close) {
          for (const type of MECHANICAL) {
            const v = buildVoicing({ chord, leadMidi, type });
            const a = analyse(v);
            expect(a.detectedTypes, `${root}${q} ${type} lead ${leadMidi}`).toContain(type);
          }
        }
      }
    }
  });
});

describe('mechanical voicings', () => {
  it('close voicing sits within an octave; drop 2 does not', () => {
    const chord = parseChord('C7')!;
    const close = buildVoicing({ chord, leadMidi: 70, type: 'close' }); // Bb lead
    expect(analyse(close).isWithinOctave).toBe(true);
    const drop2 = buildVoicing({ chord, leadMidi: 70, type: 'drop-2' });
    expect(analyse(drop2).isWithinOctave).toBe(false);
  });

  it('lead is always the top voice', () => {
    const chord = parseChord('Fma7')!;
    for (const type of MECHANICAL) {
      const v = buildVoicing({ chord, leadMidi: 69, type });
      expect(Math.max(...v.pitches)).toBe(v.pitches[0]);
      expect(v.pitches[0]).toBe(69);
    }
  });

  it('close-doubled has five pitches, four distinct', () => {
    const chord = parseChord('C7')!;
    const v = buildVoicing({ chord, leadMidi: 72, type: 'close-doubled' });
    expect(v.pitches.length).toBe(5);
    expect(new Set(v.pitches.map(pitchClass)).size).toBe(4);
  });
});

describe('SKIP rule', () => {
  it('skips the chord tone immediately beneath a non-chord-tone lead', () => {
    const chord = parseChord('C7')!; // tones C E G Bb
    // Lead = D (non-chord tone, the 9th) at 74. Immediately beneath is C (72) — skipped.
    const pitches = applySkipRule(chord, 74);
    expect(pitches[0]).toBe(74); // lead on top
    expect(pitches.map(pitchClass)).not.toContain(pitchClass(72)); // C skipped
  });
});
