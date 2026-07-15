import { afterEach, describe, expect, it, vi } from 'vitest';
import { prefersReducedMotion, REDUCED_MOTION_INTERVAL_SEC } from './motion';

describe('prefersReducedMotion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true when the media query matches', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    expect(prefersReducedMotion()).toBe(true);
  });

  it('returns false when the media query does not match', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList);
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe('REDUCED_MOTION_INTERVAL_SEC', () => {
  it('is 0.25s (~4Hz)', () => {
    expect(REDUCED_MOTION_INTERVAL_SEC).toBe(0.25);
  });
});
