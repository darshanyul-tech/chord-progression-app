import { beforeEach, describe, expect, it } from 'vitest';
import { useCustomPresets } from './customPresets';
import { useIntervalRecognitionSettings } from './settings/interval-recognition';

describe('useCustomPresets', () => {
  beforeEach(() => {
    localStorage.clear();
    useCustomPresets.setState({ presets: [], droppedCount: 0 });
  });

  it('adding a preset is visible to a fresh getState() (persistence wiring)', () => {
    useCustomPresets.getState().addPreset('interval-recognition', 'My drill', { direction: 'desc' });
    const fresh = useCustomPresets.getState();
    expect(fresh.presets).toHaveLength(1);
    expect(fresh.presets[0]!.name).toBe('My drill');
    expect(fresh.presets[0]!.topicId).toBe('interval-recognition');
  });

  it('renamePreset updates only the matching preset', () => {
    const { addPreset } = useCustomPresets.getState();
    addPreset('interval-recognition', 'First', {});
    addPreset('interval-recognition', 'Second', {});
    const targetId = useCustomPresets.getState().presets[0]!.id;
    useCustomPresets.getState().renamePreset(targetId, 'Renamed');
    const presets = useCustomPresets.getState().presets;
    expect(presets.find((p) => p.id === targetId)!.name).toBe('Renamed');
    expect(presets.find((p) => p.name === 'Second')).toBeDefined();
  });

  it('deletePreset removes only the matching preset', () => {
    const { addPreset } = useCustomPresets.getState();
    addPreset('interval-recognition', 'First', {});
    addPreset('interval-recognition', 'Second', {});
    const targetId = useCustomPresets.getState().presets[0]!.id;
    useCustomPresets.getState().deletePreset(targetId);
    const presets = useCustomPresets.getState().presets;
    expect(presets).toHaveLength(1);
    expect(presets[0]!.name).toBe('Second');
  });

  it('applyPreset overwrites the target topic\'s live settings store', () => {
    const before = useIntervalRecognitionSettings.getState();
    expect(before.direction).not.toBe('desc');

    useCustomPresets.getState().addPreset('interval-recognition', 'Descending drill', { direction: 'desc' });
    const presetId = useCustomPresets.getState().presets[0]!.id;
    useCustomPresets.getState().applyPreset(presetId);

    expect(useIntervalRecognitionSettings.getState().direction).toBe('desc');
  });

  it('applyPreset is a no-op for an unknown preset id', () => {
    expect(() => useCustomPresets.getState().applyPreset('does-not-exist')).not.toThrow();
  });
});
