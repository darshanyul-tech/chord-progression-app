import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScoresStore } from '../../state/scores';
import { useNoteReadingSettings } from '../../state/settings/note-reading';
import { NoteReadingTopic } from './NoteReadingTopic';

function renderTopic() {
  return render(
    <MemoryRouter initialEntries={['/theory/topic/note-reading']}>
      <NoteReadingTopic />
    </MemoryRouter>,
  );
}

describe('NoteReadingTopic — first-guess scoring (docs/15-theory-topics/01 §6)', () => {
  beforeEach(() => {
    localStorage.clear();
    useScoresStore.setState({ scores: {} });
    useNoteReadingSettings.setState({
      clefs: ['treble', 'bass'],
      range: 'ledger2',
      accidentals: 'naturalsOnly',
      octaveNumbers: false,
      autoAdvance: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('counts a wrong-then-right answer as total+1, correct+0 (only first guess scores)', () => {
    // random()=0 throughout -> clef 'treble', line -1 -> A3 (verified by hand: see
    // noteReading.test.ts's known-position cases for the same math).
    vi.spyOn(Math, 'random').mockReturnValue(0);
    renderTopic();

    fireEvent.click(screen.getByRole('button', { name: 'B' })); // wrong
    fireEvent.click(screen.getByRole('button', { name: 'A' })); // correct, 2nd guess

    expect(screen.getByText('Session: 0 / 1 (first-guess correct)')).toBeInTheDocument();
  });

  it('counts a first-try correct answer as total+1, correct+1', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    renderTopic();

    fireEvent.click(screen.getByRole('button', { name: 'A' })); // correct, 1st guess

    expect(screen.getByText('Session: 1 / 1 (first-guess correct)')).toBeInTheDocument();
  });

  it('renders a staff and exactly one Naturals group of 7 buttons in naturals-only mode', () => {
    renderTopic();
    expect(screen.getByRole('img', { name: /Music notation staff/ })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Note reading answers' })).toBeInTheDocument();
    expect(screen.getAllByRole('button').filter((b) => b.className.includes('chord-choice'))).toHaveLength(7);
  });
});
