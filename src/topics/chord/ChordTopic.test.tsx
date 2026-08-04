import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScoresStore } from '../../state/scores';
import { useChordRecognitionSettings } from '../../state/settings/chord-recognition';
import { ChordTopic } from './ChordTopic';

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
    <MemoryRouter initialEntries={['/topic/chord-recognition']}>
      <ChordTopic />
    </MemoryRouter>,
  );
}

describe('ChordTopic — first-guess scoring (docs/05-topics/03 §6)', () => {
  beforeEach(() => {
    localStorage.clear();
    useScoresStore.setState({ scores: {} });
    // Restrict to two deterministic choices.
    useChordRecognitionSettings.setState({ enabledTypes: ['maj', 'm'] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('counts a wrong-then-right answer as total+1, correct+0', () => {
    // pick(['maj', 'm']) with Math.random -> 0 always selects 'maj'.
    vi.spyOn(Math, 'random').mockReturnValue(0);

    renderTopic();
    fireEvent.click(screen.getByRole('button', { name: 'Play chord' }));

    fireEvent.click(screen.getByRole('button', { name: 'Minor triad' })); // wrong
    fireEvent.click(screen.getByRole('button', { name: 'Major triad' })); // correct, 2nd guess

    expect(screen.getByText('Session: 0 / 1 (first-guess correct)')).toBeInTheDocument();
  });

  it('counts a first-try correct answer as total+1, correct+1', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    renderTopic();
    fireEvent.click(screen.getByRole('button', { name: 'Play chord' }));
    fireEvent.click(screen.getByRole('button', { name: 'Major triad' }));

    expect(screen.getByText('Session: 1 / 1 (first-guess correct)')).toBeInTheDocument();
  });
});

describe('ChordTopic — two-part inversion guessing', () => {
  beforeEach(() => {
    localStorage.clear();
    useScoresStore.setState({ scores: {} });
  });
  afterEach(() => vi.restoreAllMocks());

  it('scores a correct quality + inversion pick', () => {
    // Only one pool entry → the question is always Maj7 1st inversion.
    useChordRecognitionSettings.setState({
      enabledTypes: [],
      inversionChords: ['maj7'],
      seventhInversions: [1],
      ninthInversions: [],
    });
    vi.spyOn(Math, 'random').mockReturnValue(0);

    renderTopic();
    fireEvent.click(screen.getByRole('button', { name: 'Play chord' }));

    // Both parts required before Guess is live.
    expect(screen.getByRole('button', { name: 'Guess' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Maj7' }));
    fireEvent.click(screen.getByRole('button', { name: '1st inv' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guess' }));

    expect(screen.getByText('Session: 1 / 1 (first-guess correct)')).toBeInTheDocument();
  });

  it('disables an inversion the picked quality cannot take (3rd inv on a 7th chord)', () => {
    useChordRecognitionSettings.setState({
      enabledTypes: [],
      inversionChords: ['maj7', 'maj9'],
      seventhInversions: [1, 2],
      ninthInversions: [1, 2, 3],
    });
    vi.spyOn(Math, 'random').mockReturnValue(0);

    renderTopic();
    fireEvent.click(screen.getByRole('button', { name: 'Play chord' }));

    const thirdInv = screen.getByRole('button', { name: '3rd inv' });
    expect(thirdInv).not.toBeDisabled(); // available before a quality is chosen
    fireEvent.click(screen.getByRole('button', { name: 'Maj7' })); // a 7th chord tops out at 2nd inv
    expect(thirdInv).toBeDisabled();
  });
});
