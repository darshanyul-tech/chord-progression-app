import '../../styles/topics/theory-shared.css';
import type { Clef } from '../../lib/melody/theory';
import { INTERVALS } from '../../lib/written-theory/spelledPitch';
import type { IntervalWritingDirection } from '../../lib/written-theory/intervalWriting';
import { useIntervalWritingSettings } from '../../state/settings/interval-writing';

const CLEFS: { value: Clef; label: string }[] = [
  { value: 'treble', label: 'Treble' },
  { value: 'bass', label: 'Bass' },
  { value: 'alto', label: 'Alto' },
  { value: 'tenor', label: 'Tenor' },
];

// Custom presets are aural-only in v1 (docs/13-home-and-sections.md §1
// backlog) — no SaveAsCustomTopicButton here.
export function IntervalWritingSettings() {
  const settings = useIntervalWritingSettings();
  const setState = useIntervalWritingSettings.setState;

  function toggleInterval(id: string) {
    setState((s) => {
      const has = s.intervals.includes(id);
      const next = has ? s.intervals.filter((v) => v !== id) : [...s.intervals, id];
      if (!next.length) return s;
      return { intervals: next };
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
      <h2>Interval writing settings</h2>
      <p className="sub" style={{ marginBottom: '0.85rem' }}>
        A note is given — write the requested interval above or below it.
      </p>
      <div className="grid">
        <div className="field">
          <label>Intervals</label>
          <div className="theory-check-grid">
            {INTERVALS.filter((iv) => iv.id !== 'P1').map((iv) => (
              <label key={iv.id}>
                <input type="checkbox" checked={settings.intervals.includes(iv.id)} onChange={() => toggleInterval(iv.id)} />{' '}
                {iv.label}
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="interval-writing-direction">Direction</label>
          <select
            id="interval-writing-direction"
            value={settings.direction}
            onChange={(e) => setState({ direction: e.target.value as IntervalWritingDirection })}
          >
            <option value="above">Above</option>
            <option value="below">Below</option>
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
          <span className="field-toggle-title" id="interval-writing-hear-it-title">
            Hear it (after submit)
          </span>
          <label className="toggle-switch">
            <input
              type="checkbox"
              aria-labelledby="interval-writing-hear-it-title"
              checked={settings.hearIt}
              onChange={(e) => setState({ hearIt: e.target.checked })}
            />
            <span className="toggle-slider" aria-hidden="true" />
          </label>
        </div>

        <div className="field field-toggle-header">
          <span className="field-toggle-title" id="interval-writing-auto-advance-title">
            Auto-advance after answer
          </span>
          <label className="toggle-switch">
            <input
              type="checkbox"
              aria-labelledby="interval-writing-auto-advance-title"
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
