import { SaveAsCustomTopicButton } from '../../components/SaveAsCustomTopicButton';
import { MELODY_KEYS } from '../../lib/melody/theory';
import { useMelodicDictationSettings } from '../../state/settings/melodic-dictation';

const TIME_SIGS = ['2/4', '3/4', '4/4', '6/8'];
const DURATIONS: { value: number; label: string }[] = [
  { value: 4, label: 'Whole' },
  { value: 2, label: 'Half' },
  { value: 1, label: 'Quarter' },
  { value: 0.5, label: 'Eighth' },
  { value: 0.25, label: 'Sixteenth' },
  { value: 1.5, label: 'Dotted quarter' },
  { value: 0.75, label: 'Dotted eighth' },
];

export function MelodicSettings() {
  const settings = useMelodicDictationSettings();
  const setState = useMelodicDictationSettings.setState;

  function toggleSig(sig: string) {
    setState((s) => {
      const has = s.signatures.includes(sig);
      const next = has ? s.signatures.filter((v) => v !== sig) : [...s.signatures, sig];
      if (!next.length) return s;
      return { signatures: next };
    });
  }

  function toggleDur(value: number) {
    setState((s) => {
      const has = s.durations.includes(value);
      const next = has ? s.durations.filter((v) => v !== value) : [...s.durations, value];
      if (next.length < 1) return s;
      return { durations: next };
    });
  }

  return (
    <section className="card">
      <h2>Melodic dictation settings</h2>
      <p className="sub" style={{ marginBottom: '0.85rem' }}>
        A short melody plays after a key-orientation chord and count-in — transcribe pitch and rhythm.
      </p>
      <div className="grid">
        <div className="field">
          <label htmlFor="mdClef">Clef</label>
          <select id="mdClef" value={settings.clef} onChange={(e) => setState({ clef: e.target.value as typeof settings.clef })}>
            <option value="treble">Treble</option>
            <option value="bass">Bass</option>
            <option value="random">Random per question</option>
          </select>

          <label htmlFor="mdKey" style={{ margin: '0.65rem 0 0.35rem' }}>
            Key
          </label>
          <select
            id="mdKey"
            value={settings.key}
            disabled={settings.randomKey}
            onChange={(e) => setState({ key: e.target.value })}
          >
            {MELODY_KEYS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.id} {k.mode === 'minor' ? 'minor' : 'major'}
              </option>
            ))}
          </select>
          <label className="toggle-switch" style={{ marginTop: '0.5rem' }}>
            <span className="toggle-label">Random key</span>
            <input type="checkbox" checked={settings.randomKey} onChange={(e) => setState({ randomKey: e.target.checked })} />
            <span className="toggle-slider" aria-hidden="true" />
          </label>
        </div>

        <div className="field">
          <label htmlFor="mdRange">Range</label>
          <select id="mdRange" value={settings.range} onChange={(e) => setState({ range: e.target.value as typeof settings.range })}>
            <option value="narrow">Narrow (one octave)</option>
            <option value="medium">Medium (a 10th)</option>
            <option value="wide">Wide (two octaves)</option>
          </select>

          <label htmlFor="mdChromatic" style={{ margin: '0.65rem 0 0.35rem' }}>
            Chromatic notes
          </label>
          <select
            id="mdChromatic"
            value={settings.chromatic}
            onChange={(e) => setState({ chromatic: e.target.value as typeof settings.chromatic })}
          >
            <option value="none">None</option>
            <option value="light">Light (~1 per 4 bars)</option>
            <option value="moderate">Moderate (~1 per bar)</option>
          </select>

          <label htmlFor="mdMotion" style={{ margin: '0.65rem 0 0.35rem' }}>
            Melodic motion
          </label>
          <select id="mdMotion" value={settings.motion} onChange={(e) => setState({ motion: e.target.value as typeof settings.motion })}>
            <option value="steps">Mostly steps</option>
            <option value="mixed">Mixed</option>
            <option value="leapy">Leapy</option>
          </select>
        </div>

        <div className="field">
          <label>Time signatures</label>
          <div className="meter-sig-grid">
            {TIME_SIGS.map((sig) => (
              <label key={sig}>
                <input type="checkbox" checked={settings.signatures.includes(sig)} onChange={() => toggleSig(sig)} /> {sig}
              </label>
            ))}
          </div>
          <label style={{ marginTop: '0.65rem' }}>Note &amp; rest values</label>
          <div className="meter-sig-grid">
            {DURATIONS.map((d) => (
              <label key={d.value}>
                <input type="checkbox" checked={settings.durations.includes(d.value)} onChange={() => toggleDur(d.value)} />{' '}
                {d.label}
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="mdRests">Rests</label>
          <select id="mdRests" value={settings.rests} onChange={(e) => setState({ rests: e.target.value as typeof settings.rests })}>
            <option value="none">None</option>
            <option value="light">Light</option>
            <option value="moderate">Moderate</option>
          </select>
          <label htmlFor="mdSync" style={{ margin: '0.65rem 0 0.35rem' }}>
            Syncopation
          </label>
          <select id="mdSync" value={settings.syncopation} onChange={(e) => setState({ syncopation: e.target.value as typeof settings.syncopation })}>
            <option value="off">Off</option>
            <option value="light">Light</option>
            <option value="moderate">Moderate</option>
          </select>
          <label htmlFor="mdMeasures" style={{ margin: '0.65rem 0 0.35rem' }}>
            Length
          </label>
          <select id="mdMeasures" value={settings.measures} onChange={(e) => setState({ measures: Number(e.target.value) })}>
            <option value={1}>1 measure</option>
            <option value={2}>2 measures</option>
            <option value={4}>4 measures</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="mdTempo" style={{ marginBottom: '0.35rem' }}>
            Tempo &#9833; = <span>{settings.tempo}</span>
          </label>
          <input
            id="mdTempo"
            type="range"
            min={40}
            max={160}
            step={1}
            value={settings.tempo}
            onChange={(e) => setState({ tempo: Number(e.target.value) })}
          />
          <label className="toggle-switch" style={{ marginTop: '0.85rem' }}>
            <span className="toggle-label">Preview pitch on place</span>
            <input
              type="checkbox"
              checked={settings.previewOnPlace}
              onChange={(e) => setState({ previewOnPlace: e.target.checked })}
            />
            <span className="toggle-slider" aria-hidden="true" />
          </label>
          <div className="help">Plays the note you just placed or nudged so you can hear what you wrote.</div>
        </div>
      </div>

      <SaveAsCustomTopicButton topicId="melodic-dictation" getSettings={() => useMelodicDictationSettings.getState()} />
    </section>
  );
}
