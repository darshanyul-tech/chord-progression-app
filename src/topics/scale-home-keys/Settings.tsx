import '../../styles/topics/theory-shared.css';
import { SCALE_HOME_KEY_MODES, type ScaleHomeKeyModeId, type ScaleHomeKeyReverse } from '../../lib/written-theory/scaleHomeKeys';
import { useScaleHomeKeysSettings } from '../../state/settings/scale-home-keys';

// Custom presets are aural-only in v1 (docs/13-home-and-sections.md §1
// backlog) — no SaveAsCustomTopicButton here.
export function ScaleHomeKeysSettings() {
  const settings = useScaleHomeKeysSettings();
  const setState = useScaleHomeKeysSettings.setState;

  function toggleMode(id: ScaleHomeKeyModeId) {
    setState((s) => {
      const has = s.modes.includes(id);
      const next = has ? s.modes.filter((m) => m !== id) : [...s.modes, id];
      if (!next.length) return s;
      return { modes: next };
    });
  }

  return (
    <section className="card">
      <h2>Scale home key settings</h2>
      <p className="sub" style={{ marginBottom: '0.85rem' }}>
        A mode on a tonic is shown — name its home key (the major scale it comes from).
      </p>
      <div className="grid">
        <div className="field">
          <label>Modes</label>
          <div className="theory-check-grid">
            {SCALE_HOME_KEY_MODES.map((m) => (
              <label key={m.id}>
                <input type="checkbox" checked={settings.modes.includes(m.id)} onChange={() => toggleMode(m.id)} /> {m.label}
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="scale-home-keys-max-accidentals">
            Max home-key accidentals: <span className="valtag">{settings.maxAccidentals}</span>
          </label>
          <input
            id="scale-home-keys-max-accidentals"
            type="range"
            min={1}
            max={7}
            step={1}
            value={settings.maxAccidentals}
            onChange={(e) => setState({ maxAccidentals: Number(e.target.value) })}
          />
        </div>

        <div className="field">
          <label htmlFor="scale-home-keys-reverse">Reverse questions</label>
          <select
            id="scale-home-keys-reverse"
            value={settings.reverse}
            onChange={(e) => setState({ reverse: e.target.value as ScaleHomeKeyReverse })}
          >
            <option value="off">Off</option>
            <option value="mixed">Mixed (coin flip)</option>
            <option value="only">Only</option>
          </select>
        </div>

        <div className="field field-toggle-header">
          <span className="field-toggle-title" id="scale-home-keys-auto-advance-title">
            Auto-advance after answer
          </span>
          <label className="toggle-switch">
            <input
              type="checkbox"
              aria-labelledby="scale-home-keys-auto-advance-title"
              checked={settings.autoAdvance}
              onChange={(e) => setState({ autoAdvance: e.target.checked })}
            />
            <span className="toggle-slider" aria-hidden="true" />
          </label>
        </div>
      </div>
    </section>
  );
}
