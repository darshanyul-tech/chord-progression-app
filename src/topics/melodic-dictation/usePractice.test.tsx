import { act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { defaultMelodicDictationSettings } from '../../lib/melody/settings';
import { useMelodicPractice } from './usePractice';

vi.mock('../../lib/audio/engine', () => ({
  audio: {
    status: 'idle',
    sampler: null,
    lastError: null,
    initAudio: vi.fn().mockResolvedValue(undefined),
    subscribe: () => () => {},
    now: () => 0,
    rawContext: () => ({ currentTime: 0, state: 'running' }),
  },
}));

function renderPractice(overrides: Partial<ReturnType<typeof defaultMelodicDictationSettings>> = {}) {
  const settings = {
    ...defaultMelodicDictationSettings(),
    clef: 'treble' as const,
    key: 'C',
    range: 'narrow' as const,
    signatures: ['4/4'],
    measures: 1,
    durations: [1],
    ...overrides,
  };
  return renderHook(() => useMelodicPractice(settings), {
    wrapper: ({ children }) => <MemoryRouter initialEntries={['/topic/melodic-dictation']}>{children}</MemoryRouter>,
  });
}

// docs/09-improvement-plan.md §12.5 — a click far above/below the staff used
// to place an unclamped, arbitrary MIDI value. C/treble/narrow resolves to
// [60, 72] (resolveRangeWindow); placeNoteAt should clamp to that window.
describe('useMelodicPractice — pitch range clamping', () => {
  it('clamps an absurdly high click to the range window top', () => {
    const { result } = renderPractice();
    act(() => {
      result.current.placeNoteAt(0, 0, 1, false, 200);
    });
    expect(result.current.userMeasures[0]?.[0]?.midi).toBe(72);
  });

  it('clamps an absurdly low click to the range window bottom', () => {
    const { result } = renderPractice();
    act(() => {
      result.current.placeNoteAt(0, 0, 1, false, -50);
    });
    expect(result.current.userMeasures[0]?.[0]?.midi).toBe(60);
  });

  it('leaves an in-range pitch untouched', () => {
    const { result } = renderPractice();
    act(() => {
      result.current.placeNoteAt(0, 0, 1, false, 64);
    });
    expect(result.current.userMeasures[0]?.[0]?.midi).toBe(64);
  });
});
