import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCustomPresets } from '../../state/customPresets';
import { useIntervalRecognitionSettings } from '../../state/settings/interval-recognition';
import { CustomTopicManagementPage } from './CustomTopicManagementPage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/topic/custom-topic']}>
      <CustomTopicManagementPage />
    </MemoryRouter>,
  );
}

describe('CustomTopicManagementPage', () => {
  beforeEach(() => {
    localStorage.clear();
    useCustomPresets.setState({ presets: [], droppedCount: 0 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows an empty-state message when no presets are saved', () => {
    renderPage();
    expect(screen.getByText('No custom topics saved yet.')).toBeInTheDocument();
  });

  it('lists a saved preset with its origin topic title', () => {
    useCustomPresets.getState().addPreset('interval-recognition', 'Descending drill', { direction: 'desc' });
    renderPage();
    expect(screen.getByText('Descending drill')).toBeInTheDocument();
    expect(screen.getByText('Interval Recognition')).toBeInTheDocument();
  });

  it('Open applies the preset onto the origin topic\'s live settings', () => {
    useCustomPresets.getState().addPreset('interval-recognition', 'Descending drill', { direction: 'desc' });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(useIntervalRecognitionSettings.getState().direction).toBe('desc');
  });

  it('Rename updates the preset name via a prompt', () => {
    useCustomPresets.getState().addPreset('interval-recognition', 'Old name', {});
    vi.spyOn(window, 'prompt').mockReturnValue('New name');
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    expect(screen.getByText('New name')).toBeInTheDocument();
  });

  it('does not rename when the prompt is cancelled', () => {
    useCustomPresets.getState().addPreset('interval-recognition', 'Old name', {});
    vi.spyOn(window, 'prompt').mockReturnValue(null);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    expect(screen.getByText('Old name')).toBeInTheDocument();
  });

  it('Delete removes the preset after confirmation', () => {
    useCustomPresets.getState().addPreset('interval-recognition', 'To delete', {});
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByText('No custom topics saved yet.')).toBeInTheDocument();
  });

  it('does not delete when the confirmation is declined', () => {
    useCustomPresets.getState().addPreset('interval-recognition', 'Keep me', {});
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByText('Keep me')).toBeInTheDocument();
  });

  it('shows a hidden-presets notice when droppedCount is positive', () => {
    useCustomPresets.setState({ presets: [], droppedCount: 2 });
    renderPage();
    expect(screen.getByRole('status')).toHaveTextContent(/2 presets hidden/i);
  });
});
