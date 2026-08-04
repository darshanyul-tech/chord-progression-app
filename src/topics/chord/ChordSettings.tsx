import { Fragment } from 'react';
import { SaveAsCustomTopicButton } from '../../components/SaveAsCustomTopicButton';
import {
  CHORD_RECOGNITION_GROUPS,
  CHORD_RECOGNITION_TYPES,
  INVERSION_CHORDS,
  INVERSION_LABELS,
  NINTH_INVERSIONS,
  SEVENTH_INVERSIONS,
  type InversionSubsection,
} from '../../lib/recognition/chords';
import { useChordRecognitionSettings } from '../../state/settings/chord-recognition';

const INVERSION_FIELD: Record<InversionSubsection, 'seventhInversions' | 'ninthInversions'> = {
  sevenths: 'seventhInversions',
  ninths: 'ninthInversions',
};

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

  function toggleInversionChord(id: string) {
    setState((s) => {
      const enabled = new Set(s.inversionChords);
      if (enabled.has(id)) enabled.delete(id);
      else enabled.add(id);
      return { inversionChords: [...enabled] };
    });
  }

  function toggleInversion(field: 'seventhInversions' | 'ninthInversions', n: number) {
    setState((s) => {
      const enabled = new Set(s[field]);
      if (enabled.has(n)) enabled.delete(n);
      else enabled.add(n);
      return { [field]: [...enabled].sort((a, b) => a - b) };
    });
  }

  function renderInversionSub(subsection: InversionSubsection, inversions: number[]) {
    const field = INVERSION_FIELD[subsection];
    return (
      <div className="inversion-sub">
        <div className="chord-type-checks">
          {INVERSION_CHORDS.filter((c) => c.subsection === subsection).map((c) => (
            <label key={c.id}>
              <input
                type="checkbox"
                checked={settings.inversionChords.includes(c.id)}
                onChange={() => toggleInversionChord(c.id)}
              />
              {c.label}
            </label>
          ))}
        </div>
        <div className="inversion-invrow">
          <span className="inversion-invrow-label">Inversions</span>
          {inversions.map((n) => (
            <label key={n} className="inversion-invbox">
              <input type="checkbox" checked={settings[field].includes(n)} onChange={() => toggleInversion(field, n)} />
              {INVERSION_LABELS[n]}
            </label>
          ))}
        </div>
      </div>
    );
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
                {types.map((def, i) => {
                  const label = (
                    <label key={def.id}>
                      <input
                        type="checkbox"
                        checked={settings.enabledTypes.includes(def.id)}
                        onChange={() => toggleType(def.id)}
                      />
                      {def.label}
                    </label>
                  );
                  if (def.dividerBefore && i > 0) {
                    return (
                      <Fragment key={def.id}>
                        <span className="grouped-choice-divider" aria-hidden="true" />
                        {label}
                      </Fragment>
                    );
                  }
                  return label;
                })}
              </div>
            </div>
          );
        })}

        <div className="chord-type-group">
          <div className="chord-type-group-header">
            <h3 className="chord-type-group-title">Inversion chords</h3>
          </div>
          <div className="help" style={{ marginTop: '-0.1rem', marginBottom: '0.55rem' }}>
            The chord plays in one of its ticked inversions; you name both the quality and the inversion. Tick the
            inversions to drill for each group (7ths up to 2nd inversion, 9ths up to 3rd).
          </div>
          {renderInversionSub('sevenths', SEVENTH_INVERSIONS)}
          <span className="grouped-choice-divider" aria-hidden="true" />
          {renderInversionSub('ninths', NINTH_INVERSIONS)}
        </div>
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

      <SaveAsCustomTopicButton topicId="chord-recognition" getSettings={() => useChordRecognitionSettings.getState()} />
    </section>
  );
}
