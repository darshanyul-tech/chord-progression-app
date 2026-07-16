import { ARTICULATION_TABLE } from '../../lib/recognition/dynamicsArticulation';
import type { ArticulationId, DADifficulty, DAMode } from '../../lib/recognition/dynamicsArticulation';
import { useDynamicsArticulationSettings } from '../../state/settings/dynamics-articulation';

export function DynamicsArticulationSettings() {
  const settings = useDynamicsArticulationSettings();
  const setState = useDynamicsArticulationSettings.setState;

  function toggleArticulation(id: ArticulationId) {
    setState((s) => {
      const enabled = new Set(s.enabledArticulations);
      if (enabled.has(id)) enabled.delete(id);
      else enabled.add(id);
      return { enabledArticulations: [...enabled] };
    });
  }

  return (
    <section className="card">
      <h2>Dynamics &amp; articulation settings</h2>
      <p className="sub" style={{ marginBottom: '0.85rem' }}>
        A short phrase plays — judge either its loudness change or its articulation.
      </p>

      <div className="field">
        <label htmlFor="daMode">Mode</label>
        <select id="daMode" value={settings.mode} onChange={(e) => setState({ mode: e.target.value as DAMode })}>
          <option value="dynamics">Dynamics — is the second hearing louder, softer, or the same?</option>
          <option value="articulation">Articulation — which touch did you hear?</option>
        </select>
      </div>

      {settings.mode === 'dynamics' && (
        <div className="field">
          <label htmlFor="daDifficulty">Difficulty</label>
          <select
            id="daDifficulty"
            value={settings.difficulty}
            onChange={(e) => setState({ difficulty: e.target.value as DADifficulty })}
          >
            <option value="easy">Easy (large gap)</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard (subtle gap)</option>
          </select>
        </div>
      )}

      {settings.mode === 'articulation' && (
        <div className="field">
          <span className="field-toggle-title">Articulations to include</span>
          <div className="help">At least two must be enabled.</div>
          <div className="dynamics-articulation-type-checks">
            {ARTICULATION_TABLE.map((a) => (
              <label key={a.id}>
                <input
                  type="checkbox"
                  checked={settings.enabledArticulations.includes(a.id)}
                  onChange={() => toggleArticulation(a.id)}
                />{' '}
                {a.label}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="grid" style={{ marginTop: '0.5rem' }}>
        <div className="field">
          <label htmlFor="daPhraseLen">Phrase length (notes)</label>
          <select
            id="daPhraseLen"
            value={settings.phraseLen}
            onChange={(e) => setState({ phraseLen: Number(e.target.value) })}
          >
            <option value={3}>3 notes</option>
            <option value={4}>4 notes</option>
            <option value={5}>5 notes</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="daTempo">
            Tempo: <span className="valtag">{settings.tempo}</span> BPM
          </label>
          <input
            id="daTempo"
            type="range"
            min={60}
            max={140}
            step={1}
            value={settings.tempo}
            onChange={(e) => setState({ tempo: Number(e.target.value) })}
          />
        </div>
      </div>
    </section>
  );
}
