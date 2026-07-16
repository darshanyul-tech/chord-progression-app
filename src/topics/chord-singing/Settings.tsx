import { SaveAsCustomTopicButton } from '../../components/SaveAsCustomTopicButton';
import { CHORD_RECOGNITION_GROUPS, CHORD_RECOGNITION_TYPES } from '../../lib/recognition/chords';
import { CHORD_SINGING_ALLOWED_IDS, type ChordSingingDirectionMode, type ChordSingingPromptMode } from '../../lib/pitch/chordSinging';
import type { RootRangePreset } from '../../lib/pitch/question';
import type { ToleranceLevel } from '../../lib/pitch/settings';
import { useChordSingingSettings } from '../../state/settings/chord-singing';

const SINGABLE_TYPES = CHORD_RECOGNITION_TYPES.filter((t) => CHORD_SINGING_ALLOWED_IDS.includes(t.id));

export function ChordSingingSettings() {
  const settings = useChordSingingSettings();
  const setState = useChordSingingSettings.setState;

  function toggleType(id: string) {
    setState((s) => {
      const enabled = new Set(s.enabledTypes);
      if (enabled.has(id)) enabled.delete(id);
      else enabled.add(id);
      return { enabledTypes: [...enabled] };
    });
  }

  function toggleAllInGroup(groupId: string) {
    const idsInGroup = SINGABLE_TYPES.filter((t) => t.group === groupId).map((t) => t.id);
    setState((s) => {
      const enabled = new Set(s.enabledTypes);
      const allOn = idsInGroup.every((id) => enabled.has(id));
      idsInGroup.forEach((id) => {
        if (allOn) enabled.delete(id);
        else enabled.add(id);
      });
      return { enabledTypes: [...enabled] };
    });
  }

  return (
    <section className="card">
      <h2>Chord singing settings</h2>
      <p className="sub" style={{ marginBottom: '0.85rem' }}>
        A chord is presented; sing its tones one at a time, root to top. Audio never leaves your device — no
        recording, no upload.
      </p>

      <div className="chord-type-groups">
        {CHORD_RECOGNITION_GROUPS.map((grp) => {
          const types = SINGABLE_TYPES.filter((t) => t.group === grp.id);
          if (!types.length) return null;
          return (
            <div key={grp.id} className="chord-type-group">
              <div className="chord-type-group-header">
                <h3 className="chord-type-group-title">{grp.title}</h3>
                <button
                  type="button"
                  className="toggle-all-btn"
                  aria-label={`Toggle all in ${grp.title}`}
                  onClick={() => toggleAllInGroup(grp.id)}
                >
                  All
                </button>
              </div>
              <div className="chord-type-checks">
                {types.map((def) => (
                  <label key={def.id}>
                    <input
                      type="checkbox"
                      checked={settings.enabledTypes.includes(def.id)}
                      onChange={() => toggleType(def.id)}
                    />
                    {def.label}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
        <div className="help">
          Restricted to qualities of 4 tones or fewer — one voice sings an arpeggio, so bigger chords aren't practical.
        </div>
      </div>

      <div className="grid" style={{ marginTop: '0.85rem' }}>
        <div className="field">
          <label htmlFor="chordSingingPromptMode">Prompt mode</label>
          <select
            id="chordSingingPromptMode"
            value={settings.promptMode}
            onChange={(e) => setState({ promptMode: e.target.value as ChordSingingPromptMode })}
          >
            <option value="echo">Echo — hear the full chord, root named</option>
            <option value="construction">Construction — only the root plays, quality named</option>
          </select>
          <div className="help">Construction trains chord spelling by ear — the singing analogue of Chord Recognition.</div>
        </div>

        <div className="field">
          <label htmlFor="chordSingingDirection">Direction</label>
          <select
            id="chordSingingDirection"
            value={settings.direction}
            onChange={(e) => setState({ direction: e.target.value as ChordSingingDirectionMode })}
          >
            <option value="up">Root to top</option>
            <option value="down">Top to root</option>
            <option value="both">Both (one direction per question)</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="chordSingingRootRange">Root note range</label>
          <select
            id="chordSingingRootRange"
            value={settings.rootRange}
            onChange={(e) => setState({ rootRange: e.target.value as RootRangePreset })}
          >
            <option value="auto">Auto (widest comfortable range)</option>
            <option value="male">Male voice (comfortable low/mid)</option>
            <option value="female">Female voice (comfortable mid/high)</option>
          </select>
          <div className="help">Keeps the root — and the chord's highest tone — inside a comfortable singing range.</div>
        </div>

        <div className="field">
          <label htmlFor="chordSingingTolerance">Grading tolerance</label>
          <select
            id="chordSingingTolerance"
            value={settings.tolerance}
            onChange={(e) => setState({ tolerance: e.target.value as ToleranceLevel })}
          >
            <option value="strict">Strict (±30¢)</option>
            <option value="default">Default (±50¢)</option>
            <option value="relaxed">Relaxed (±75¢)</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="chordSingingHoldTime">
            Hold time required: <span className="valtag">{settings.holdTimeSec.toFixed(1)}</span>s
          </label>
          <input
            id="chordSingingHoldTime"
            type="range"
            min={0.2}
            max={1.5}
            step={0.1}
            value={settings.holdTimeSec}
            onChange={(e) => setState({ holdTimeSec: Number(e.target.value) })}
          />
          <div className="help">How long you must hold a steady pitch before each tone is captured.</div>
        </div>
      </div>

      <div className="field-toggle-header" style={{ marginTop: '0.5rem' }}>
        <span className="field-toggle-title" id="chord-singing-octave-eq-title">Octave equivalence</span>
        <label className="toggle-switch">
          <input
            type="checkbox"
            aria-labelledby="chord-singing-octave-eq-title"
            checked={settings.octaveEquivalence}
            onChange={(e) => setState({ octaveEquivalence: e.target.checked })}
          />
          <span className="toggle-slider" aria-hidden="true" />
        </label>
      </div>
      <div className="help">
        When on, singing the right pitch class in any octave counts as correct for that tone — applied per tone.
      </div>

      <div className="field-toggle-header" style={{ marginTop: '0.5rem' }}>
        <span className="field-toggle-title" id="chord-singing-auto-advance-title">Auto-advance after a correct answer</span>
        <label className="toggle-switch">
          <input
            type="checkbox"
            aria-labelledby="chord-singing-auto-advance-title"
            checked={settings.autoAdvance}
            onChange={(e) => setState({ autoAdvance: e.target.checked })}
          />
          <span className="toggle-slider" aria-hidden="true" />
        </label>
      </div>
      <div className="help">
        When on, the next question starts automatically after you sing the whole arpeggio correctly. Missed rounds
        always wait, so you can review the reveal.
      </div>

      <SaveAsCustomTopicButton topicId="chord-singing" getSettings={() => useChordSingingSettings.getState()} />
    </section>
  );
}
