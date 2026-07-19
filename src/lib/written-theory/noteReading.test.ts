import { describe, expect, it } from 'vitest';
import { setRng } from '../theory';
import { lineToLetterOctave } from '../melody/theory';
import {
  buildNoteReadingChoiceGroups,
  buildNoteReadingQuestion,
  defaultNoteReadingSettings,
  reachableSpellings,
  type NoteReadingSettings,
} from './noteReading';

describe('buildNoteReadingQuestion', () => {
  it('returns null when no clef is enabled', () => {
    expect(buildNoteReadingQuestion({ ...defaultNoteReadingSettings(), clefs: [] })).toBeNull();
  });

  it('known reference positions (docs/15-theory-topics/01 §5)', () => {
    expect(lineToLetterOctave(3, 'alto')).toEqual({ letterIndex: 0, octave: 4 }); // C4
    expect(lineToLetterOctave(4, 'tenor')).toEqual({ letterIndex: 0, octave: 4 }); // C4
    expect(lineToLetterOctave(2, 'bass')).toEqual({ letterIndex: 6, octave: 2 }); // B2
    expect(lineToLetterOctave(0, 'treble')).toEqual({ letterIndex: 0, octave: 4 }); // C4, 1 ledger below
  });

  it('500-question sweep: every note falls within the range window, for every settings combo', () => {
    const ranges: NoteReadingSettings['range'][] = ['staffOnly', 'ledger2', 'ledger4'];
    const clefSets: NoteReadingSettings['clefs'][] = [
      ['treble'],
      ['bass'],
      ['alto'],
      ['tenor'],
      ['treble', 'bass', 'alto', 'tenor'],
    ];
    for (const range of ranges) {
      for (const clefs of clefSets) {
        const settings: NoteReadingSettings = { ...defaultNoteReadingSettings(), range, clefs };
        for (let i = 0; i < 500; i++) {
          const q = buildNoteReadingQuestion(settings)!;
          expect(clefs).toContain(q.clef);
          const reachable = reachableSpellings(q.clef, range, 'naturalsAndAccidentals');
          expect(reachable).toContainEqual(q.spelling);
        }
      }
    }
  });

  it('accidental frequency is ~1/2 in accidentals mode over 1000 draws', () => {
    const settings: NoteReadingSettings = { ...defaultNoteReadingSettings(), accidentals: 'naturalsAndAccidentals' };
    let accidentalCount = 0;
    for (let i = 0; i < 1000; i++) {
      const q = buildNoteReadingQuestion(settings)!;
      if (q.spelling.acc !== '') accidentalCount++;
    }
    expect(accidentalCount).toBeGreaterThan(350);
    expect(accidentalCount).toBeLessThan(650);
  });

  it('naturals-only mode never produces an accidental', () => {
    const settings: NoteReadingSettings = { ...defaultNoteReadingSettings(), accidentals: 'naturalsOnly' };
    for (let i = 0; i < 300; i++) {
      expect(buildNoteReadingQuestion(settings)!.spelling.acc).toBe('');
    }
  });

  it('is deterministic under a seeded rng', () => {
    setRng(() => 0);
    const a = buildNoteReadingQuestion(defaultNoteReadingSettings());
    setRng(() => 0);
    const b = buildNoteReadingQuestion(defaultNoteReadingSettings());
    expect(a).toEqual(b);
    setRng();
  });
});

describe('buildNoteReadingChoiceGroups', () => {
  it('naturals-only, octave numbers off: exactly 7 buttons in one Naturals group', () => {
    const groups = buildNoteReadingChoiceGroups('treble', 'ledger2', 'naturalsOnly', false);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.title).toBe('Naturals');
    expect(groups[0]!.items).toHaveLength(7);
  });

  it('naturals+accidentals, octave numbers off: 21 buttons across 3 groups, in Naturals/Sharps/Flats order', () => {
    const groups = buildNoteReadingChoiceGroups('treble', 'ledger2', 'naturalsAndAccidentals', false);
    expect(groups.map((g) => g.title)).toEqual(['Naturals', 'Sharps', 'Flats']);
    expect(groups.reduce((n, g) => n + g.items.length, 0)).toBe(21);
  });

  it('octave numbers on: grid matches reachableSpellings exactly for that clef+range', () => {
    const groups = buildNoteReadingChoiceGroups('bass', 'staffOnly', 'naturalsOnly', true);
    const ids = groups.flatMap((g) => g.items.map((i) => i.id));
    const reachable = reachableSpellings('bass', 'staffOnly', 'naturalsOnly');
    expect(ids.sort()).toEqual(reachable.map((p) => `${p.letter}${p.acc}${p.octave}`).sort());
  });

  it('a wider range window produces a strictly larger octave-mode grid', () => {
    const staffOnly = buildNoteReadingChoiceGroups('treble', 'staffOnly', 'naturalsOnly', true);
    const ledger4 = buildNoteReadingChoiceGroups('treble', 'ledger4', 'naturalsOnly', true);
    const count = (groups: typeof staffOnly) => groups.reduce((n, g) => n + g.items.length, 0);
    expect(count(ledger4)).toBeGreaterThan(count(staffOnly));
  });
});
