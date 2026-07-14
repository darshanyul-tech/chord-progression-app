import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScoresStore } from '../../state/scores';
import { useScaleRecognitionSettings } from '../../state/settings/scales';
import { ScaleTopic } from './ScaleTopic';

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

function renderTopic() {
  return render(
    <MemoryRouter initialEntries={['/topic/scales']}>
      <ScaleTopic />
    </MemoryRouter>,
  );
}

describe('ScaleTopic — first-guess scoring (docs/05-topics/02 §6)', () => {
  beforeEach(() => {
    localStorage.clear();
    useScoresStore.setState({ scores: {} });
    useScaleRecognitionSettings.setState({ enabledScales: ['ionian', 'dorian'] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('counts a wrong-then-right answer as total+1, correct+0', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    renderTopic();
    fireEvent.click(screen.getByRole('button', { name: 'Play scale' }));

    fireEvent.click(screen.getByRole('button', { name: 'Dorian' })); // wrong
    fireEvent.click(screen.getByRole('button', { name: 'Ionian (major)' })); // correct, 2nd guess

    expect(screen.getByText('Session: 0 / 1 (first-guess correct)')).toBeInTheDocument();
  });

  it('counts a first-try correct answer as total+1, correct+1', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    renderTopic();
    fireEvent.click(screen.getByRole('button', { name: 'Play scale' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ionian (major)' }));

    expect(screen.getByText('Session: 1 / 1 (first-guess correct)')).toBeInTheDocument();
  });
});
