import { NOTE_NAMES } from '../../lib/theory';
import { useProgressionSettings } from '../../state/settings/chord-progressions';

const EXT_CHECKS = [7, 9, 11, 13] as const;

export function ProgressionSettings() {
  const settings = useProgressionSettings();
  const setState = useProgressionSettings.setState;

  const has7 = settings.extensions.includes(7);

  function toggleExt(value: number) {
    setState((s) => {
      const has = s.extensions.includes(value);
      let next = has ? s.extensions.filter((e) => e !== value) : [...s.extensions, value];
      if (value === 7 && has) {
        // legacy: turning off 7ths disables/clears all upper extensions too
        next = next.filter((e) => e === 7);
      }
      return { extensions: next };
    });
  }

  return (
    <section className="card">
      <h2>Settings</h2>

      <h3 className="settings-section-title">Harmony</h3>
      <div className="grid settings-section">
        <div className="field">
          <div className="field-toggle-header">
            <span className="field-toggle-title">Random key</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.randomKey}
                onChange={(e) => setState({ randomKey: e.target.checked })}
              />
              <span className="toggle-slider" aria-hidden="true" />
            </label>
          </div>
          <div className="help">
            When on, a new random key is chosen each time you generate or play. In custom progression mode, your
            entered chords transpose to that key on every Play.
          </div>
        </div>

        {!settings.randomKey && (
          <div className="field">
            <label htmlFor="keySelect">Key center</label>
            <select id="keySelect" value={settings.keyCenter} onChange={(e) => setState({ keyCenter: e.target.value })}>
              {NOTE_NAMES.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
            <div className="help">Tonal center used to spell the progression.</div>
          </div>
        )}

        <div className="field">
          <label htmlFor="tonality">Tonality</label>
          <select
            id="tonality"
            value={settings.tonality}
            onChange={(e) => setState({ tonality: e.target.value as 'major' | 'minor' })}
          >
            <option value="major">Major</option>
            <option value="minor">Minor</option>
          </select>
          <div className="help">Minor uses natural-minor harmony: i, ii&oslash;, bIII, iv, v, bVI, bVII.</div>
          {settings.tonality === 'minor' && (
            <div className="minor-harmony-options">
              <div className="inline" style={{ marginTop: '0.55rem' }}>
                <label className="toggle-switch toggle-switch-compact">
                  <span className="toggle-label">v m7</span>
                  <input
                    type="checkbox"
                    checked={settings.minorVm7}
                    onChange={(e) => setState({ minorVm7: e.target.checked })}
                  />
                  <span className="toggle-slider" aria-hidden="true" />
                </label>
                <label className="toggle-switch toggle-switch-compact">
                  <span className="toggle-label">V7</span>
                  <input
                    type="checkbox"
                    checked={settings.minorV7}
                    onChange={(e) => setState({ minorV7: e.target.checked })}
                  />
                  <span className="toggle-slider" aria-hidden="true" />
                </label>
              </div>
              <div className="help">Optional dominant colour on the V degree. bVII is always available.</div>
            </div>
          )}
        </div>

        <div className="field">
          <label>Allowed chord extensions</label>
          <div className="inline">
            <label>
              <input type="checkbox" checked={has7} onChange={() => toggleExt(7)} /> 7ths
            </label>
            {has7 && (
              <span className="inline">
                {EXT_CHECKS.filter((e) => e !== 7).map((e) => (
                  <label key={e}>
                    <input type="checkbox" checked={settings.extensions.includes(e)} onChange={() => toggleExt(e)} />{' '}
                    {e}ths
                  </label>
                ))}
              </span>
            )}
          </div>
          <div className="help">
            {has7
              ? 'Highest selected tension is used per chord. 7ths is the jazz baseline.'
              : 'Triads only (no 7ths). Enable 7ths to use upper extensions and 7th chords.'}
          </div>
        </div>

        <div className="field">
          <div className="field-toggle-header">
            <span className="field-toggle-title">Rootless voicings (split hands)</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.rootless}
                onChange={(e) => setState({ rootless: e.target.checked })}
              />
              <span className="toggle-slider" aria-hidden="true" />
            </label>
          </div>
          <div className="help">
            Right hand plays a rootless chord; an independent bass voice plays the root (or inversion tone) in the
            left hand.
          </div>
        </div>

        <div className="field">
          <div className="field-toggle-header">
            <span className="field-toggle-title">Diatonic only</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.diatonicOnly}
                onChange={(e) => setState({ diatonicOnly: e.target.checked })}
              />
              <span className="toggle-slider" aria-hidden="true" />
            </label>
          </div>
          <div className="help">When off, allows secondary dominants and a borrowed iv chord.</div>
        </div>

        {!settings.diatonicOnly && (
          <div className="field">
            <div className="field-toggle-header">
              <span className="field-toggle-title">Use sub-dominant chords</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.allowSubdominant}
                  onChange={(e) => setState({ allowSubdominant: e.target.checked })}
                />
                <span className="toggle-slider" aria-hidden="true" />
              </label>
            </div>
            <div className="help">Toggles ii and IV (sub-dominant function) material.</div>
          </div>
        )}

        {!settings.diatonicOnly && (
          <div className="field">
            <div className="field-toggle-header">
              <span className="field-toggle-title">Chromaticism</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.chromatic}
                  onChange={(e) => setState({ chromatic: e.target.checked })}
                />
                <span className="toggle-slider" aria-hidden="true" />
              </label>
            </div>
            <div className="help">
              Allows chromatic roots via tritone substitutions (e.g. subV). Adds chromatic roman numerals to the
              guess.
            </div>
            {settings.chromatic && (
              <div className="chromatic-count-block">
                <label htmlFor="chromaticRange">
                  Number of chromatic chords: <span className="valtag">{settings.chromaticCount}</span>
                </label>
                <input
                  id="chromaticRange"
                  type="range"
                  min={0}
                  max={8}
                  step={1}
                  value={settings.chromaticCount}
                  onChange={(e) => setState({ chromaticCount: Number(e.target.value) })}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <h3 className="settings-section-title">Progression</h3>
      <div className="grid settings-section">
        <div className="field">
          <div className="field-toggle-header">
            <span className="field-toggle-title">End on resolution</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.cadence}
                onChange={(e) => setState({ cadence: e.target.checked })}
              />
              <span className="toggle-slider" aria-hidden="true" />
            </label>
          </div>
          <div className="help">Forces a V&rarr;I style cadence into the final bar.</div>
        </div>

        <div className="field">
          <div className="field-toggle-header">
            <span className="field-toggle-title">Play tonic chord first</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.tonicFirst}
                onChange={(e) => setState({ tonicFirst: e.target.checked })}
              />
              <span className="toggle-slider" aria-hidden="true" />
            </label>
          </div>
          <div className="help">Plays a reference I chord for one bar, then one bar of silence, then the progression.</div>
        </div>

        <div className="field">
          <label htmlFor="bpmRange">
            Tempo (BPM): <span className="valtag">{settings.tempo}</span>
          </label>
          <input
            id="bpmRange"
            type="range"
            min={40}
            max={220}
            step={1}
            value={settings.tempo}
            onChange={(e) => setState({ tempo: Number(e.target.value) })}
          />
          <div className="help">Tempo of playback (one chord per bar, half-note feel).</div>
        </div>

        <div className="field">
          <div className="field-toggle-header">
            <span className="field-toggle-title">Bouncing bass</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.bouncingBass}
                onChange={(e) => setState({ bouncingBass: e.target.checked })}
              />
              <span className="toggle-slider" aria-hidden="true" />
            </label>
          </div>
          <div className="help">Strikes the bass note at the start of each bar and again halfway through.</div>
        </div>

        <div className="field">
          <label htmlFor="barsRange">
            Progression length (bars): <span className="valtag">{settings.bars}</span>
          </label>
          <input
            id="barsRange"
            type="range"
            min={2}
            max={12}
            step={1}
            value={settings.bars}
            onChange={(e) => setState({ bars: Number(e.target.value) })}
          />
          <div className="help">One chord per bar.</div>
        </div>

        <div className="field">
          <div className="field-toggle-header">
            <span className="field-toggle-title">Use inversions</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.inversions}
                onChange={(e) => setState({ inversions: e.target.checked })}
              />
              <span className="toggle-slider" aria-hidden="true" />
            </label>
          </div>
          <div className="help">
            When on, chords are voiced in random inversions and the guess section adds an inversion selector.
          </div>
        </div>
      </div>
    </section>
  );
}
