import { useRhythmDictationSettings } from '../../state/settings/rhythm-dictation';

const TIME_SIGS = ['2/4', '3/4', '4/4', '5/4', '3/8', '6/8', '9/8', '12/8'];
const DURATIONS: { value: number; label: string }[] = [
  { value: 4, label: 'Whole' },
  { value: 2, label: 'Half' },
  { value: 1, label: 'Quarter' },
  { value: 0.5, label: 'Eighth' },
  { value: 0.25, label: 'Sixteenth' },
  { value: 1.5, label: 'Dotted quarter' },
  { value: 0.75, label: 'Dotted eighth' },
  { value: 2.5, label: 'Dotted half' },
];
const SOUND_TYPES: { value: 'percussive' | 'instrumental' | 'melodic'; label: string }[] = [
  { value: 'percussive', label: 'Percussive' },
  { value: 'instrumental', label: 'Instrumental' },
  { value: 'melodic', label: 'Melodic' },
];

export function RhythmSettings() {
  const settings = useRhythmDictationSettings();
  const setState = useRhythmDictationSettings.setState;

  function toggleSig(sig: string) {
    setState((s) => {
      const has = s.signatures.includes(sig);
      const next = has ? s.signatures.filter((v) => v !== sig) : [...s.signatures, sig];
      if (!next.length) return s; // legacy guard: at least one signature must remain enabled
      return { signatures: next };
    });
  }

  function toggleDur(value: number) {
    setState((s) => {
      const has = s.durations.includes(value);
      const next = has ? s.durations.filter((v) => v !== value) : [...s.durations, value];
      if (next.length < 1) return s; // legacy guard: at least one duration must remain enabled
      return { durations: next };
    });
  }

  return (
    <section className="card">
      <h2>Rhythm dictation settings</h2>
      <p className="sub" style={{ marginBottom: '0.85rem' }}>
        Configure metre, note values, rests, syncopation, and tuplets — then notate what you hear.
      </p>
      <div className="grid rd-settings-grid">
        <div className="field">
          <label>Time signatures</label>
          <div className="rd-check-grid">
            {TIME_SIGS.map((sig) => (
              <label key={sig}>
                <input type="checkbox" checked={settings.signatures.includes(sig)} onChange={() => toggleSig(sig)} /> {sig}
              </label>
            ))}
          </div>
          <div className="help">Simple metres use quarter pulses; compound /8 metres use dotted-quarter pulses.</div>
        </div>

        <div className="field">
          <label>Note &amp; rest values (for questions)</label>
          <div className="rd-check-grid">
            {DURATIONS.map((d) => (
              <label key={d.value}>
                <input type="checkbox" checked={settings.durations.includes(d.value)} onChange={() => toggleDur(d.value)} />{' '}
                {d.label}
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Rhythmic features</label>
          <label style={{ marginBottom: '0.45rem' }}>Rests in questions</label>
          <select value={settings.restFrequency} onChange={(e) => setState({ restFrequency: e.target.value as typeof settings.restFrequency })}>
            <option value="none">No rests</option>
            <option value="light">Light (occasional)</option>
            <option value="moderate">Moderate</option>
            <option value="heavy">Heavy (frequent)</option>
          </select>
          <label style={{ margin: '0.65rem 0 0.45rem' }}>Syncopation</label>
          <select value={settings.syncopation} onChange={(e) => setState({ syncopation: e.target.value as typeof settings.syncopation })}>
            <option value="off">Off — on-beat placement</option>
            <option value="light">Light — some off-beats</option>
            <option value="moderate">Moderate</option>
            <option value="heavy">Heavy — accent weak beats</option>
          </select>
          <div className="inline" style={{ marginTop: '0.65rem' }}>
            <label className="toggle-switch toggle-switch-compact">
              <input type="checkbox" checked={settings.triplets} onChange={(e) => setState({ triplets: e.target.checked })} />
              <span className="toggle-slider" aria-hidden="true" />
              <span>Include triplets</span>
            </label>
          </div>
        </div>

        <div className="field">
          <label>Exercise layout</label>
          <label style={{ marginBottom: '0.35rem' }}>Measures per question</label>
          <select value={settings.measures} onChange={(e) => setState({ measures: Number(e.target.value) })}>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={4}>4</option>
            <option value={8}>8</option>
          </select>
          <label style={{ margin: '0.65rem 0 0.35rem' }}>
            Tempo &#9833; = <span>{settings.tempo}</span>
          </label>
          <input
            type="range"
            min={40}
            max={200}
            step={1}
            value={settings.tempo}
            onChange={(e) => setState({ tempo: Number(e.target.value) })}
          />
          <label style={{ margin: '0.65rem 0 0.35rem' }}>Sound</label>
          <div>
            {SOUND_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`rd-type-btn${settings.sound === t.value ? ' rd-type-active' : ''}`}
                onClick={() => setState({ sound: t.value })}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Playback</label>
          <label style={{ marginBottom: '0.35rem' }}>Beat emphasis</label>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={settings.emphasis}
            onChange={(e) => setState({ emphasis: Number(e.target.value) })}
          />
          <span className="help">{settings.emphasis} — stronger downbeats</span>
          <label style={{ margin: '0.65rem 0 0.35rem' }}>Metronome volume</label>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={settings.metroVolume}
            onChange={(e) => setState({ metroVolume: Number(e.target.value) })}
          />
        </div>
      </div>
    </section>
  );
}
