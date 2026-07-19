import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScoresStore } from '../../state/scores';
import { useScaleDegreesSettings } from '../../state/settings/scale-degrees';
import { ScaleDegreesTopic } from './ScaleDegreesTopic';

function renderTopic() {
  return render(
    <MemoryRouter initialEntries={['/theory/topic/scale-degrees']}>
      <ScaleDegreesTopic />
    </MemoryRouter>,
  );
}

describe('ScaleDegreesTopic — first-guess scoring (docs/15-theory-topics/03 §5)', () => {
  beforeEach(() => {
    localStorage.clear();
    useScoresStore.setState({ scores: {} });
    useScaleDegreesSettings.setState({
      keys: 'major',
      maxAccidentals: 0,
      display: 'staffAndText',
      degreeLabels: 'numbers',
      autoAdvance: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('counts a wrong-then-right answer as total+1, correct+0 (only first guess scores)', () => {
    // maxAccidentals=0 forces C major every time; random()=0 -> degree index 0 -> degree 1.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    renderTopic();
    expect(screen.getByText(/Key: C major/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /2̂/ })); // wrong
    fireEvent.click(screen.getByRole('button', { name: /1̂/ })); // correct, 2nd guess

    expect(screen.getByText('Session: 0 / 1 (first-guess correct)')).toBeInTheDocument();
  });

  it('counts a first-try correct answer as total+1, correct+1', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    renderTopic();

    fireEvent.click(screen.getByRole('button', { name: /1̂/ }));

    expect(screen.getByText('Session: 1 / 1 (first-guess correct)')).toBeInTheDocument();
  });

  it('text-only display mode shows no staff', () => {
    useScaleDegreesSettings.setState({ display: 'textOnly' });
    renderTopic();
    expect(screen.queryByRole('img', { name: /Music notation staff/ })).not.toBeInTheDocument();
  });
});
