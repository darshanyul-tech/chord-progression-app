import { describe, expect, it } from 'vitest';
import {
  addPreset,
  applyPresetSnapshot,
  deletePreset,
  renamePreset,
  sanitizePresets,
  validatePresetName,
  type CustomPreset,
} from './presets';

describe('validatePresetName', () => {
  it('rejects an empty or whitespace-only name', () => {
    expect(validatePresetName('', [])).toMatch(/empty/i);
    expect(validatePresetName('   ', [])).toMatch(/empty/i);
  });

  it('rejects a name over 40 characters', () => {
    expect(validatePresetName('a'.repeat(41), [])).toMatch(/40/);
    expect(validatePresetName('a'.repeat(40), [])).toBeNull();
  });

  it('rejects a case-insensitive duplicate', () => {
    expect(validatePresetName('My Preset', ['my preset'])).toMatch(/already exists/i);
    expect(validatePresetName('MY PRESET', ['My Preset'])).toMatch(/already exists/i);
  });

  it('accepts a valid, non-duplicate name', () => {
    expect(validatePresetName('Descending m2/M2 drill', ['Other preset'])).toBeNull();
  });
});

describe('addPreset / renamePreset / deletePreset — CRUD round-trip', () => {
  it('adds a preset with the given topicId, name, and settings', () => {
    const presets = addPreset([], 'interval-recognition', 'My drill', { direction: 'desc' });
    expect(presets).toHaveLength(1);
    expect(presets[0]!.topicId).toBe('interval-recognition');
    expect(presets[0]!.name).toBe('My drill');
    expect(presets[0]!.settings).toEqual({ direction: 'desc' });
    expect(typeof presets[0]!.id).toBe('string');
    expect(presets[0]!.id.length).toBeGreaterThan(0);
  });

  it('renames the matching preset only', () => {
    let presets = addPreset([], 'interval-recognition', 'First', {});
    presets = addPreset(presets, 'interval-recognition', 'Second', {});
    const targetId = presets[0]!.id;
    const renamed = renamePreset(presets, targetId, 'Renamed');
    expect(renamed.find((p) => p.id === targetId)!.name).toBe('Renamed');
    expect(renamed.find((p) => p.name === 'Second')).toBeDefined();
  });

  it('deletes only the matching preset', () => {
    let presets = addPreset([], 'interval-recognition', 'First', {});
    presets = addPreset(presets, 'interval-recognition', 'Second', {});
    const targetId = presets[0]!.id;
    const remaining = deletePreset(presets, targetId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.name).toBe('Second');
  });
});

describe('sanitizePresets', () => {
  const knownTopicIds = ['interval-recognition', 'chord-recognition'];

  function makePreset(overrides: Partial<CustomPreset> = {}): CustomPreset {
    return { id: 'p1', name: 'Test', topicId: 'interval-recognition', settings: {}, createdAt: 1, ...overrides };
  }

  it('keeps well-formed presets pointing at a known topic untouched', () => {
    const preset = makePreset();
    const result = sanitizePresets([preset], knownTopicIds);
    expect(result.presets).toEqual([preset]);
    expect(result.droppedCount).toBe(0);
  });

  it('drops a preset whose topicId no longer resolves, and counts it', () => {
    const result = sanitizePresets([makePreset({ topicId: 'parked-topic' })], knownTopicIds);
    expect(result.presets).toHaveLength(0);
    expect(result.droppedCount).toBe(1);
  });

  it('drops malformed entries without throwing', () => {
    const malformed = [null, 42, 'a string', { id: 'p1' }, makePreset()];
    expect(() => sanitizePresets(malformed, knownTopicIds)).not.toThrow();
    const result = sanitizePresets(malformed, knownTopicIds);
    expect(result.presets).toHaveLength(1);
    expect(result.droppedCount).toBe(4);
  });

  it('returns an empty result for a non-array blob (e.g. corrupted storage)', () => {
    const result = sanitizePresets({ not: 'an array' }, knownTopicIds);
    expect(result.presets).toEqual([]);
    expect(result.droppedCount).toBe(0);
  });
});

describe('applyPresetSnapshot', () => {
  it('overlays only keys the defaults already have', () => {
    const defaults = { a: 1, b: 2, c: 3 };
    const snapshot = { a: 10, extraneous: 999 };
    expect(applyPresetSnapshot(defaults, snapshot)).toEqual({ a: 10, b: 2, c: 3 });
  });

  it('applies without clobbering other defaults when the snapshot is missing a key (schema drift)', () => {
    const defaults = { a: 1, b: 2, c: 3 };
    const driftedSnapshot = { a: 10 }; // 'b' and 'c' didn't exist when this preset was saved
    expect(applyPresetSnapshot(defaults, driftedSnapshot)).toEqual({ a: 10, b: 2, c: 3 });
  });

  it('ignores snapshot keys the current defaults no longer have', () => {
    const defaults = { a: 1 };
    const snapshot = { a: 10, longRemovedField: 'x' };
    expect(applyPresetSnapshot(defaults, snapshot)).toEqual({ a: 10 });
  });
});
