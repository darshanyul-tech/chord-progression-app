import '../../styles/topics/theory-shared.css';
import { METER_PAIRS, type MeterDifficulty, type MeterDirectionSetting } from '../../lib/written-theory/meterTransposition';
import { useMeterTranspositionSettings } from '../../state/settings/meter-transposition';

export function MeterTranspositionSettings() {
  const settings = useMeterTranspositionSettings();
  const setState = useMeterTranspositionSettings.setState;

  function togglePair(id: string) {
    setState((s) => {
      const has = s.pairs.includes(id);
      const next = has ? s.pairs.filter((v) => v !== id) : [...s.pairs, id];
      if (!next.length) return s;
      return { pairs: next };
    });
  }

  return (
    <section className="card">
      <h2>Meter Transposition settings</h2>
      <p className="sub" style={{ marginBottom: '0.85rem' }}>
        A short rhythm is given in one meter — rewrite it in the paired meter so it sounds identical, converting
        between compound and simple time.
      </p>
      <div className="grid">
        <div className="field">
          <label>Meter pairs</label>
          <div className="theory-check-grid">
            {METER_PAIRS.map((pair) => (
              <label key={pair.id}>
                <input type="checkbox" checked={settings.pairs.includes(pair.id)} onChange={() => togglePair(pair.id)} />{' '}
                {pair.compound} &#8596; {pair.simple}
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="meter-transposition-direction">Direction</label>
          <select
            id="meter-transposition-direction"
            value={settings.direction}
            onChange={(e) => setState({ direction: e.target.value as MeterDirectionSetting })}
          >
            <option value="compoundToSimple">Compound &#8594; simple</option>
            <option value="simpleToCompound">Simple &#8594; compound</option>
            <option value="both">Both (coin flip)</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="meter-transposition-difficulty">Difficulty</label>
          <select
            id="meter-transposition-difficulty"
            value={settings.difficulty}
            onChange={(e) => setState({ difficulty: e.target.value as MeterDifficulty })}
          >
            <option value="basic">Basic</option>
            <option value="full">Full</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="meter-transposition-bars">Bars</label>
          <select id="meter-transposition-bars" value={settings.bars} onChange={(e) => setState({ bars: Number(e.target.value) as 1 | 2 })}>
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </div>

        <div className="field field-toggle-header">
          <span className="field-toggle-title" id="meter-transposition-auto-advance-title">
            Auto-advance after answer
          </span>
          <label className="toggle-switch">
            <input
              type="checkbox"
              aria-labelledby="meter-transposition-auto-advance-title"
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
