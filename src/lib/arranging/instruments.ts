// Arranging engine — instrument registry (ARR spec §2.7, §5.1, §5.2).
// ALL ranges stored in CONCERT pitch (Musition convention) and transposed for
// display, so ARR-05 and ARR-06 share one source of truth.
//
// ⚠ RANGES BELOW ARE PLACEHOLDERS (spec §5.2 / §10 item 2: DATA REQUIRED FROM
// USER — assessed professional + best-range low/high per instrument, concert
// pitch). They are marked RANGE_TODO and must be replaced with the real charts
// from Sussman & Abene ch. 3 / Pease & Freeman before ARR-06 is assessment-valid.

export type TranspositionInterval = 'M2' | 'M6' | 'M9' | 'M13' | 'P8' | 'none';
export type Clef = 'treble' | 'bass' | 'alto' | 'tenor';
export type InstrumentFamily = 'woodwind' | 'brass' | 'rhythm';

export interface Instrument {
  id: string;
  displayName: string;
  transposition: { direction: 'written-higher' | 'none'; interval: TranspositionInterval; semitones: number };
  clef: Clef; // clef used on the player's (transposed) part
  clefOnConcertScore: Clef;
  range: { low: number; high: number }; // assessed professional, CONCERT pitch (RANGE_TODO)
  bestRange: { low: number; high: number }; // RANGE_TODO
  altissimo: { low: number; high: number } | null;
  scoreOrder: number;
  family: InstrumentFamily;
  /** Open strings low→high (bass/guitar), concert pitch MIDI. */
  openStrings?: number[];
  /** True while the range figures are unverified placeholders. */
  rangeTodo: boolean;
}

const SEMITONES: Record<TranspositionInterval, number> = { M2: 2, M6: 9, M9: 14, M13: 21, P8: 12, none: 0 };

function transposing(interval: TranspositionInterval): Instrument['transposition'] {
  return { direction: interval === 'none' ? 'none' : 'written-higher', interval, semitones: SEMITONES[interval] };
}

// Full registry ordering (§5.6): Flute → Clarinet → Soprano Sax → Alto Sax →
// Tenor Sax → Bass Clarinet → Baritone Sax → Trumpet → Flugelhorn → Trombone →
// Guitar → Piano/Keys → Vibraphone → Bass → Drums.
export const INSTRUMENTS: Instrument[] = [
  mk('flute', 'Flute', 'none', 'treble', 'treble', 'woodwind', 1, [60, 96], [62, 91]),
  mk('clarinet', 'B♭ Clarinet', 'M2', 'treble', 'treble', 'woodwind', 2, [50, 91], [52, 84]),
  mk('soprano-sax', 'B♭ Soprano Saxophone', 'M2', 'treble', 'treble', 'woodwind', 3, [56, 87], [58, 82], [88, 91]),
  mk('alto-sax', 'E♭ Alto Saxophone', 'M6', 'treble', 'treble', 'woodwind', 4, [49, 84], [51, 80], [85, 89]),
  mk('tenor-sax', 'B♭ Tenor Saxophone', 'M9', 'treble', 'bass', 'woodwind', 5, [44, 79], [46, 75], [80, 84]),
  mk('bass-clarinet', 'B♭ Bass Clarinet', 'M9', 'treble', 'bass', 'woodwind', 6, [38, 77], [40, 72]),
  mk('bari-sax', 'E♭ Baritone Saxophone', 'M13', 'treble', 'bass', 'woodwind', 7, [37, 72], [39, 68], [73, 77]),
  mk('trumpet', 'B♭ Trumpet', 'M2', 'treble', 'treble', 'brass', 8, [54, 82], [55, 79]),
  mk('flugelhorn', 'B♭ Flugelhorn', 'M2', 'treble', 'treble', 'brass', 9, [54, 79], [55, 77]),
  mk('trombone', 'Tenor Trombone', 'none', 'bass', 'bass', 'brass', 10, [40, 72], [43, 67]),
  mkStrings('guitar', 'Guitar', 11, [40, 45, 50, 55, 59, 64], [40, 88]),
  mk('piano', 'Piano', 'none', 'treble', 'treble', 'rhythm', 12, [21, 108], [28, 100]),
  mk('vibraphone', 'Vibraphone', 'none', 'treble', 'treble', 'rhythm', 13, [53, 89], [53, 89]),
  mkStrings('bass', 'Electric/Acoustic Bass', 14, [28, 33, 38, 43], [28, 67]),
  { ...mk('drums', 'Drums', 'none', 'bass', 'bass', 'rhythm', 15, [0, 0], [0, 0]), rangeTodo: false },
];

function mk(
  id: string,
  displayName: string,
  interval: TranspositionInterval,
  clef: Clef,
  clefOnConcertScore: Clef,
  family: InstrumentFamily,
  scoreOrder: number,
  range: [number, number],
  bestRange: [number, number],
  altissimo?: [number, number],
): Instrument {
  return {
    id,
    displayName,
    transposition: transposing(interval),
    clef,
    clefOnConcertScore,
    range: { low: range[0], high: range[1] },
    bestRange: { low: bestRange[0], high: bestRange[1] },
    altissimo: altissimo ? { low: altissimo[0], high: altissimo[1] } : null,
    scoreOrder,
    family,
    rangeTodo: true,
  };
}

function mkStrings(id: string, displayName: string, scoreOrder: number, openStrings: number[], range: [number, number]): Instrument {
  return {
    id,
    displayName,
    transposition: transposing('P8'), // sounds an octave lower than written
    clef: id === 'guitar' ? 'treble' : 'bass',
    clefOnConcertScore: id === 'guitar' ? 'treble' : 'bass',
    range: { low: range[0], high: range[1] },
    bestRange: { low: range[0], high: range[1] },
    altissimo: null,
    scoreOrder,
    family: 'rhythm',
    openStrings,
    rangeTodo: true,
  };
}

export function getInstrument(id: string): Instrument | undefined {
  return INSTRUMENTS.find((i) => i.id === id);
}

/** Concert MIDI → written MIDI for this instrument (written is higher for transposing instruments). */
export function concertToWritten(inst: Instrument, concertMidi: number): number {
  return inst.transposition.direction === 'written-higher' ? concertMidi + inst.transposition.semitones : concertMidi;
}

/** Written MIDI → concert MIDI. */
export function writtenToConcert(inst: Instrument, writtenMidi: number): number {
  return inst.transposition.direction === 'written-higher' ? writtenMidi - inst.transposition.semitones : writtenMidi;
}

export type RangeClassification = 'best' | 'in-range' | 'altissimo' | 'out-of-range';

/** Classify a CONCERT-pitch note against the instrument's ranges. */
export function classifyRange(inst: Instrument, concertMidi: number): RangeClassification {
  if (inst.altissimo && concertMidi >= inst.altissimo.low && concertMidi <= inst.altissimo.high) return 'altissimo';
  if (concertMidi < inst.range.low || concertMidi > inst.range.high) return 'out-of-range';
  if (concertMidi >= inst.bestRange.low && concertMidi <= inst.bestRange.high) return 'best';
  return 'in-range';
}

/** Score order sort (woodwinds → brass → rhythm), by scoreOrder. */
export function sortByScoreOrder(ids: string[]): string[] {
  return [...ids].sort((a, b) => (getInstrument(a)?.scoreOrder ?? 99) - (getInstrument(b)?.scoreOrder ?? 99));
}
