import '../../styles/topics/theory-shared.css';
import type { Clef } from '../../lib/melody/theory';
import { INTERVALS } from '../../lib/written-theory/spelledPitch';
import type { IntervalPhrasing, TranspositionMode } from '../../lib/written-theory/transposition';
import { useTranspositionSettings } from '../../state/settings/transposition';

// Custom presets are aural-only in v1 (docs/13-home-and-sections.md §1
// backlog) — no SaveAsCustomTopicButton here.
export function TranspositionSettings() {
  const settings = useTranspositionSettings();
  const setState = useTranspositionSettings.setState;

  function toggleInterval(id: string) {
    setState((s) => {
      const has = s.intervals.includes(id);
      const next = has ? s.intervals.filter((v) => v !== id) : [...s.intervals, id];
      if (!next.length) return s;
      return { intervals: next };
    });
  }

  return (
    <section className="card">
      <h2>Transposition settings</h2>
      <p className="sub" style={{ marginBottom: '0.85rem' }}>
        A short melody is given — rewrite it transposed, keeping the same rhythm.
      </p>
      <div className="grid">
        <div className="field">
          <label htmlFor="transposition-mode">Mode</label>
          <select
            id="transposition-mode"
            value={settings.mode}
            onChange={(e) => setState({ mode: e.target.value as TranspositionMode })}
          >
            <option value="toKey">To a key</option>
            <option value="byInterval">By interval</option>
            <option value="both">Both (coin flip)</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="transposition-phrasing">Interval phrasing (by-interval prompts only)</label>
          <select
            id="transposition-phrasing"
            value={settings.phrasing}
            onChange={(e) => setState({ phrasing: e.target.value as IntervalPhrasing })}
          >
            <option value="names">Interval names</option>
            <option value="semitones">Semitones</option>
            <option value="mixed">Mixed (coin flip)</option>
          </select>
        </div>

        <div className="field">
          <label>Intervals (by-interval mode)</label>
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
          <label htmlFor="transposition-length">Length</label>
          <select
            id="transposition-length"
            value={settings.length}
            onChange={(e) => setState({ length: Number(e.target.value) as 1 | 2 })}
          >
            <option value={1}>1 bar</option>
            <option value={2}>2 bars</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="transposition-clef">Clef</label>
          <select id="transposition-clef" value={settings.clef} onChange={(e) => setState({ clef: e.target.value as Clef })}>
            <option value="treble">Treble</option>
            <option value="bass">Bass</option>
          </select>
        </div>

        <div className="field field-toggle-header">
          <span className="field-toggle-title" id="transposition-auto-advance-title">
            Auto-advance after answer
          </span>
          <label className="toggle-switch">
            <input
              type="checkbox"
              aria-labelledby="transposition-auto-advance-title"
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
