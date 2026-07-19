import { describe, expect, it } from 'vitest';
import { DEGREE_NAMES } from './degrees';

describe('DEGREE_NAMES', () => {
  it('major: degree 7 is the leading note', () => {
    const names = DEGREE_NAMES('major');
    expect(names).toHaveLength(7);
    expect(names[6]).toBe('Leading note');
  });

  it('minor: degree 7 is the subtonic, not the leading note', () => {
    const names = DEGREE_NAMES('minor');
    expect(names).toHaveLength(7);
    expect(names[6]).toBe('Subtonic');
  });

  it('degrees 1-6 are identical between modes', () => {
    expect(DEGREE_NAMES('major').slice(0, 6)).toEqual(DEGREE_NAMES('minor').slice(0, 6));
    expect(DEGREE_NAMES('major')[0]).toBe('Tonic');
  });
});
