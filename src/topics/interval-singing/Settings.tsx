import { IntervalMatrix } from '../../components/IntervalMatrix';
import { INTERVAL_TYPES, type IntervalDirectionMode } from '../../lib/recognition/intervals';
import type { RootRangePreset } from '../../lib/pitch/question';
import type { ToleranceLevel } from '../../lib/pitch/settings';
import { useIntervalSingingSettings } from '../../state/settings/interval-singing';

export function SingingSettings() {
  const settings = useIntervalSingingSettings();
  const setState = useIntervalSingingSettings.setState;

  function toggleCell(id: string, dir: 'asc' | 'desc') {
    setState((s) => ({
      enabledIntervals: {
        ...s.enabledIntervals,
        [id]: { ...s.enabledIntervals[id], [dir]: !s.enabledIntervals[id]?.[dir] },
      },
    }));
  }

  function toggleAll(dir: 'asc' | 'desc') {
    setState((s) => {
      const allOn = INTERVAL_TYPES.every((t) => s.enabledIntervals[t.id]?.[dir]);
      const next = { ...s.enabledIntervals };
      INTERVAL_TYPES.forEach((t) => {
        next[t.id] = { ...next[t.id], [dir]: !allOn } as { asc: boolean; desc: boolean };
      });
      return { enabledIntervals: next };
    });
  }

  return (
    <section className="card">
      <h2>Interval singing settings</h2>
      <p className="sub" style={{ marginBottom: '0.85rem' }}>
        A root note plays; sing the named interval above or below it. Audio never leaves your device — no recording,
        no upload.
      </p>

      <div className="field">
        <label htmlFor="singingDirection">Practice direction</label>
        <select
          id="singingDirection"
          value={settings.direction}
          onChange={(e) => setState({ direction: e.target.value as IntervalDirectionMode })}
        >
          <option value="asc">Above the root only</option>
          <option value="desc">Below the root only</option>
          <option value="both">Above and below</option>
        </select>
      </div>

      <div className="field">
        <span className="field-toggle-title">Intervals to include</span>
        <div className="help">Tick which intervals can appear for each direction.</div>
        <IntervalMatrix
          enabledIntervals={settings.enabledIntervals}
          onToggleCell={toggleCell}
          onToggleAll={toggleAll}
          ascLabel="Above"
          descLabel="Below"
        />
      </div>

      <div className="grid">
        <div className="field">
          <label htmlFor="singingRootRange">Root note range</label>
          <select
            id="singingRootRange"
            value={settings.rootRange}
            onChange={(e) => setState({ rootRange: e.target.value as RootRangePreset })}
          >
            <option value="auto">Auto (widest comfortable range)</option>
            <option value="male">Male voice (comfortable low/mid)</option>
            <option value="female">Female voice (comfortable mid/high)</option>
          </select>
          <div className="help">Keeps the root — and the sung target — inside a comfortable singing range.</div>
        </div>

        <div className="field">
          <label htmlFor="singingTolerance">Grading tolerance</label>
          <select
            id="singingTolerance"
            value={settings.tolerance}
            onChange={(e) => setState({ tolerance: e.target.value as ToleranceLevel })}
          >
            <option value="strict">Strict (±30¢)</option>
            <option value="default">Default (±50¢)</option>
            <option value="relaxed">Relaxed (±75¢)</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="singingHoldTime">
            Hold time required: <span className="valtag">{settings.holdTimeSec.toFixed(1)}</span>s
          </label>
          <input
            id="singingHoldTime"
            type="range"
            min={0.2}
            max={1.5}
            step={0.1}
            value={settings.holdTimeSec}
            onChange={(e) => setState({ holdTimeSec: Number(e.target.value) })}
          />
          <div className="help">How long you must hold a steady pitch before it's captured as your answer.</div>
        </div>
      </div>

      <div className="field-toggle-header" style={{ marginTop: '0.5rem' }}>
        <span className="field-toggle-title" id="singing-octave-eq-title">Octave equivalence</span>
        <label className="toggle-switch">
          <input
            type="checkbox"
            aria-labelledby="singing-octave-eq-title"
            checked={settings.octaveEquivalence}
            onChange={(e) => setState({ octaveEquivalence: e.target.checked })}
          />
          <span className="toggle-slider" aria-hidden="true" />
        </label>
      </div>
      <div className="help">
        When on, singing the right pitch class in any octave counts as correct — singers naturally shift octaves.
      </div>

      <div className="field-toggle-header" style={{ marginTop: '0.5rem' }}>
        <span className="field-toggle-title" id="singing-auto-advance-title">Auto-advance after a correct answer</span>
        <label className="toggle-switch">
          <input
            type="checkbox"
            aria-labelledby="singing-auto-advance-title"
            checked={settings.autoAdvance}
            onChange={(e) => setState({ autoAdvance: e.target.checked })}
          />
          <span className="toggle-slider" aria-hidden="true" />
        </label>
      </div>
      <div className="help">
        When on, the next question starts automatically after you sing an interval correctly. Missed rounds always
        wait, so you can review the reveal.
      </div>
    </section>
  );
}
