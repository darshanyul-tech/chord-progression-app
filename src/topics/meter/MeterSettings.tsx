import { SaveAsCustomTopicButton } from '../../components/SaveAsCustomTopicButton';
import { METER_SIGNATURES } from '../../lib/recognition/meter';
import { useMeterRecognitionSettings } from '../../state/settings/meter-recognition';

const SOUND_TYPES: { value: 'percussive' | 'instrumental' | 'melodic'; label: string }[] = [
  { value: 'percussive', label: 'Percussive' },
  { value: 'instrumental', label: 'Instrumental' },
  { value: 'melodic', label: 'Melodic' },
];

export function MeterSettings() {
  const settings = useMeterRecognitionSettings();
  const setState = useMeterRecognitionSettings.setState;

  function toggleSig(sig: string) {
    setState((s) => {
      const has = s.enabledSignatures.includes(sig);
      const next = has ? s.enabledSignatures.filter((v) => v !== sig) : [...s.enabledSignatures, sig];
      // §4 guard: a single option is not a question.
      if (next.length < 2) return s;
      return { enabledSignatures: next };
    });
  }

  return (
    <section className="card">
      <h2>Meter recognition settings</h2>
      <p className="sub" style={{ marginBottom: '0.85rem' }}>
        A short unlabeled excerpt plays after a silent lead-in — identify the time signature by feel.
      </p>
      <div className="grid">
        <div className="field">
          <label>Time signatures (at least 2)</label>
          <div className="meter-sig-grid">
            {METER_SIGNATURES.map((sig) => (
              <label key={sig}>
                <input
                  type="checkbox"
                  checked={settings.enabledSignatures.includes(sig)}
                  onChange={() => toggleSig(sig)}
                />{' '}
                {sig}
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="meterTempo" style={{ marginBottom: '0.35rem' }}>
            Tempo &#9833; = <span>{settings.tempo}</span>
          </label>
          <input
            id="meterTempo"
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
                className={`meter-sound-btn${settings.sound === t.value ? ' meter-sound-active' : ''}`}
                onClick={() => setState({ sound: t.value })}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="meterEmphasis">Beat emphasis</label>
          <select
            id="meterEmphasis"
            value={settings.emphasis}
            onChange={(e) => setState({ emphasis: e.target.value as typeof settings.emphasis })}
          >
            <option value="emphasized">Emphasized</option>
            <option value="neutral">Neutral</option>
          </select>
          <div className="help">
            Neutral emphasis makes closely related metres genuinely ambiguous — enable emphasis or longer excerpts to
            disambiguate.
          </div>
          <label htmlFor="meterMeasures" style={{ margin: '0.65rem 0 0.35rem' }}>
            Excerpt length
          </label>
          <select
            id="meterMeasures"
            value={settings.measures}
            onChange={(e) => setState({ measures: Number(e.target.value) })}
          >
            <option value={2}>2 measures</option>
            <option value={4}>4 measures</option>
            <option value={8}>8 measures</option>
          </select>
        </div>

        <div className="field">
          <div className="field-toggle-header">
            <span className="field-toggle-title" id="meter-auto-advance-title">Auto-advance after answer</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                aria-labelledby="meter-auto-advance-title"
                checked={settings.autoAdvance}
                onChange={(e) => setState({ autoAdvance: e.target.checked })}
              />
              <span className="toggle-slider" aria-hidden="true" />
            </label>
          </div>
        </div>
      </div>

      <SaveAsCustomTopicButton topicId="meter-recognition" getSettings={() => useMeterRecognitionSettings.getState()} />
    </section>
  );
}
