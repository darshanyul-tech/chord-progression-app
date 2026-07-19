import '../../styles/topics/theory-shared.css';
import type { Clef } from '../../lib/melody/theory';
import { WRITTEN_SCALE_TYPES } from '../../lib/written-theory/scaleSpelling';
import type { ScaleWritingDirection } from '../../lib/written-theory/scaleWriting';
import { useScaleWritingSettings } from '../../state/settings/scale-writing';

const CLEFS: { value: Clef; label: string }[] = [
  { value: 'treble', label: 'Treble' },
  { value: 'bass', label: 'Bass' },
];

const MAJOR_MINOR_IDS = ['major', 'naturalMinor', 'harmonicMinor', 'melodicMinor'];
const MODE_IDS = WRITTEN_SCALE_TYPES.filter((t) => !MAJOR_MINOR_IDS.includes(t.id)).map((t) => t.id);

// Custom presets are aural-only in v1 (docs/13-home-and-sections.md §1
// backlog) — no SaveAsCustomTopicButton here.
export function ScaleWritingSettings() {
  const settings = useScaleWritingSettings();
  const setState = useScaleWritingSettings.setState;

  function toggleScale(id: string) {
    setState((s) => {
      const has = s.scales.includes(id);
      const next = has ? s.scales.filter((v) => v !== id) : [...s.scales, id];
      if (!next.length) return s;
      return { scales: next };
    });
  }

  function toggleClef(clef: Clef) {
    setState((s) => {
      const has = s.clefs.includes(clef);
      const next = has ? s.clefs.filter((c) => c !== clef) : [...s.clefs, clef];
      if (!next.length) return s;
      return { clefs: next };
    });
  }

  return (
    <section className="card">
      <h2>Scale writing settings</h2>
      <p className="sub" style={{ marginBottom: '0.85rem' }}>
        The tonic is given — write the rest of the requested scale on an open staff.
      </p>
      <div className="grid">
        <div className="field">
          <label>Major &amp; minor</label>
          <div className="theory-check-grid">
            {WRITTEN_SCALE_TYPES.filter((t) => MAJOR_MINOR_IDS.includes(t.id)).map((t) => (
              <label key={t.id}>
                <input type="checkbox" checked={settings.scales.includes(t.id)} onChange={() => toggleScale(t.id)} /> {t.label}
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Major modes</label>
          <div className="theory-check-grid">
            {WRITTEN_SCALE_TYPES.filter((t) => MODE_IDS.includes(t.id)).map((t) => (
              <label key={t.id}>
                <input type="checkbox" checked={settings.scales.includes(t.id)} onChange={() => toggleScale(t.id)} /> {t.label}
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="scale-writing-direction">Direction</label>
          <select
            id="scale-writing-direction"
            value={settings.direction}
            onChange={(e) => setState({ direction: e.target.value as ScaleWritingDirection })}
          >
            <option value="ascending">Ascending</option>
            <option value="descending">Descending</option>
            <option value="both">Both (coin flip)</option>
          </select>
        </div>

        <div className="field">
          <label>Clefs</label>
          <div className="theory-check-grid">
            {CLEFS.map((c) => (
              <label key={c.value}>
                <input type="checkbox" checked={settings.clefs.includes(c.value)} onChange={() => toggleClef(c.value)} />{' '}
                {c.label}
              </label>
            ))}
          </div>
        </div>

        <div className="field field-toggle-header">
          <span className="field-toggle-title" id="scale-writing-hear-it-title">
            Hear it (after submit)
          </span>
          <label className="toggle-switch">
            <input
              type="checkbox"
              aria-labelledby="scale-writing-hear-it-title"
              checked={settings.hearIt}
              onChange={(e) => setState({ hearIt: e.target.checked })}
            />
            <span className="toggle-slider" aria-hidden="true" />
          </label>
        </div>

        <div className="field field-toggle-header">
          <span className="field-toggle-title" id="scale-writing-auto-advance-title">
            Auto-advance after answer
          </span>
          <label className="toggle-switch">
            <input
              type="checkbox"
              aria-labelledby="scale-writing-auto-advance-title"
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
