import { INTERVAL_TYPES } from '../../lib/recognition/intervals';
import type {
  ComparisonDifficulty,
  ComparisonDirectionMode,
  ComparisonRootRelationship,
} from '../../lib/recognition/intervalComparison';
import { useIntervalComparisonSettings } from '../../state/settings/interval-comparison';

export function IntervalComparisonSettings() {
  const settings = useIntervalComparisonSettings();
  const setState = useIntervalComparisonSettings.setState;

  function toggleType(id: string) {
    setState((s) => ({ enabledIntervals: { ...s.enabledIntervals, [id]: !s.enabledIntervals[id] } }));
  }

  function toggleAll() {
    setState((s) => {
      const allOn = INTERVAL_TYPES.every((t) => s.enabledIntervals[t.id]);
      const next: Record<string, boolean> = {};
      INTERVAL_TYPES.forEach((t) => {
        next[t.id] = !allOn;
      });
      return { enabledIntervals: next };
    });
  }

  return (
    <section className="card">
      <h2>Interval comparison settings</h2>
      <p className="sub" style={{ marginBottom: '0.85rem' }}>
        Two intervals play in sequence — say which is larger (or, if enabled, that they're the same).
      </p>

      <div className="field">
        <div className="field-toggle-header">
          <span className="field-toggle-title" id="comparison-intervals-title">
            Intervals to include
          </span>
          <button type="button" className="toggle-all-btn" aria-label="Toggle all intervals" onClick={toggleAll}>
            All
          </button>
        </div>
        <div className="help">At least two intervals must be enabled.</div>
        <div className="interval-comparison-type-checks">
          {INTERVAL_TYPES.map((t) => (
            <label key={t.id}>
              <input type="checkbox" checked={!!settings.enabledIntervals[t.id]} onChange={() => toggleType(t.id)} />{' '}
              {t.label}
            </label>
          ))}
        </div>
      </div>

      <div className="grid">
        <div className="field">
          <label htmlFor="comparisonDirection">Direction</label>
          <select
            id="comparisonDirection"
            value={settings.direction}
            onChange={(e) => setState({ direction: e.target.value as ComparisonDirectionMode })}
          >
            <option value="asc">Ascending only</option>
            <option value="desc">Descending only</option>
            <option value="both">Both (one direction per pair)</option>
          </select>
          <div className="help">Both intervals in a question always share one direction, so size is the only variable.</div>
        </div>

        <div className="field">
          <label htmlFor="comparisonDifficulty">Difficulty</label>
          <select
            id="comparisonDifficulty"
            value={settings.difficulty}
            onChange={(e) => setState({ difficulty: e.target.value as ComparisonDifficulty })}
          >
            <option value="easy">Easy (sizes differ by 3+ semitones)</option>
            <option value="medium">Medium (2+ semitones)</option>
            <option value="hard">Hard (adjacent sizes allowed, 1+ semitone)</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="comparisonRootRelationship">Root relationship</label>
          <select
            id="comparisonRootRelationship"
            value={settings.rootRelationship}
            onChange={(e) => setState({ rootRelationship: e.target.value as ComparisonRootRelationship })}
          >
            <option value="different">Different roots</option>
            <option value="same">Same root</option>
          </select>
          <div className="help">Same-root pairs are easier — pure size comparison without re-anchoring by ear.</div>
        </div>
      </div>

      <div className="field-toggle-header" style={{ marginTop: '0.5rem' }}>
        <span className="field-toggle-title" id="comparison-allow-same-title">
          Allow "Same" questions
        </span>
        <label className="toggle-switch">
          <input
            type="checkbox"
            aria-labelledby="comparison-allow-same-title"
            checked={settings.allowSame}
            onChange={(e) => setState({ allowSame: e.target.checked })}
          />
          <span className="toggle-slider" aria-hidden="true" />
        </label>
      </div>
      <div className="help">
        When on, about 1 in 4 questions play the same interval type twice (different roots) and "Same" joins the
        answer choices.
      </div>

      <div className="grid" style={{ marginTop: '0.5rem' }}>
        <div className="field">
          <label htmlFor="comparisonNoteLen">
            Note length: <span className="valtag">{settings.noteLen.toFixed(2)}</span>s
          </label>
          <input
            id="comparisonNoteLen"
            type="range"
            min={0.25}
            max={1.2}
            step={0.05}
            value={settings.noteLen}
            onChange={(e) => setState({ noteLen: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label htmlFor="comparisonGap">
            Gap between notes: <span className="valtag">{settings.gapLen.toFixed(2)}</span>s
          </label>
          <input
            id="comparisonGap"
            type="range"
            min={0}
            max={0.5}
            step={0.02}
            value={settings.gapLen}
            onChange={(e) => setState({ gapLen: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label htmlFor="comparisonPairPause">
            Pause between intervals: <span className="valtag">{settings.pairPauseSec.toFixed(2)}</span>s
          </label>
          <input
            id="comparisonPairPause"
            type="range"
            min={0.3}
            max={2.0}
            step={0.1}
            value={settings.pairPauseSec}
            onChange={(e) => setState({ pairPauseSec: Number(e.target.value) })}
          />
        </div>
      </div>
    </section>
  );
}
