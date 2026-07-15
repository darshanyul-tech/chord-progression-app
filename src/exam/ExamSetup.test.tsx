import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExamSetup } from './ExamSetup';
import { useExamSettings } from '../state/settings/exam';
import { useUIStore } from '../state/ui';

// RTL coverage for the exam machine (09-improvement-plan.md §15.2): setup
// renders all 7 registered types, and per-type settings persist across a
// remount (localStorage-backed, via createPersistedSettingsStore).

const EXAM_LABELS = [
  'Interval identification',
  'Scale identification',
  'Chord quality identification',
  'Meter identification',
  'Rhythm dictation',
  'Chord progression recognition',
  'Melodic dictation',
];

describe('ExamSetup', () => {
  beforeEach(() => {
    localStorage.clear();
    useExamSettings.setState({ types: {} });
    useUIStore.setState({ lastActiveTopicId: 'chord-progressions' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders all 7 registered exam types once the async examTypes loaders resolve', async () => {
    render(<ExamSetup onBegin={() => {}} onCancel={() => {}} setupError="" />);
    await screen.findByText('Begin exam');
    EXAM_LABELS.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it('persists per-type enabled/settings on Begin, and a fresh mount round-trips them', async () => {
    const { unmount } = render(<ExamSetup onBegin={() => {}} onCancel={() => {}} setupError="" />);
    await screen.findByText('Begin exam');

    const checkbox = screen.getByRole('checkbox', { name: 'Rhythm dictation' });
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    // handleBegin persists `configs` unconditionally before the per-type
    // buildPaper probe, so this round-trips regardless of whether the
    // rhythm-dictation topic's own settings would build a valid paper.
    fireEvent.click(screen.getByRole('button', { name: 'Begin exam' }));

    unmount();
    render(<ExamSetup onBegin={() => {}} onCancel={() => {}} setupError="" />);
    await screen.findByText('Begin exam');
    expect(screen.getByRole('checkbox', { name: 'Rhythm dictation' })).toBeChecked();
  });
});
