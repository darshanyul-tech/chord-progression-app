import { SaveAsCustomTopicButton } from '../../components/SaveAsCustomTopicButton';
import { CHORD_RECOGNITION_GROUPS, CHORD_RECOGNITION_TYPES } from '../../lib/recognition/chords';
import type { ChordComparisonDifficulty, ChordComparisonRootRelationship } from '../../lib/recognition/chordComparison';
import { useChordComparisonSettings } from '../../state/settings/chord-comparison';

export function ChordComparisonSettings() {
  const settings = useChordComparisonSettings();
  const setState = useChordComparisonSettings.setState;
  const isArp = settings.playbackStyle === 'arp';

  function toggleType(id: string) {
    setState((s) => {
      const enabled = new Set(s.enabledTypes);
      if (enabled.has(id)) enabled.delete(id);
      else enabled.add(id);
      return { enabledTypes: [...enabled] };
    });
  }

  function toggleAllInGroup(groupId: string) {
    const idsInGroup = CHORD_RECOGNITION_TYPES.filter((t) => t.group === groupId).map((t) => t.id);
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
      <h2>Chord comparison settings</h2>
      <p className="sub" style={{ marginBottom: '0.85rem' }}>
        Two chords play in sequence — say whether they're the same quality or different.
      </p>

      <div className="chord-type-groups">
        {CHORD_RECOGNITION_GROUPS.map((grp) => {
          const types = CHORD_RECOGNITION_TYPES.filter((t) => t.group === grp.id);
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
      </div>

      <div className="grid" style={{ marginTop: '0.85rem' }}>
        <div className="field">
          <label htmlFor="chordComparisonDifficulty">Difficulty</label>
          <select
            id="chordComparisonDifficulty"
            value={settings.difficulty}
            onChange={(e) => setState({ difficulty: Number(e.target.value) as ChordComparisonDifficulty })}
          >
            <option value={1}>Tier 1 — family differences (easy)</option>
            <option value={2}>Up to tier 2 — same-family colour (medium)</option>
            <option value={3}>Up to tier 3 — single-alteration pairs (hard)</option>
          </select>
          <div className="help">Higher tiers include the lower ones — a pair only appears when both its qualities are enabled above.</div>
        </div>

        <div className="field">
          <label htmlFor="chordComparisonRootRelationship">Root relationship</label>
          <select
            id="chordComparisonRootRelationship"
            value={settings.rootRelationship}
            onChange={(e) => setState({ rootRelationship: e.target.value as ChordComparisonRootRelationship })}
          >
            <option value="same">Same root</option>
            <option value="transposed">Transposed (1-5 semitones)</option>
          </select>
          <div className="help">Transposed pairs are substantially harder — you can't lean on a fixed reference pitch.</div>
        </div>
      </div>

      <div className="field" style={{ marginTop: '0.5rem' }}>
        <label htmlFor="chordComparisonPlaybackStyle">Playback style</label>
        <select
          id="chordComparisonPlaybackStyle"
          value={settings.playbackStyle}
          onChange={(e) => setState({ playbackStyle: e.target.value as 'block' | 'arp' })}
        >
          <option value="block">Block chord</option>
          <option value="arp">Upward arpeggio</option>
        </select>
        <div className="help">Block plays all notes together; arpeggio plays low to high, one note at a time.</div>
      </div>

      <div className="grid">
        <div className="field">
          <label htmlFor="chordComparisonHoldLen">
            {isArp ? 'Arpeggio note length' : 'Chord length'}: <span className="valtag">{settings.holdLen.toFixed(1)}</span>s
          </label>
          <input
            id="chordComparisonHoldLen"
            type="range"
            min={0.8}
            max={2.5}
            step={0.1}
            value={settings.holdLen}
            onChange={(e) => setState({ holdLen: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label htmlFor="chordComparisonPairPause">
            Pause between chords: <span className="valtag">{settings.pairPauseSec.toFixed(2)}</span>s
          </label>
          <input
            id="chordComparisonPairPause"
            type="range"
            min={0.3}
            max={2.0}
            step={0.1}
            value={settings.pairPauseSec}
            onChange={(e) => setState({ pairPauseSec: Number(e.target.value) })}
          />
        </div>
      </div>

      <SaveAsCustomTopicButton topicId="chord-comparison" getSettings={() => useChordComparisonSettings.getState()} />
    </section>
  );
}
