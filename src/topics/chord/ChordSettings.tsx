import { CHORD_RECOGNITION_GROUPS, CHORD_RECOGNITION_TYPES } from '../../lib/recognition/chords';
import { useChordRecognitionSettings } from '../../state/settings/chord-recognition';

export function ChordSettings() {
  const settings = useChordRecognitionSettings();
  const setState = useChordRecognitionSettings.setState;
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
      <h2>Chord types to practise</h2>
      <div className="help">
        Choose which qualities can appear. Answer buttons below are grouped the same way for quick scanning.
      </div>
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

      <div className="field" style={{ marginTop: '0.85rem' }}>
        <label htmlFor="chordPlaybackStyle">Playback style</label>
        <select
          id="chordPlaybackStyle"
          value={settings.playbackStyle}
          onChange={(e) => setState({ playbackStyle: e.target.value as 'block' | 'arp' })}
        >
          <option value="block">Block chord</option>
          <option value="arp">Upward arpeggio</option>
        </select>
        <div className="help">Block plays all notes together; arpeggio plays low to high, one note at a time.</div>
      </div>

      <div className={`grid${isArp ? ' settings-hidden' : ''}`}>
        <div className="field">
          <label htmlFor="chordHoldLen">
            Chord length: <span className="valtag">{settings.holdLen.toFixed(1)}</span>s
          </label>
          <input
            id="chordHoldLen"
            type="range"
            min={0.6}
            max={3}
            step={0.1}
            value={settings.holdLen}
            onChange={(e) => setState({ holdLen: Number(e.target.value) })}
          />
        </div>
      </div>
      <div className={`grid${isArp ? '' : ' settings-hidden'}`}>
        <div className="field">
          <label htmlFor="chordArpNoteLen">
            Arpeggio note length: <span className="valtag">{settings.arpNoteLen.toFixed(2)}</span>s
          </label>
          <input
            id="chordArpNoteLen"
            type="range"
            min={0.2}
            max={1}
            step={0.05}
            value={settings.arpNoteLen}
            onChange={(e) => setState({ arpNoteLen: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label htmlFor="chordArpGap">
            Gap between notes: <span className="valtag">{settings.arpGap.toFixed(2)}</span>s
          </label>
          <input
            id="chordArpGap"
            type="range"
            min={0}
            max={0.4}
            step={0.02}
            value={settings.arpGap}
            onChange={(e) => setState({ arpGap: Number(e.target.value) })}
          />
        </div>
      </div>
    </section>
  );
}
