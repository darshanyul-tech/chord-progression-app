import { SaveAsCustomTopicButton } from '../../components/SaveAsCustomTopicButton';
import { MELODY_KEYS } from '../../lib/melody/theory';
import type { SightSingingChromatic, SightSingingMotion } from '../../lib/pitch/sightSinging';
import type { RootRangePreset } from '../../lib/pitch/question';
import type { ToleranceLevel } from '../../lib/pitch/settings';
import { useSightSingingSettings } from '../../state/settings/sight-singing';

export function SightSingingSettings() {
  const settings = useSightSingingSettings();
  const setState = useSightSingingSettings.setState;

  return (
    <section className="card">
      <h2>Sight singing settings</h2>
      <p className="sub" style={{ marginBottom: '0.85rem' }}>
        A short melody is notated on the staff; the tonic chord plays for orientation, then the starting note — sing
        the melody back one note at a time, at your own pace. Audio never leaves your device — no recording, no
        upload.
      </p>
      <div className="help" style={{ marginBottom: '0.85rem' }}>
        Pitch only — rhythm is shown for context but isn&apos;t graded. Hold each note until it&apos;s captured; take
        your time.
      </div>

      <div className="grid">
        <div className="field">
          <label htmlFor="sightSingingKey">Key</label>
          <select
            id="sightSingingKey"
            value={settings.key}
            onChange={(e) => setState({ key: e.target.value })}
            disabled={settings.randomKey}
          >
            {MELODY_KEYS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.id}
                {k.mode === 'major' ? ' major' : ' minor'}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <div className="field-toggle-header">
            <span className="field-toggle-title" id="sight-singing-random-key-title">Random key</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                aria-labelledby="sight-singing-random-key-title"
                checked={settings.randomKey}
                onChange={(e) => setState({ randomKey: e.target.checked })}
              />
              <span className="toggle-slider" aria-hidden="true" />
            </label>
          </div>
        </div>
      </div>

      <div className="grid">
        <div className="field">
          <label htmlFor="sightSingingMeasures">Length</label>
          <select
            id="sightSingingMeasures"
            value={settings.measures}
            onChange={(e) => setState({ measures: Number(e.target.value) })}
          >
            <option value={1}>1 measure</option>
            <option value={2}>2 measures</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="sightSingingMotion">Melodic motion</label>
          <select
            id="sightSingingMotion"
            value={settings.motion}
            onChange={(e) => setState({ motion: e.target.value as SightSingingMotion })}
          >
            <option value="steps">Mostly steps</option>
            <option value="mixed">Mixed</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="sightSingingChromatic">Chromatic notes</label>
          <select
            id="sightSingingChromatic"
            value={settings.chromatic}
            onChange={(e) => setState({ chromatic: e.target.value as SightSingingChromatic })}
          >
            <option value="none">None</option>
            <option value="light">Light (~1 per 4 bars)</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="sightSingingVocalRange">Vocal range</label>
          <select
            id="sightSingingVocalRange"
            value={settings.vocalRange}
            onChange={(e) => setState({ vocalRange: e.target.value as RootRangePreset })}
          >
            <option value="auto">Auto (widest comfortable range)</option>
            <option value="male">Male voice (comfortable low/mid)</option>
            <option value="female">Female voice (comfortable mid/high)</option>
          </select>
          <div className="help">Keeps every note of the melody inside a comfortable singing range.</div>
        </div>

        <div className="field">
          <label htmlFor="sightSingingTolerance">Grading tolerance</label>
          <select
            id="sightSingingTolerance"
            value={settings.tolerance}
            onChange={(e) => setState({ tolerance: e.target.value as ToleranceLevel })}
          >
            <option value="strict">Strict (±30¢)</option>
            <option value="default">Default (±50¢)</option>
            <option value="relaxed">Relaxed (±75¢)</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="sightSingingHoldTime">
            Hold time required: <span className="valtag">{settings.holdTimeSec.toFixed(1)}</span>s
          </label>
          <input
            id="sightSingingHoldTime"
            type="range"
            min={0.2}
            max={1.5}
            step={0.1}
            value={settings.holdTimeSec}
            onChange={(e) => setState({ holdTimeSec: Number(e.target.value) })}
          />
          <div className="help">How long you must hold a steady pitch before each note is captured.</div>
        </div>
      </div>

      <div className="field-toggle-header" style={{ marginTop: '0.5rem' }}>
        <span className="field-toggle-title" id="sight-singing-octave-eq-title">Octave equivalence</span>
        <label className="toggle-switch">
          <input
            type="checkbox"
            aria-labelledby="sight-singing-octave-eq-title"
            checked={settings.octaveEquivalence}
            onChange={(e) => setState({ octaveEquivalence: e.target.checked })}
          />
          <span className="toggle-slider" aria-hidden="true" />
        </label>
      </div>
      <div className="help">
        When on, singing the right pitch class in any octave counts as correct for that note — applied per note.
      </div>

      <div className="field-toggle-header" style={{ marginTop: '0.5rem' }}>
        <span className="field-toggle-title" id="sight-singing-auto-advance-title">Auto-advance after a correct answer</span>
        <label className="toggle-switch">
          <input
            type="checkbox"
            aria-labelledby="sight-singing-auto-advance-title"
            checked={settings.autoAdvance}
            onChange={(e) => setState({ autoAdvance: e.target.checked })}
          />
          <span className="toggle-slider" aria-hidden="true" />
        </label>
      </div>
      <div className="help">
        When on, the next melody starts automatically after you sing it correctly. Missed rounds always wait, so you
        can review the reveal.
      </div>

      <SaveAsCustomTopicButton topicId="sight-singing" getSettings={() => useSightSingingSettings.getState()} />
    </section>
  );
}
