import '../../styles/topics/theory-shared.css';
import type { Clef } from '../../lib/melody/theory';
import { WRITTEN_CHORD_QUALITIES } from '../../lib/written-theory/chordWriting';
import { useChordWritingSettings } from '../../state/settings/chord-writing';

const CLEFS: { value: Clef; label: string }[] = [
  { value: 'treble', label: 'Treble' },
  { value: 'bass', label: 'Bass' },
];

const TRIAD_IDS = ['maj', 'min', 'dim', 'aug'];
const SEVENTH_IDS = ['maj7', 'min7', 'dom7', 'halfDim7', 'dim7'];
const INVERSION_LABELS = ['Root position', 'First inversion', 'Second inversion', 'Third inversion'];

// Custom presets are aural-only in v1 (docs/13-home-and-sections.md §1
// backlog) — no SaveAsCustomTopicButton here.
export function ChordWritingSettings() {
  const settings = useChordWritingSettings();
  const setState = useChordWritingSettings.setState;
  const hasSeventh = settings.qualities.some((id) => SEVENTH_IDS.includes(id));

  function toggleQuality(id: string) {
    setState((s) => {
      const has = s.qualities.includes(id);
      const next = has ? s.qualities.filter((v) => v !== id) : [...s.qualities, id];
      if (!next.length) return s;
      // 3rd inversion only makes sense for sevenths — drop it automatically
      // if the last seventh-chord quality was just unchecked (docs §2's
      // "prevented in the UI" rule).
      const nextHasSeventh = next.some((qid) => SEVENTH_IDS.includes(qid));
      const inversions = nextHasSeventh ? s.inversions : s.inversions.filter((i) => i !== 3);
      return { qualities: next, inversions: inversions.length ? inversions : [0] };
    });
  }

  function toggleInversion(inv: number) {
    setState((s) => {
      const has = s.inversions.includes(inv);
      const next = has ? s.inversions.filter((v) => v !== inv) : [...s.inversions, inv];
      if (!next.length) return s;
      return { inversions: next };
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
      <h2>Chord writing settings</h2>
      <p className="sub" style={{ marginBottom: '0.85rem' }}>
        A chord is named — build it on an open staff, closed position.
      </p>
      <div className="grid">
        <div className="field">
          <label>Triads</label>
          <div className="theory-check-grid">
            {WRITTEN_CHORD_QUALITIES.filter((q) => TRIAD_IDS.includes(q.id)).map((q) => (
              <label key={q.id}>
                <input type="checkbox" checked={settings.qualities.includes(q.id)} onChange={() => toggleQuality(q.id)} />{' '}
                {q.label}
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Sevenths</label>
          <div className="theory-check-grid">
            {WRITTEN_CHORD_QUALITIES.filter((q) => SEVENTH_IDS.includes(q.id)).map((q) => (
              <label key={q.id}>
                <input type="checkbox" checked={settings.qualities.includes(q.id)} onChange={() => toggleQuality(q.id)} />{' '}
                {q.label}
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Inversions</label>
          <div className="theory-check-grid">
            {INVERSION_LABELS.map((label, inv) => {
              const disabled = inv === 3 && !hasSeventh;
              return (
                <label key={inv} title={disabled ? 'Enable a seventh-chord quality above first' : undefined}>
                  <input
                    type="checkbox"
                    checked={settings.inversions.includes(inv)}
                    disabled={disabled}
                    onChange={() => toggleInversion(inv)}
                  />{' '}
                  {label}
                </label>
              );
            })}
          </div>
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
          <span className="field-toggle-title" id="chord-writing-hear-it-title">
            Hear it (after submit)
          </span>
          <label className="toggle-switch">
            <input
              type="checkbox"
              aria-labelledby="chord-writing-hear-it-title"
              checked={settings.hearIt}
              onChange={(e) => setState({ hearIt: e.target.checked })}
            />
            <span className="toggle-slider" aria-hidden="true" />
          </label>
        </div>

        <div className="field field-toggle-header">
          <span className="field-toggle-title" id="chord-writing-auto-advance-title">
            Auto-advance after answer
          </span>
          <label className="toggle-switch">
            <input
              type="checkbox"
              aria-labelledby="chord-writing-auto-advance-title"
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
