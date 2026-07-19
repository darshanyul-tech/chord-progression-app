import '../../styles/topics/theory-shared.css';
import type { Clef } from '../../lib/melody/theory';
import type { KeySignatureAskFor } from '../../lib/written-theory/keySignatures';
import { useKeySignatureSettings } from '../../state/settings/key-signatures';

const CLEFS: { value: Clef; label: string }[] = [
  { value: 'treble', label: 'Treble' },
  { value: 'bass', label: 'Bass' },
  { value: 'alto', label: 'Alto' },
  { value: 'tenor', label: 'Tenor' },
];

// Custom presets are aural-only in v1 (docs/13-home-and-sections.md §1
// backlog) — no SaveAsCustomTopicButton here.
export function KeySignatureSettings() {
  const settings = useKeySignatureSettings();
  const setState = useKeySignatureSettings.setState;

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
      <h2>Key signature settings</h2>
      <p className="sub" style={{ marginBottom: '0.85rem' }}>
        A key signature is shown on the stave — name the key.
      </p>
      <div className="grid">
        <div className="field">
          <label htmlFor="key-signature-ask-for">Ask for</label>
          <select
            id="key-signature-ask-for"
            value={settings.askFor}
            onChange={(e) => setState({ askFor: e.target.value as KeySignatureAskFor })}
          >
            <option value="major">Major keys</option>
            <option value="minor">Minor keys</option>
            <option value="both">Both (coin flip)</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="key-signature-max-accidentals">
            Max accidentals: <span className="valtag">{settings.maxAccidentals}</span>
          </label>
          <input
            id="key-signature-max-accidentals"
            type="range"
            min={1}
            max={7}
            step={1}
            value={settings.maxAccidentals}
            onChange={(e) => setState({ maxAccidentals: Number(e.target.value) })}
          />
          <div className="help">The 0-accidental key (C / Am) is always in the pool.</div>
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
          <span className="field-toggle-title" id="key-signature-auto-advance-title">
            Auto-advance after answer
          </span>
          <label className="toggle-switch">
            <input
              type="checkbox"
              aria-labelledby="key-signature-auto-advance-title"
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
