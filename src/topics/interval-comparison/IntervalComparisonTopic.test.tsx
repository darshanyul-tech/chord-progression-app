import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScoresStore } from '../../state/scores';
import { useIntervalComparisonSettings } from '../../state/settings/interval-comparison';
import { IntervalComparisonTopic } from './IntervalComparisonTopic';

function renderTopic() {
  return render(
    <MemoryRouter initialEntries={['/topic/interval-comparison']}>
      <IntervalComparisonTopic />
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

describe('IntervalComparisonTopic — first-guess scoring (docs/05-topics/08 §7)', () => {
  beforeEach(() => {
    localStorage.clear();
    useScoresStore.setState({ scores: {} });
    // Only m2 and P4 enabled at hard difficulty (gap 4 >= floor 1) — deterministic pair.
    useIntervalComparisonSettings.setState((s) => ({
      ...s,
      enabledIntervals: { ...Object.fromEntries(Object.keys(s.enabledIntervals).map((id) => [id, false])), m2: true, P4: true },
      difficulty: 'hard',
      allowSame: false,
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // With Math.random() always 0: eligibleFirst = [m2, P4] -> anchor = m2;
  // partner = P4 (only candidate); coin-flip (0 < 0.5) keeps anchor first ->
  // first = m2 (1 semitone), second = P4 (5 semitones) -> 'second' is larger.
  it('counts a wrong-then-right answer as total+1, correct+0 (only first guess scores)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    renderTopic();
    fireEvent.click(screen.getByRole('button', { name: 'Play pair' }));

    fireEvent.click(screen.getByRole('button', { name: 'First is larger' })); // wrong
    fireEvent.click(screen.getByRole('button', { name: 'Second is larger' })); // correct, 2nd guess

    expect(screen.getByText('Session: 0 / 1 (first-guess correct)')).toBeInTheDocument();
  });

  it('counts a first-try correct answer as total+1, correct+1', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    renderTopic();
    fireEvent.click(screen.getByRole('button', { name: 'Play pair' }));
    fireEvent.click(screen.getByRole('button', { name: 'Second is larger' })); // correct, 1st guess

    expect(screen.getByText('Session: 1 / 1 (first-guess correct)')).toBeInTheDocument();
  });
});
