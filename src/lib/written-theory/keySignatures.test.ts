import { describe, expect, it } from 'vitest';
import { setRng } from '../theory';
import { theoryKeyById } from './keys';
import {
  buildKeySignatureChoices,
  buildKeySignatureQuestion,
  defaultKeySignatureSettings,
  type KeySignatureSettings,
} from './keySignatures';

describe('buildKeySignatureQuestion', () => {
  it('returns null when no clef is enabled', () => {
    expect(buildKeySignatureQuestion({ ...defaultKeySignatureSettings(), clefs: [] })).toBeNull();
  });

  it('the 0-accidental key is always reachable at any bound', () => {
    const settings: KeySignatureSettings = { ...defaultKeySignatureSettings(), maxAccidentals: 0, askFor: 'major' };
    for (let i = 0; i < 20; i++) {
      expect(buildKeySignatureQuestion(settings)!.answerId).toBe('C');
    }
  });

  it('500-question sweep: accidentalCount always respects the slider bound, askMode matches the picked key', () => {
    for (let bound = 0; bound <= 7; bound++) {
      const settings: KeySignatureSettings = { ...defaultKeySignatureSettings(), maxAccidentals: bound, askFor: 'both' };
      for (let i = 0; i < 500; i++) {
        const q = buildKeySignatureQuestion(settings)!;
        expect(q.accidentalCount).toBeLessThanOrEqual(bound);
        expect(theoryKeyById(q.answerId).mode).toBe(q.askMode);
        expect(theoryKeyById(q.answerId).accidentalCount).toBe(q.accidentalCount);
      }
    }
  });

  it('reveal always carries both relative names, consistent with the key table', () => {
    const settings: KeySignatureSettings = { ...defaultKeySignatureSettings(), askFor: 'minor' };
    for (let i = 0; i < 50; i++) {
      const q = buildKeySignatureQuestion(settings)!;
      const askedKey = theoryKeyById(q.answerId);
      const relative = theoryKeyById(askedKey.relativeId);
      expect([q.majorLabel, q.minorLabel]).toContain(askedKey.label);
      expect([q.majorLabel, q.minorLabel]).toContain(relative.label);
    }
  });

  it('display always uses the major relative\'s vexKeySpec, even when asking for the minor name', () => {
    const settings: KeySignatureSettings = { ...defaultKeySignatureSettings(), askFor: 'minor', maxAccidentals: 7 };
    for (let i = 0; i < 50; i++) {
      const q = buildKeySignatureQuestion(settings)!;
      const asked = theoryKeyById(q.answerId);
      const majorSide = asked.mode === 'major' ? asked : theoryKeyById(asked.relativeId);
      expect(q.vexKeySpec).toBe(majorSide.vexKeySpec);
    }
  });

  it('both-mode coin flip distribution is sane over 500 draws', () => {
    const settings: KeySignatureSettings = { ...defaultKeySignatureSettings(), askFor: 'both' };
    let majors = 0;
    for (let i = 0; i < 500; i++) {
      if (buildKeySignatureQuestion(settings)!.askMode === 'major') majors++;
    }
    expect(majors).toBeGreaterThan(175);
    expect(majors).toBeLessThan(325);
  });

  it('is deterministic under a seeded rng', () => {
    setRng(() => 0);
    const a = buildKeySignatureQuestion(defaultKeySignatureSettings());
    setRng(() => 0);
    const b = buildKeySignatureQuestion(defaultKeySignatureSettings());
    expect(a).toEqual(b);
    setRng();
  });
});

describe('buildKeySignatureChoices', () => {
  it('always exactly the 15 keys of the asked mode, regardless of the slider', () => {
    expect(buildKeySignatureChoices('major')).toHaveLength(15);
    expect(buildKeySignatureChoices('minor')).toHaveLength(15);
  });

  it('ids match THEORY_KEYS ids for that mode', () => {
    const ids = buildKeySignatureChoices('major').map((c) => c.id);
    expect(ids).toContain('C#');
    expect(ids).toContain('Cb');
  });
});
