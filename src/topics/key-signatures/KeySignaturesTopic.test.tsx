import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScoresStore } from '../../state/scores';
import { useKeySignatureSettings } from '../../state/settings/key-signatures';
import { KeySignaturesTopic } from './KeySignaturesTopic';

function renderTopic() {
  return render(
    <MemoryRouter initialEntries={['/theory/topic/key-signatures']}>
      <KeySignaturesTopic />
    </MemoryRouter>,
  );
}

describe('KeySignaturesTopic — first-guess scoring (docs/15-theory-topics/02 §6)', () => {
  beforeEach(() => {
    localStorage.clear();
    useScoresStore.setState({ scores: {} });
    useKeySignatureSettings.setState({
      askFor: 'both',
      maxAccidentals: 5,
      clefs: ['treble', 'bass'],
      autoAdvance: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('counts a wrong-then-right answer as total+1, correct+0 (only first guess scores)', () => {
    // random()=0 -> askMode 'major', pool index 0 -> 'C' (0 accidentals, C major).
    vi.spyOn(Math, 'random').mockReturnValue(0);
    renderTopic();

    fireEvent.click(screen.getByRole('button', { name: 'G major' })); // wrong
    fireEvent.click(screen.getByRole('button', { name: 'C major' })); // correct, 2nd guess

    expect(screen.getByText('Session: 0 / 1 (first-guess correct)')).toBeInTheDocument();
  });

  it('counts a first-try correct answer as total+1, correct+1', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    renderTopic();

    fireEvent.click(screen.getByRole('button', { name: 'C major' })); // correct, 1st guess

    expect(screen.getByText('Session: 1 / 1 (first-guess correct)')).toBeInTheDocument();
  });

  it('renders a key signature stave and all 15 keys of the asked mode', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    renderTopic();
    expect(screen.getByRole('img', { name: /Key signature staff/ })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Key signature answers' })).toBeInTheDocument();
    expect(screen.getAllByRole('button').filter((b) => b.className.includes('chord-choice'))).toHaveLength(15);
  });
});
