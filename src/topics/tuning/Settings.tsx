import type { TuningDifficulty, TuningRegister } from '../../lib/recognition/tuning';
import { useTuningSettings } from '../../state/settings/tuning';

export function TuningSettings() {
  const settings = useTuningSettings();
  const setState = useTuningSettings.setState;

  return (
    <section className="card">
      <h2>Tuning settings</h2>
      <p className="sub" style={{ marginBottom: '0.85rem' }}>
        A note plays, then the same note again — say whether the second hearing is flat, in tune, or sharp.
      </p>

      <div className="grid">
        <div className="field">
          <label htmlFor="tuningDifficulty">Difficulty</label>
          <select
            id="tuningDifficulty"
            value={settings.difficulty}
            onChange={(e) => setState({ difficulty: e.target.value as TuningDifficulty })}
          >
            <option value="easy">Easy (±25¢)</option>
            <option value="medium">Medium (±15¢)</option>
            <option value="hard">Hard (±8¢)</option>
          </select>
          <div className="help">The fixed detune size used whenever a question isn&apos;t in tune.</div>
        </div>

        <div className="field">
          <label htmlFor="tuningRegister">Register</label>
          <select
            id="tuningRegister"
            value={settings.register}
            onChange={(e) => setState({ register: e.target.value as TuningRegister })}
          >
            <option value="low">Low (C3–B3)</option>
            <option value="mid">Mid (C4–B4)</option>
            <option value="high">High (C5–B5)</option>
            <option value="any">Any (C3–B5)</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="tuningNoteLen">
            Note length: <span className="valtag">{settings.noteLen.toFixed(2)}</span>s
          </label>
          <input
            id="tuningNoteLen"
            type="range"
            min={0.5}
            max={2.0}
            step={0.1}
            value={settings.noteLen}
            onChange={(e) => setState({ noteLen: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label htmlFor="tuningPause">
            Pause between hearings: <span className="valtag">{settings.pauseSec.toFixed(2)}</span>s
          </label>
          <input
            id="tuningPause"
            type="range"
            min={0.3}
            max={2.0}
            step={0.1}
            value={settings.pauseSec}
            onChange={(e) => setState({ pauseSec: Number(e.target.value) })}
          />
        </div>
      </div>
    </section>
  );
}
