import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyEvent, emptyStats } from '../lib/stats/aggregate';
import { useStatsStore } from '../state/statsStore';
import { StatsPage } from './StatsPage';

function seed() {
  let d = emptyStats();
  // Interval recognition: 11/19 on Minor 6th, 9/10 on Perfect 5th.
  for (let i = 0; i < 19; i++)
    d = applyEvent(d, { topicId: 'interval-recognition', correct: i < 11, itemKey: 'm6', itemLabel: 'Minor 6th' });
  for (let i = 0; i < 10; i++)
    d = applyEvent(d, { topicId: 'interval-recognition', correct: i < 9, itemKey: 'P5', itemLabel: 'Perfect 5th' });
  useStatsStore.setState({ data: d });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/stats']}>
      <StatsPage />
    </MemoryRouter>,
  );
}

describe('StatsPage', () => {
  beforeEach(() => useStatsStore.setState({ data: emptyStats() }));
  afterEach(() => useStatsStore.setState({ data: emptyStats() }));

  it('shows an empty state before any practice', () => {
    renderPage();
    expect(screen.getByText(/No practice recorded yet/i)).toBeInTheDocument();
  });

  it('shows overall accuracy and expands to a per-item breakdown', () => {
    seed();
    renderPage();

    // Topic overall: 20/29 = 69%.
    expect(screen.getByText('Interval Recognition')).toBeInTheDocument();
    expect(screen.getByText('69% (20/29)')).toBeInTheDocument();

    // Item table is collapsed until the topic is toggled open.
    expect(screen.queryByText('Minor 6th')).not.toBeInTheDocument();
    // The expandable toggle is the button carrying aria-expanded (not Reset).
    const toggle = screen
      .getAllByRole('button', { name: /Interval Recognition/i })
      .find((b) => b.getAttribute('aria-expanded') !== null)!;
    fireEvent.click(toggle);

    // Worst-first: Minor 6th (58%) before Perfect 5th (90%).
    expect(screen.getByText('Minor 6th')).toBeInTheDocument();
    expect(screen.getByText('58% (11/19)')).toBeInTheDocument();
    expect(screen.getByText('90% (9/10)')).toBeInTheDocument();
  });
});
