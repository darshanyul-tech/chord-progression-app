import { describe, expect, it } from 'vitest';
import { UST_TABLE, ustRowsForSymbol, ustTriadPitchClasses, ustTriadSymbol } from './ust';
import { pitchClass } from './pitch';

describe('UST table (amended week 10)', () => {
  it('every row round-trips symbol → row(s)', () => {
    for (const row of UST_TABLE) {
      const rows = ustRowsForSymbol(row.symbol);
      expect(rows.map((r) => r.id)).toContain(row.id);
    }
  });

  it('D major over C7 is Upper Structure II → C13(♯11)', () => {
    const ii = UST_TABLE.find((r) => r.id === 'II')!;
    // D major triad over C7 (root pc 0): D F# A
    const pcs = ustTriadPitchClasses(ii, 0);
    expect(pcs.sort((a, b) => a - b)).toEqual([2, 6, 9].sort((a, b) => a - b));
    expect(ustTriadSymbol(ii, 0)).toBe('D');
  });

  it('C13 lists both D minor and A minor upper structures — accept all', () => {
    const rows = ustRowsForSymbol('C13');
    expect(rows.map((r) => r.id).sort()).toEqual(['ii', 'vi']);
  });

  it('minor upper triads spell a minor quality', () => {
    const i = UST_TABLE.find((r) => r.id === 'i')!;
    const pcs = ustTriadPitchClasses(i, 0); // C Eb G
    expect(pcs).toContain(pitchClass(3)); // Eb
    expect(ustTriadSymbol(i, 0)).toBe('Cm');
  });
});
