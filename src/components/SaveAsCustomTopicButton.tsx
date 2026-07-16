import { useState } from 'react';
import { validatePresetName } from '../lib/custom/presets';
import { useCustomPresets } from '../state/customPresets';

/**
 * Wired into every active topic's Settings card (docs/05-topics/14-custom-topics.md §2) —
 * saves a named snapshot of that topic's current live settings. Presets are
 * explicit snapshots, not a live binding: editing settings afterward doesn't
 * change a preset already saved.
 */
export function SaveAsCustomTopicButton({
  topicId,
  getSettings,
}: {
  topicId: string;
  getSettings: () => Record<string, unknown>;
}) {
  const presets = useCustomPresets((s) => s.presets);
  const addPreset = useCustomPresets((s) => s.addPreset);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  function handleSave() {
    const err = validatePresetName(
      name,
      presets.map((p) => p.name),
    );
    if (err) {
      setError(err);
      setSaved(false);
      return;
    }
    addPreset(topicId, name, getSettings());
    setName('');
    setError('');
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="save-preset-row">
      <input
        type="text"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setError('');
        }}
        placeholder="Preset name"
        aria-label="Custom topic preset name"
        maxLength={40}
      />
      <button type="button" className="secondary" onClick={handleSave}>
        Save as custom topic…
      </button>
      {error && (
        <span className="save-preset-error" role="alert">
          {error}
        </span>
      )}
      {saved && (
        <span className="save-preset-success" role="status">
          Saved to Custom Topics.
        </span>
      )}
    </div>
  );
}
