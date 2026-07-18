import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App shell', () => {
  it('redirects "/" to the default topic and renders the shell', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'TryTone' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Syllabus' })).toBeInTheDocument();
    // Default topic is chord-progressions; its Settings card confirms it rendered.
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
  });

  it('marks exactly one syllabus entry as the active topic', () => {
    render(<App />);
    const activeButtons = screen
      .getAllByRole('button')
      .filter((btn) => btn.className.includes('syllabus-topic') && btn.className.includes('active'));
    expect(activeButtons).toHaveLength(1);
    expect(activeButtons[0]).toHaveTextContent('Chord Progressions');
  });
});
