import { describe, expect, it } from 'vitest';
import {
  diatonicPcs,
  keyById,
  lineToLetterOctave,
  naturalMidiFor,
  resolveRangeWindow,
  resolveStaffPosition,
  scaleDegreePool,
  staffLineFor,
} from './theory';

describe('diatonicPcs', () => {
  it('C major and A minor share the same 7 pitch classes (relative keys, same signature)', () => {
    expect(diatonicPcs(keyById('C')).sort((a, b) => a - b)).toEqual(diatonicPcs(keyById('Am')).sort((a, b) => a - b));
  });

  it('every key has exactly 7 distinct diatonic pitch classes', () => {
    ['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb', 'Ab', 'Am', 'Em', 'Dm', 'Gm', 'Cm'].forEach((id) => {
      expect(new Set(diatonicPcs(keyById(id))).size).toBe(7);
    });
  });
});

describe('resolveRangeWindow', () => {
  it('anchors the tonic within the clef reference band and extends by the requested span', () => {
    const w = resolveRangeWindow(keyById('C'), 'treble', 'narrow');
    expect(w.lowMidi).toBe(60); // C4
    expect(w.highMidi - w.lowMidi).toBe(12);
    const wide = resolveRangeWindow(keyById('C'), 'bass', 'wide');
    expect(wide.lowMidi).toBe(48); // C3
    expect(wide.highMidi - wide.lowMidi).toBe(24);
  });
});

describe('scaleDegreePool', () => {
  it('only contains midis whose pitch class is diatonic to the key', () => {
    const key = keyById('G');
    const pcs = new Set(diatonicPcs(key));
    const pool = scaleDegreePool(key, 60, 72);
    pool.forEach((m) => expect(pcs.has(((m % 12) + 12) % 12)).toBe(true));
    expect(pool.length).toBeGreaterThan(0);
  });
});

describe('staffLineFor / lineToLetterOctave round-trip (B7)', () => {
  it('round-trips every natural letter/octave combination across the practical staff range, both clefs', () => {
    (['treble', 'bass'] as const).forEach((clef) => {
      for (let octave = 2; octave <= 6; octave++) {
        for (let letterIndex = 0; letterIndex < 7; letterIndex++) {
          const line = staffLineFor(letterIndex, octave, clef);
          const back = lineToLetterOctave(line, clef);
          expect(back).toEqual({ letterIndex, octave });
        }
      }
    });
  });

  it('known reference positions: treble bottom line = E4, top line = F5; bass bottom line = G2, top line = A3', () => {
    const letterOf = (i: number) => ['C', 'D', 'E', 'F', 'G', 'A', 'B'][i];
    const trebleBottom = lineToLetterOctave(1, 'treble');
    expect(`${letterOf(trebleBottom.letterIndex)}${trebleBottom.octave}`).toBe('E4');
    const trebleTop = lineToLetterOctave(5, 'treble');
    expect(`${letterOf(trebleTop.letterIndex)}${trebleTop.octave}`).toBe('F5');
    const bassBottom = lineToLetterOctave(1, 'bass');
    expect(`${letterOf(bassBottom.letterIndex)}${bassBottom.octave}`).toBe('G2');
    const bassTop = lineToLetterOctave(5, 'bass');
    expect(`${letterOf(bassTop.letterIndex)}${bassTop.octave}`).toBe('A3');
  });

  it('naturalMidiFor matches standard MIDI numbering (C4 = 60)', () => {
    expect(naturalMidiFor(0, 4)).toBe(60);
    expect(naturalMidiFor(6, 3)).toBe(59); // B3
  });

  it('alto/tenor C clefs (docs/14-theory-engine.md §6): middle C sits on the middle line / 4th line', () => {
    // VexFlow's own line convention: 3 = middle line, 4 = 4th line from the
    // bottom (matches Tables.clefs alto/tenor lineShift, cross-checked in
    // vexscore.test.ts's render smoke test).
    expect(staffLineFor(0, 4, 'alto')).toBe(3);
    expect(staffLineFor(0, 4, 'tenor')).toBe(4);
  });

  it('alto/tenor round-trip through lineToLetterOctave too', () => {
    (['alto', 'tenor'] as const).forEach((clef) => {
      for (let octave = 2; octave <= 6; octave++) {
        for (let letterIndex = 0; letterIndex < 7; letterIndex++) {
          const line = staffLineFor(letterIndex, octave, clef);
          expect(lineToLetterOctave(line, clef)).toEqual({ letterIndex, octave });
        }
      }
    });
  });
});

describe('resolveStaffPosition (docs/14-theory-engine.md §8, shared by VexStaffHost and the theory staff inputs)', () => {
  it('inverts the y->line mapping exactly for every staff line, both clefs', () => {
    const topLineY = 0;
    const spacing = 10;
    (['treble', 'bass', 'alto', 'tenor'] as const).forEach((clef) => {
      for (let letterIndex = 0; letterIndex < 7; letterIndex++) {
        for (let octave = 3; octave <= 5; octave++) {
          const kpLine = staffLineFor(letterIndex, octave, clef);
          const y = topLineY + (5 - kpLine) * spacing;
          const resolved = resolveStaffPosition(y, topLineY, spacing, clef);
          expect(resolved).toEqual({ letterIndex, octave, naturalMidi: naturalMidiFor(letterIndex, octave) });
        }
      }
    });
  });

  it('the middle line resolves to the same position regardless of topLineY/spacing scale', () => {
    const a = resolveStaffPosition(20, 0, 10, 'treble');
    const b = resolveStaffPosition(140, 100, 20, 'treble');
    expect(a).toEqual(b);
  });
});
