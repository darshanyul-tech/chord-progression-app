import '../../styles/topics/theory-shared.css';
import type { Clef } from '../../lib/melody/theory';
import type { NoteReadingAccidentalMode, NoteReadingRange } from '../../lib/written-theory/noteReading';
import { useNoteReadingSettings } from '../../state/settings/note-reading';

const CLEFS: { value: Clef; label: string }[] = [
  { value: 'treble', label: 'Treble' },
  { value: 'bass', label: 'Bass' },
  { value: 'alto', label: 'Alto' },
  { value: 'tenor', label: 'Tenor' },
];

// Custom presets are aural-only in v1 (docs/13-home-and-sections.md §1
// backlog) — no SaveAsCustomTopicButton here, unlike the aural settings cards.
export function NoteReadingSettings() {
  const settings = useNoteReadingSettings();
  const setState = useNoteReadingSettings.setState;

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
      <h2>Note reading settings</h2>
      <p className="sub" style={{ marginBottom: '0.85rem' }}>
        A note is shown on the staff — name it.
      </p>
      <div className="grid">
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

        <div className="field">
          <label htmlFor="note-reading-range">Range</label>
          <select
            id="note-reading-range"
            value={settings.range}
            onChange={(e) => setState({ range: e.target.value as NoteReadingRange })}
          >
            <option value="staffOnly">Staff only</option>
            <option value="ledger2">Staff + 2 ledger lines (each side)</option>
            <option value="ledger4">Staff + 4 ledger lines (each side)</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="note-reading-accidentals">Accidentals</label>
          <select
            id="note-reading-accidentals"
            value={settings.accidentals}
            onChange={(e) => setState({ accidentals: e.target.value as NoteReadingAccidentalMode })}
          >
            <option value="naturalsOnly">Naturals only</option>
            <option value="naturalsAndAccidentals">Naturals + sharps &amp; flats</option>
          </select>
        </div>

        <div className="field field-toggle-header">
          <span className="field-toggle-title" id="note-reading-octave-title">
            Show octave numbers
          </span>
          <label className="toggle-switch">
            <input
              type="checkbox"
              aria-labelledby="note-reading-octave-title"
              checked={settings.octaveNumbers}
              onChange={(e) => setState({ octaveNumbers: e.target.checked })}
            />
            <span className="toggle-slider" aria-hidden="true" />
          </label>
        </div>

        <div className="field field-toggle-header">
          <span className="field-toggle-title" id="note-reading-auto-advance-title">
            Auto-advance after answer
          </span>
          <label className="toggle-switch">
            <input
              type="checkbox"
              aria-labelledby="note-reading-auto-advance-title"
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
