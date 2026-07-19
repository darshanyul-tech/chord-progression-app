import '../../styles/topics/custom-topic.css';
import { useNavigate } from 'react-router-dom';
import { getTopic, topicPath } from '../registry';
import { useCustomPresets } from '../../state/customPresets';

// Custom Topics v1 is settings presets, not exercise authoring
// (docs/05-topics/14-custom-topics.md §1) — a preset is a named snapshot of
// one existing topic's settings; opening it overwrites that topic's live
// settings (same store, no shadow copy) and navigates there.
export function CustomTopicManagementPage() {
  const navigate = useNavigate();
  const presets = useCustomPresets((s) => s.presets);
  const droppedCount = useCustomPresets((s) => s.droppedCount);
  const applyPreset = useCustomPresets((s) => s.applyPreset);
  const renamePreset = useCustomPresets((s) => s.renamePreset);
  const deletePreset = useCustomPresets((s) => s.deletePreset);

  function open(id: string, topicId: string) {
    applyPreset(id);
    navigate(topicPath(topicId));
  }

  function rename(id: string, currentName: string) {
    const next = window.prompt('Rename this custom topic:', currentName);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed) return;
    renamePreset(id, trimmed);
  }

  function remove(id: string, name: string) {
    if (window.confirm(`Delete the custom topic "${name}"? This can't be undone.`)) {
      deletePreset(id);
    }
  }

  return (
    <section className="card">
      <h2>Your custom topics</h2>
      <p className="sub">
        A custom topic is a named snapshot of one topic's settings — not a new exercise. Save one from any topic's
        settings card ("Save as custom topic…"), then reopen it here to restore those settings and jump straight
        back in. Opening a preset overwrites that topic's current settings; full custom-exercise authoring isn't
        part of this feature.
      </p>

      {droppedCount > 0 && (
        <p className="help" role="status">
          {droppedCount} preset{droppedCount === 1 ? '' : 's'} hidden — {droppedCount === 1 ? 'its topic is' : 'their topics are'}{' '}
          no longer available.
        </p>
      )}

      {presets.length === 0 ? (
        <p className="help">No custom topics saved yet.</p>
      ) : (
        <ul className="custom-preset-list">
          {presets.map((preset) => {
            const originTitle = getTopic(preset.topicId)?.title ?? preset.topicId;
            return (
              <li key={preset.id} className="custom-preset-row">
                <div className="custom-preset-info">
                  <span className="custom-preset-name">{preset.name}</span>
                  <span className="custom-preset-origin">{originTitle}</span>
                </div>
                <div className="buttons">
                  <button type="button" onClick={() => open(preset.id, preset.topicId)}>
                    Open
                  </button>
                  <button type="button" className="secondary" onClick={() => rename(preset.id, preset.name)}>
                    Rename
                  </button>
                  <button type="button" className="ghost" onClick={() => remove(preset.id, preset.name)}>
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
