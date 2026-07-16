import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScoresStore } from '../../state/scores';
import { useDynamicsArticulationSettings } from '../../state/settings/dynamics-articulation';
import { DynamicsArticulationTopic } from './DynamicsArticulationTopic';

function renderTopic() {
  return render(
    <MemoryRouter initialEntries={['/topic/dynamics-articulation']}>
      <DynamicsArticulationTopic />
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

describe('DynamicsArticulationTopic — dynamics mode first-guess scoring (docs/05-topics/12 §7)', () => {
  beforeEach(() => {
    localStorage.clear();
    useScoresStore.setState({ scores: {} });
    useDynamicsArticulationSettings.setState((s) => ({ ...s, mode: 'dynamics' }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('counts a wrong-then-right answer as total+1, correct+0 (only first guess scores)', () => {
    // random()=0.999 -> SAME_CHANCE branch (0.999 < 1/3) is false -> "different";
    // placeVelocityB: louder = random()<0.5 -> false -> 'softer' first attempt,
    // reflect check doesn't trigger since velocityA + gap or - gap both fit.
    vi.spyOn(Math, 'random').mockReturnValue(0.999);

    renderTopic();
    fireEvent.click(screen.getByRole('button', { name: 'Play phrase' }));

    fireEvent.click(screen.getByRole('button', { name: 'Second louder' })); // wrong (actual is softer)
    fireEvent.click(screen.getByRole('button', { name: 'Second softer' })); // correct, 2nd guess

    expect(screen.getByText('Session: 0 / 1 (first-guess correct)')).toBeInTheDocument();
  });

  it('counts a first-try correct answer as total+1, correct+1', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);

    renderTopic();
    fireEvent.click(screen.getByRole('button', { name: 'Play phrase' }));
    fireEvent.click(screen.getByRole('button', { name: 'Second softer' })); // correct, 1st guess

    expect(screen.getByText('Session: 1 / 1 (first-guess correct)')).toBeInTheDocument();
  });
});
