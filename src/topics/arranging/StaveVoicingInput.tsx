import { useEffect, useRef, useState } from 'react';
import { ChordStaffInput } from '../../components/theory/ChordStaffInput';
import type { Clef, NoteSpelling } from '../../lib/melody/theory';
import { spelledToMidi, type Accidental, type SpelledPitch } from '../../lib/written-theory/spelledPitch';
import { midiToName, type Spelling } from '../../lib/arranging/pitch';

interface StaveVoicingInputProps {
  voiceCount: number;
  leadMidi: number;
  spelling: Spelling;
  disabled: boolean;
  /** Bumped by the host on each new question so the stack re-seeds with the lead. */
  resetKey: number;
  onChange: (midis: number[]) => void;
}

function midiToSpelled(midi: number, spelling: Spelling): SpelledPitch {
  const { letter, accidental, octave } = midiToName(midi, spelling);
  return { letter, acc: (accidental ?? '') as Accidental, octave };
}

function samePosition(a: { letter: string; octave: number }, b: { letter: string; octave: number }): boolean {
  return a.letter === b.letter && a.octave === b.octave;
}

// Click-on-stave voicing entry for ARR-01 (the "Stave" input mode). Wraps the
// theory section's ChordStaffInput, but keeps the supplied lead permanently
// placed (it can't be removed) and reports the stack back to the host as MIDI —
// so grading (MIDI multiset, enharmonic-agnostic) is identical to the dropdown
// mode. Accidental spelling is the player's choice; C♯ and D♭ grade the same.
export function StaveVoicingInput({ voiceCount, leadMidi, spelling, disabled, resetKey, onChange }: StaveVoicingInputProps) {
  const lead = midiToSpelled(leadMidi, spelling);
  const [stack, setStack] = useState<SpelledPitch[]>([lead]);
  const [armed, setArmed] = useState<'' | '#' | 'b'>('');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Re-seed with the (locked) lead whenever a new question arrives.
  useEffect(() => {
    setStack([midiToSpelled(leadMidi, spelling)]);
    setArmed('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // Report the stack up as MIDI whenever it changes — a pure effect, never
  // inside a state updater (which would be a setState-during-render violation).
  useEffect(() => {
    onChangeRef.current(stack.map(spelledToMidi));
  }, [stack]);

  function toggle(note: NoteSpelling) {
    if (disabled) return;
    // The lead is locked — clicking its position does nothing.
    if (samePosition(note, lead)) return;
    setStack((prev) => {
      const existing = prev.find((t) => samePosition(t, note));
      if (existing) return prev.filter((t) => t !== existing);
      if (prev.length < voiceCount) return [...prev, { letter: note.letter, acc: (note.accidental ?? '') as Accidental, octave: note.octave }];
      return prev;
    });
  }

  const clef: Clef = leadMidi >= 66 ? 'treble' : 'bass';

  return (
    <div className="arr-stave-input">
      <div className="arr-stave-frame">
        <ChordStaffInput
          clef={clef}
          maxTones={voiceCount}
          stack={stack}
          armedAccidental={armed}
          disabled={disabled}
          onToggle={toggle}
        />
      </div>
      <div className="arr-stave-palette" role="group" aria-label="Accidental palette">
        <button
          type="button"
          className={`arr-mod-btn${armed === '#' ? ' active' : ''}`}
          aria-pressed={armed === '#'}
          title="Sharp"
          disabled={disabled}
          onClick={() => setArmed((a) => (a === '#' ? '' : '#'))}
        >
          &#9839;
        </button>
        <button
          type="button"
          className={`arr-mod-btn${armed === 'b' ? ' active' : ''}`}
          aria-pressed={armed === 'b'}
          title="Flat"
          disabled={disabled}
          onClick={() => setArmed((a) => (a === 'b' ? '' : 'b'))}
        >
          &#9837;
        </button>
        <button
          type="button"
          className="arr-mod-btn"
          title="Clear added voices"
          disabled={disabled}
          onClick={() => setStack([midiToSpelled(leadMidi, spelling)])}
        >
          &#10005;
        </button>
      </div>
      <p className="help" style={{ margin: '0.3rem 0 0' }}>
        Click the stave to add each voice; click a note to remove it. The lead (top note) is fixed.
      </p>
    </div>
  );
}
