import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';

describe('App shell', () => {
  // Each test builds its own router from window.location.hash at mount time
  // (App.tsx's buildRouter) — reset it first so tests are order-independent.
  beforeEach(() => {
    window.location.hash = '';
  });

  it('renders the Home page at "/" with a card for each section, no sidebar', () => {
    const { container } = render(<App />);
    expect(screen.getByRole('heading', { name: 'Welcome to TryTone' })).toBeInTheDocument();
    const homeGrid = within(container.querySelector('.home-section-grid')!);
    expect(homeGrid.getByRole('link', { name: /Aural Training/ })).toBeInTheDocument();
    expect(homeGrid.getByRole('link', { name: /^Theory/ })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Syllabus' })).not.toBeInTheDocument();
  });

  it('navigating into the Aural section renders its shell with exactly one active syllabus entry', () => {
    const { container } = render(<App />);
    const homeGrid = within(container.querySelector('.home-section-grid')!);
    fireEvent.click(homeGrid.getByRole('link', { name: /Aural Training/ }));
    expect(screen.getByRole('heading', { name: 'TryTone' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Syllabus' })).toBeInTheDocument();
    // Default aural topic is chord-progressions; its Settings card confirms it rendered.
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    const activeButtons = screen
      .getAllByRole('button')
      .filter((btn) => btn.className.includes('syllabus-topic') && btn.className.includes('active'));
    expect(activeButtons).toHaveLength(1);
    expect(activeButtons[0]).toHaveTextContent('Chord Progressions');
  });

  it('navigating into the Theory section shows its own syllabus with a placeholder topic', () => {
    const { container } = render(<App />);
    const homeGrid = within(container.querySelector('.home-section-grid')!);
    fireEvent.click(homeGrid.getByRole('link', { name: /^Theory/ }));
    expect(screen.getByRole('navigation', { name: 'Syllabus' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Note Reading' })).toBeInTheDocument();
    expect(screen.getByText("This topic is part of the syllabus but isn't built yet.")).toBeInTheDocument();
  });

  it('an old-style /topic/:id URL redirects into the aural section', () => {
    window.location.hash = '#/topic/rhythm-dictation';
    render(<App />);
    expect(window.location.hash).toBe('#/aural/topic/rhythm-dictation');
    expect(screen.getByRole('navigation', { name: 'Syllabus' })).toBeInTheDocument();
  });
});
