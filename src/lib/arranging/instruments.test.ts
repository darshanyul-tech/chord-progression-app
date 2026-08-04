import { describe, expect, it } from 'vitest';
import { INSTRUMENTS, concertToWritten, getInstrument, sortByScoreOrder, writtenToConcert } from './instruments';

describe('instrument transpositions', () => {
  it('round-trips written↔concert for every instrument', () => {
    for (const inst of INSTRUMENTS) {
      const concert = 60;
      expect(writtenToConcert(inst, concertToWritten(inst, concert))).toBe(concert);
    }
  });

  it('baritone sax transposes M13 (octave + M6 = 21 semitones)', () => {
    const bari = getInstrument('bari-sax')!;
    expect(concertToWritten(bari, 60)).toBe(60 + 21);
  });

  it('tenor sax transposes M9 (octave + M2 = 14 semitones)', () => {
    const tenor = getInstrument('tenor-sax')!;
    expect(concertToWritten(tenor, 60)).toBe(60 + 14);
  });

  it('bass and guitar are transposing (sound an octave lower than written)', () => {
    expect(concertToWritten(getInstrument('bass')!, 40)).toBe(52);
    expect(concertToWritten(getInstrument('guitar')!, 40)).toBe(52);
  });

  it('clef trap: baritone sax is bass clef on a concert score, treble on the part', () => {
    const bari = getInstrument('bari-sax')!;
    expect(bari.clefOnConcertScore).toBe('bass');
    expect(bari.clef).toBe('treble');
  });
});

describe('score order (§5.6 quiz)', () => {
  it('orders the quiz ensemble woodwinds → brass → rhythm', () => {
    const pool = ['bass', 'soprano-sax', 'trombone', 'trumpet', 'flute', 'drums', 'guitar'];
    expect(sortByScoreOrder(pool)).toEqual([
      'flute',
      'soprano-sax',
      'trumpet',
      'trombone',
      'guitar',
      'bass',
      'drums',
    ]);
  });
});
