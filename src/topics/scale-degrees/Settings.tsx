import '../../styles/topics/theory-shared.css';
import type { ScaleDegreeDisplay, ScaleDegreeKeysFilter, ScaleDegreeLabels } from '../../lib/written-theory/scaleDegrees';
import { useScaleDegreesSettings } from '../../state/settings/scale-degrees';

// Custom presets are aural-only in v1 (docs/13-home-and-sections.md §1
// backlog) — no SaveAsCustomTopicButton here.
export function ScaleDegreesSettings() {
  const settings = useScaleDegreesSettings();
  const setState = useScaleDegreesSettings.setState;

  return (
    <section className="card">
      <h2>Scale degree settings</h2>
      <p className="sub" style={{ marginBottom: '0.85rem' }}>
        A key and a note are shown — say which scale degree the note is.
      </p>
      <div className="grid">
        <div className="field">
          <label htmlFor="scale-degrees-keys">Keys</label>
          <select
            id="scale-degrees-keys"
            value={settings.keys}
            onChange={(e) => setState({ keys: e.target.value as ScaleDegreeKeysFilter })}
          >
            <option value="major">Majors</option>
            <option value="minor">Minors</option>
            <option value="both">Both</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="scale-degrees-max-accidentals">
            Max accidentals: <span className="valtag">{settings.maxAccidentals}</span>
          </label>
          <input
            id="scale-degrees-max-accidentals"
            type="range"
            min={0}
            max={7}
            step={1}
            value={settings.maxAccidentals}
            onChange={(e) => setState({ maxAccidentals: Number(e.target.value) })}
          />
        </div>

        <div className="field">
          <label htmlFor="scale-degrees-display">Display</label>
          <select
            id="scale-degrees-display"
            value={settings.display}
            onChange={(e) => setState({ display: e.target.value as ScaleDegreeDisplay })}
          >
            <option value="staffAndText">Staff + text</option>
            <option value="textOnly">Text only</option>
          </select>
          <div className="help">Text-only drills pure key knowledge without the staff as a visual crutch.</div>
        </div>

        <div className="field">
          <label htmlFor="scale-degrees-labels">Degree labels</label>
          <select
            id="scale-degrees-labels"
            value={settings.degreeLabels}
            onChange={(e) => setState({ degreeLabels: e.target.value as ScaleDegreeLabels })}
          >
            <option value="numbers">Numbers</option>
            <option value="names">Names</option>
          </select>
        </div>

        <div className="field field-toggle-header">
          <span className="field-toggle-title" id="scale-degrees-auto-advance-title">
            Auto-advance after answer
          </span>
          <label className="toggle-switch">
            <input
              type="checkbox"
              aria-labelledby="scale-degrees-auto-advance-title"
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
