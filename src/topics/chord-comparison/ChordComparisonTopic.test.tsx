import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScoresStore } from '../../state/scores';
import { useChordComparisonSettings } from '../../state/settings/chord-comparison';
import { ChordComparisonTopic } from './ChordComparisonTopic';

function renderTopic() {
  return render(
    <MemoryRouter initialEntries={['/topic/chord-comparison']}>
      <ChordComparisonTopic />
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

describe('ChordComparisonTopic — first-guess scoring (docs/05-topics/09 §7)', () => {
  beforeEach(() => {
    localStorage.clear();
    useScoresStore.setState({ scores: {} });
    // maj/m is the only tier-1 pair enabled -> deterministic "different" pool.
    useChordComparisonSettings.setState((s) => ({ ...s, enabledTypes: ['maj', 'm'], difficulty: 1 }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('counts a wrong-then-right answer as total+1, correct+0 (only first guess scores)', () => {
    // random()=0 -> rollSame (random()<0.5) is true -> answer is 'same'.
    vi.spyOn(Math, 'random').mockReturnValue(0);

    renderTopic();
    fireEvent.click(screen.getByRole('button', { name: 'Play pair' }));

    fireEvent.click(screen.getByRole('button', { name: 'Different' })); // wrong
    fireEvent.click(screen.getByRole('button', { name: 'Same' })); // correct, 2nd guess

    expect(screen.getByText('Session: 0 / 1 (first-guess correct)')).toBeInTheDocument();
  });

  it('counts a first-try correct answer as total+1, correct+1', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    renderTopic();
    fireEvent.click(screen.getByRole('button', { name: 'Play pair' }));
    fireEvent.click(screen.getByRole('button', { name: 'Same' })); // correct, 1st guess

    expect(screen.getByText('Session: 1 / 1 (first-guess correct)')).toBeInTheDocument();
  });
});
