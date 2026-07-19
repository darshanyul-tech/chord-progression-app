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

  it('navigating into the Theory section shows its own syllabus with note-reading active', () => {
    const { container } = render(<App />);
    const homeGrid = within(container.querySelector('.home-section-grid')!);
    fireEvent.click(homeGrid.getByRole('link', { name: /^Theory/ }));
    expect(screen.getByRole('navigation', { name: 'Syllabus' })).toBeInTheDocument();
    // Theory's default topic (note-reading, active as of Phase 28) is
    // lazy-loaded — its own content only appears once Suspense resolves,
    // which under full-suite parallel load is too flaky a thing to wait on
    // here (NoteReadingTopic.test.tsx already covers its content directly,
    // non-lazily). The sidebar itself is never lazy, so checking which
    // entry is marked active is a synchronous, reliable proxy for "the
    // right topic is selected".
    const activeButtons = screen
      .getAllByRole('button')
      .filter((btn) => btn.className.includes('syllabus-topic') && btn.className.includes('active'));
    expect(activeButtons).toHaveLength(1);
    expect(activeButtons[0]).toHaveTextContent('Note Reading');
  });

  it('a not-yet-built theory topic still shows the shared placeholder view', () => {
    const { container } = render(<App />);
    const homeGrid = within(container.querySelector('.home-section-grid')!);
    fireEvent.click(homeGrid.getByRole('link', { name: /^Theory/ }));
    // Meter Transposition remains a placeholder through Phase 32 (flips in Phase 33).
    fireEvent.click(screen.getByRole('button', { name: /Meter Transposition/ }));
    expect(screen.getByRole('heading', { name: 'Meter Transposition' })).toBeInTheDocument();
    expect(screen.getByText("This topic is part of the syllabus but isn't built yet.")).toBeInTheDocument();
  });

  it('an old-style /topic/:id URL redirects into the aural section', () => {
    window.location.hash = '#/topic/rhythm-dictation';
    render(<App />);
    expect(window.location.hash).toBe('#/aural/topic/rhythm-dictation');
    expect(screen.getByRole('navigation', { name: 'Syllabus' })).toBeInTheDocument();
  });
});
