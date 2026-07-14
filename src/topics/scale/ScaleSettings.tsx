import { SCALE_RECOGNITION_GROUPS, SCALE_RECOGNITION_TYPES } from '../../lib/recognition/scales';
import { useScaleRecognitionSettings } from '../../state/settings/scales';

export function ScaleSettings() {
  const settings = useScaleRecognitionSettings();
  const setState = useScaleRecognitionSettings.setState;

  function toggleType(id: string) {
    setState((s) => {
      const enabled = new Set(s.enabledScales);
      if (enabled.has(id)) enabled.delete(id);
      else enabled.add(id);
      return { enabledScales: [...enabled] };
    });
  }

  function toggleAllInGroup(groupId: string) {
    const idsInGroup = SCALE_RECOGNITION_TYPES.filter((t) => t.group === groupId).map((t) => t.id);
    setState((s) => {
      const enabled = new Set(s.enabledScales);
      const allOn = idsInGroup.every((id) => enabled.has(id));
      idsInGroup.forEach((id) => {
        if (allOn) enabled.delete(id);
        else enabled.add(id);
      });
      return { enabledScales: [...enabled] };
    });
  }

  return (
    <section className="card">
      <h2>Scales to practise</h2>
      <div className="help">
        Choose which scales can appear. Scales play up to the octave from a random root (between C2 and C5).
      </div>
      <div className="chord-type-groups">
        {SCALE_RECOGNITION_GROUPS.map((grp) => {
          const types = SCALE_RECOGNITION_TYPES.filter((t) => t.group === grp.id);
          if (!types.length) return null;
          return (
            <div key={grp.id} className="chord-type-group">
              <div className="chord-type-group-header">
                <h3 className="chord-type-group-title">{grp.title}</h3>
                <button
                  type="button"
                  className="toggle-all-btn"
                  aria-label={`Toggle all in ${grp.title}`}
                  onClick={() => toggleAllInGroup(grp.id)}
                >
                  All
                </button>
              </div>
              <div className="chord-type-checks">
                {types.map((def) => (
                  <label key={def.id}>
                    <input
                      type="checkbox"
                      checked={settings.enabledScales.includes(def.id)}
                      onChange={() => toggleType(def.id)}
                    />
                    {def.label}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="field" style={{ marginTop: '0.85rem' }}>
        <div className="field-toggle-header">
          <span className="field-toggle-title">Play descending after ascending</span>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.descend}
              onChange={(e) => setState({ descend: e.target.checked })}
            />
            <span className="toggle-slider" aria-hidden="true" />
          </label>
        </div>
        <div className="help">When on, after reaching the octave the scale plays back down to the starting note.</div>
      </div>

      <div className="grid" style={{ marginTop: '0.85rem' }}>
        <div className="field">
          <label htmlFor="scaleNoteLen">
            Note length: <span className="valtag">{settings.noteLen.toFixed(2)}</span>s
          </label>
          <input
            id="scaleNoteLen"
            type="range"
            min={0.2}
            max={0.9}
            step={0.05}
            value={settings.noteLen}
            onChange={(e) => setState({ noteLen: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label htmlFor="scaleNoteGap">
            Gap between notes: <span className="valtag">{settings.noteGap.toFixed(2)}</span>s
          </label>
          <input
            id="scaleNoteGap"
            type="range"
            min={0}
            max={0.35}
            step={0.02}
            value={settings.noteGap}
            onChange={(e) => setState({ noteGap: Number(e.target.value) })}
          />
        </div>
      </div>
    </section>
  );
}
