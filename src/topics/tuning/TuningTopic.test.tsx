import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScoresStore } from '../../state/scores';
import { TuningTopic } from './TuningTopic';

function renderTopic() {
  return render(
    <MemoryRouter initialEntries={['/topic/tuning']}>
      <TuningTopic />
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

describe('TuningTopic — first-guess scoring (docs/05-topics/11 §7)', () => {
  beforeEach(() => {
    localStorage.clear();
    useScoresStore.setState({ scores: {} });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('counts a wrong-then-right answer as total+1, correct+0 (only first guess scores)', () => {
    // random()=0 -> IN_TUNE_CHANCE branch (0 < 1/3) -> answer is 'intune'.
    vi.spyOn(Math, 'random').mockReturnValue(0);

    renderTopic();
    fireEvent.click(screen.getByRole('button', { name: 'Play pair' }));

    fireEvent.click(screen.getByRole('button', { name: 'Sharp' })); // wrong
    fireEvent.click(screen.getByRole('button', { name: 'In tune' })); // correct, 2nd guess

    expect(screen.getByText('Session: 0 / 1 (first-guess correct)')).toBeInTheDocument();
  });

  it('counts a first-try correct answer as total+1, correct+1', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    renderTopic();
    fireEvent.click(screen.getByRole('button', { name: 'Play pair' }));
    fireEvent.click(screen.getByRole('button', { name: 'In tune' })); // correct, 1st guess

    expect(screen.getByText('Session: 1 / 1 (first-guess correct)')).toBeInTheDocument();
  });
});
