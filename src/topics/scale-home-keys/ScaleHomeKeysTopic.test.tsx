import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScoresStore } from '../../state/scores';
import { useScaleHomeKeysSettings } from '../../state/settings/scale-home-keys';
import { ScaleHomeKeysTopic } from './ScaleHomeKeysTopic';

function renderTopic() {
  return render(
    <MemoryRouter initialEntries={['/theory/topic/scale-home-keys']}>
      <ScaleHomeKeysTopic />
    </MemoryRouter>,
  );
}

describe('ScaleHomeKeysTopic — first-guess scoring (docs/15-theory-topics/04 §5)', () => {
  beforeEach(() => {
    localStorage.clear();
    useScoresStore.setState({ scores: {} });
    useScaleHomeKeysSettings.setState({
      modes: ['dorian', 'lydian', 'mixolydian', 'aeolian'],
      maxAccidentals: 5,
      reverse: 'off',
      autoAdvance: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('the canonical D Dorian -> C major example (random()=0 throughout)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    renderTopic();
    expect(screen.getByText('D Dorian — what is its home key?')).toBeInTheDocument();
  });

  it('counts a wrong-then-right answer as total+1, correct+0 (only first guess scores)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    renderTopic();

    fireEvent.click(screen.getByRole('button', { name: 'G major' })); // wrong
    fireEvent.click(screen.getByRole('button', { name: 'C major' })); // correct, 2nd guess

    expect(screen.getByText('Session: 0 / 1 (first-guess correct)')).toBeInTheDocument();
  });

  it('counts a first-try correct answer as total+1, correct+1', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    renderTopic();

    fireEvent.click(screen.getByRole('button', { name: 'C major' }));

    expect(screen.getByText('Session: 1 / 1 (first-guess correct)')).toBeInTheDocument();
  });

  it('reverse-only mode asks for the mode name from 7 fixed choices', () => {
    useScaleHomeKeysSettings.setState({ reverse: 'only' });
    vi.spyOn(Math, 'random').mockReturnValue(0);
    renderTopic();
    expect(screen.getByText(/which mode is this\?/)).toBeInTheDocument();
    expect(screen.getAllByRole('button').filter((b) => b.className.includes('chord-choice'))).toHaveLength(7);
  });
});
