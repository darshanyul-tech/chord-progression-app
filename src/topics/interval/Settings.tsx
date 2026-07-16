import { IntervalMatrix } from '../../components/IntervalMatrix';
import { SaveAsCustomTopicButton } from '../../components/SaveAsCustomTopicButton';
import { INTERVAL_TYPES, type IntervalDirectionMode } from '../../lib/recognition/intervals';
import { useIntervalRecognitionSettings } from '../../state/settings/interval-recognition';

export function IntervalSettings() {
  const settings = useIntervalRecognitionSettings();
  const setState = useIntervalRecognitionSettings.setState;

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
      <h2>Interval settings</h2>
      <div className="field">
        <label htmlFor="intervalDirection">Practice direction</label>
        <select
          id="intervalDirection"
          value={settings.direction}
          onChange={(e) => setState({ direction: e.target.value as IntervalDirectionMode })}
        >
          <option value="asc">Ascending only</option>
          <option value="desc">Descending only</option>
          <option value="both">Ascending and descending</option>
        </select>
        <div className="help">Controls whether you hear low&rarr;high, high&rarr;low, or a mix.</div>
      </div>

      <div className="field">
        <span className="field-toggle-title">Intervals to include</span>
        <div className="help">
          Tick which qualities can appear for each direction. At least one interval and one direction must be enabled.
        </div>
        <IntervalMatrix
          enabledIntervals={settings.enabledIntervals}
          onToggleCell={toggleCell}
          onToggleAll={toggleAll}
        />
      </div>

      <div className="grid">
        <div className="field">
          <label htmlFor="intervalNoteLen">
            Note length: <span className="valtag">{settings.noteLen.toFixed(2)}</span>s
          </label>
          <input
            id="intervalNoteLen"
            type="range"
            min={0.25}
            max={1.2}
            step={0.05}
            value={settings.noteLen}
            onChange={(e) => setState({ noteLen: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label htmlFor="intervalGap">
            Gap between notes: <span className="valtag">{settings.gapLen.toFixed(2)}</span>s
          </label>
          <input
            id="intervalGap"
            type="range"
            min={0}
            max={0.5}
            step={0.02}
            value={settings.gapLen}
            onChange={(e) => setState({ gapLen: Number(e.target.value) })}
          />
        </div>
      </div>

      <SaveAsCustomTopicButton topicId="interval-recognition" getSettings={() => useIntervalRecognitionSettings.getState()} />
    </section>
  );
}
