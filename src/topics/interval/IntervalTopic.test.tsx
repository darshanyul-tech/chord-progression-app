import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScoresStore } from '../../state/scores';
import { useIntervalRecognitionSettings } from '../../state/settings/interval-recognition';
import { IntervalTopic } from './IntervalTopic';

function renderTopic() {
  return render(
    <MemoryRouter initialEntries={['/topic/interval-recognition']}>
      <IntervalTopic />
    </MemoryRouter>,
  );
}

vi.mock('../../lib/audio/engine', () => {
  const fakeSampler = { triggerAttackRelease: vi.fn(), releaseAll: vi.fn() };
  return {
    audio: {
      status: 'ready',
      sampler: fakeSampler,
      lastError: null,
      initAudio: vi.fn().mockResolvedValue(undefined),
      subscribe: () => () => {},
      now: () => 0,
    },
  };
});

describe('IntervalTopic — first-guess scoring (docs/05-topics/01 §7)', () => {
  beforeEach(() => {
    localStorage.clear();
    useScoresStore.setState({ scores: {} });
    // Restrict to two deterministic, known choices (asc only).
    useIntervalRecognitionSettings.setState((s) => {
      const enabledIntervals = { ...s.enabledIntervals };
      Object.keys(enabledIntervals).forEach((id) => {
        enabledIntervals[id] = { asc: id === 'm2' || id === 'P4', desc: false };
      });
      return { enabledIntervals, direction: 'asc' };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('counts a wrong-then-right answer as total+1, correct+0 (only first guess scores)', () => {
    // pick() takes pool[0]; with m2 before P4 in INTERVAL_TYPES, the question is always m2.
    vi.spyOn(Math, 'random').mockReturnValue(0);

    renderTopic();
    fireEvent.click(screen.getByRole('button', { name: 'Play interval' }));

    fireEvent.click(screen.getByRole('button', { name: 'Perfect 4th' })); // wrong
    fireEvent.click(screen.getByRole('button', { name: 'Minor 2nd' })); // correct, 2nd guess

    expect(screen.getByText('Session: 0 / 1 (first-guess correct)')).toBeInTheDocument();
  });

  it('counts a first-try correct answer as total+1, correct+1', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    renderTopic();
    fireEvent.click(screen.getByRole('button', { name: 'Play interval' }));
    fireEvent.click(screen.getByRole('button', { name: 'Minor 2nd' })); // correct, 1st guess

    expect(screen.getByText('Session: 1 / 1 (first-guess correct)')).toBeInTheDocument();
  });
});
