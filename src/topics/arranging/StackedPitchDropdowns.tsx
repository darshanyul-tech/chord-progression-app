import { midiToName, type Spelling } from '../../lib/arranging/pitch';

interface StackedPitchDropdownsProps {
  voiceCount: number;
  spelling: Spelling;
  value: (number | null)[];
  lockedRows: number[];
  disabled: boolean;
  onChange: (midis: (number | null)[]) => void;
  octaveRange?: [number, number];
}

const SHARP_PCS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FLAT_PCS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

// §4.1 — N stacked rows, top row = voice 1 = lead. Each row: pitch-class select
// + octave select. Locked rows (the supplied lead) are read-only.
export function StackedPitchDropdowns({
  voiceCount,
  spelling,
  value,
  lockedRows,
  disabled,
  onChange,
  octaveRange = [2, 6],
}: StackedPitchDropdownsProps) {
  const pcLabels = spelling === 'flat' ? FLAT_PCS : SHARP_PCS;
  const octaves: number[] = [];
  for (let o = octaveRange[0]; o <= octaveRange[1]; o++) octaves.push(o);

  function setRow(row: number, pc: number | null, octave: number | null) {
    const next = [...value];
    next[row] = pc == null || octave == null ? null : (octave + 1) * 12 + pc;
    onChange(next);
  }

  /** Highest MIDI ≤ ceil whose pitch class is pc. */
  function closestAtOrBelow(pc: number, ceil: number): number {
    const ceilPc = ((ceil % 12) + 12) % 12;
    return ceil - ((ceilPc - pc + 12) % 12);
  }

  // Picking a note auto-places it at the closest instance BELOW the note in the
  // nearest filled row above — voicings hang down from the lead, so this is
  // almost always the octave the user wants (they can still override it).
  function handlePitchChange(row: number, pcStr: string) {
    if (pcStr === '') {
      setRow(row, null, null);
      return;
    }
    const pc = Number(pcStr);
    let refMidi: number | null = null;
    for (let r = row - 1; r >= 0; r--) {
      if (value[r] != null) {
        refMidi = value[r]!;
        break;
      }
    }
    let octave: number;
    if (refMidi != null) {
      const midi = closestAtOrBelow(pc, refMidi - 1);
      octave = Math.max(octaveRange[0], Math.min(octaveRange[1], Math.floor(midi / 12) - 1));
    } else {
      octave = octaveRange[1];
    }
    setRow(row, pc, octave);
  }

  return (
    <div className="arr-stack" role="group" aria-label="Voicing entry, top to bottom">
      {Array.from({ length: voiceCount }, (_, row) => {
        const midi = value[row] ?? null;
        const pc = midi == null ? '' : String(((midi % 12) + 12) % 12);
        const oct = midi == null ? '' : String(Math.floor(midi / 12) - 1);
        const locked = lockedRows.includes(row);
        const label = row === 0 ? '1 (lead)' : String(row + 1);
        const nameForAria = midi == null ? 'empty' : `${midiToName(midi, spelling).letter}${midiToName(midi, spelling).octave}`;
        return (
          <div className="arr-stack-row" key={row}>
            <span className="arr-stack-label">{label}</span>
            <select
              aria-label={`Voice ${label} pitch (${nameForAria})`}
              value={pc}
              disabled={disabled || locked}
              onChange={(e) => handlePitchChange(row, e.target.value)}
            >
              <option value="">—</option>
              {pcLabels.map((name, i) => (
                <option key={i} value={i}>
                  {name}
                </option>
              ))}
            </select>
            <select
              aria-label={`Voice ${label} octave`}
              value={oct}
              disabled={disabled || locked || pc === ''}
              onChange={(e) => setRow(row, pc === '' ? null : Number(pc), e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">—</option>
              {octaves.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            {locked && <span className="arr-stack-lock" aria-hidden="true">🔒</span>}
          </div>
        );
      })}
    </div>
  );
}
