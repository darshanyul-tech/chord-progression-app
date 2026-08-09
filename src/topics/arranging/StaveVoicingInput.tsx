import { useEffect, useRef, useState } from 'react';
import { buildArrStave, type ArrStaveResult, type ArrStaveTone } from '../../lib/arranging/arrStave';
import { NATURAL_LETTERS, resolveStaffPosition } from '../../lib/melody/theory';
import { PREVIEW_COLOR } from '../../lib/notation/colors';
import { spelledToMidi, type Accidental, type SpelledPitch } from '../../lib/written-theory/spelledPitch';
import { midiToName, type Spelling } from '../../lib/arranging/pitch';

interface StaveVoicingInputProps {
  voiceCount: number;
  leadMidi: number;
  spelling: Spelling;
  /** Show a grand staff (treble + bass) — set when the answer dips well below the treble stave. */
  grand: boolean;
  disabled: boolean;
  /** Bumped by the host on each new question so the stack re-seeds with the lead. */
  resetKey: number;
  onChange: (midis: number[]) => void;
}

const HOVER_COLOR = PREVIEW_COLOR;
const REMOVE_COLOR = 'rgba(179, 38, 30, 0.5)';

function midiToSpelled(midi: number, spelling: Spelling): SpelledPitch {
  const { letter, accidental, octave } = midiToName(midi, spelling);
  return { letter, acc: (accidental ?? '') as Accidental, octave };
}

function samePosition(a: { letter: string; octave: number }, b: { letter: string; octave: number }): boolean {
  return a.letter === b.letter && a.octave === b.octave;
}

interface Hover {
  letter: string;
  octave: number;
  removing: boolean;
}

export function StaveVoicingInput({ voiceCount, leadMidi, spelling, grand, disabled, resetKey, onChange }: StaveVoicingInputProps) {
  const lead = midiToSpelled(leadMidi, spelling);
  const [stack, setStack] = useState<SpelledPitch[]>([lead]);
  const [armed, setArmed] = useState<'' | '#' | 'b'>('');
  const [hover, setHover] = useState<Hover | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const geomRef = useRef<ArrStaveResult | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Re-seed with the (locked) lead whenever a new question arrives.
  useEffect(() => {
    setStack([midiToSpelled(leadMidi, spelling)]);
    setArmed('');
    setHover(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // Report the stack up as MIDI whenever it changes (pure effect, never inside a
  // setState updater).
  useEffect(() => {
    onChangeRef.current(stack.map(spelledToMidi));
  }, [stack]);

  const accFor = (): Accidental => armed;

  // Render pass — draws the stave with the committed stack plus a hover ghost /
  // removal tint, and captures the geometry for click resolution.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const tones: ArrStaveTone[] = stack.map((p) => ({ pitch: p }));
    if (!disabled && hover) {
      if (hover.removing) {
        const idx = stack.findIndex((t) => samePosition(t, hover));
        if (idx >= 0) tones[idx] = { pitch: stack[idx]!, color: REMOVE_COLOR };
      } else if (stack.length < voiceCount) {
        tones.push({ pitch: { letter: hover.letter, acc: accFor(), octave: hover.octave }, color: HOVER_COLOR });
      }
    }
    geomRef.current = buildArrStave(el, { grand, tones });
  });

  function pointFromEvent(evt: { clientX: number; clientY: number }): { x: number; y: number } | null {
    const svg = containerRef.current?.querySelector('svg');
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const loc = pt.matrixTransform(ctm.inverse());
    return { x: loc.x, y: loc.y };
  }

  function resolve(y: number): Hover | null {
    const geom = geomRef.current;
    if (!geom) return null;
    const useBass = geom.bass && geom.splitY != null && y > geom.splitY;
    const g = useBass ? geom.bass! : geom.treble;
    const clef = useBass ? 'bass' : 'treble';
    const { letterIndex, octave } = resolveStaffPosition(y, g.topLineY, g.spacing, clef);
    const letter = NATURAL_LETTERS[letterIndex]!;
    const removing = stack.some((t) => samePosition(t, { letter, octave }));
    return { letter, octave, removing };
  }

  function handleClick(evt: React.MouseEvent<HTMLDivElement>) {
    if (disabled) return;
    const pt = pointFromEvent(evt);
    if (!pt) return;
    const r = resolve(pt.y);
    if (!r) return;
    if (samePosition(r, lead)) return; // lead is locked
    setStack((prev) => {
      const existing = prev.find((t) => samePosition(t, r));
      if (existing) return prev.filter((t) => t !== existing);
      if (prev.length < voiceCount) return [...prev, { letter: r.letter, acc: accFor(), octave: r.octave }];
      return prev;
    });
  }

  function handleMove(evt: React.MouseEvent<HTMLDivElement>) {
    if (disabled) return;
    const pt = pointFromEvent(evt);
    if (!pt) return;
    setHover(resolve(pt.y));
  }

  return (
    <div className="arr-stave-input">
      <div
        ref={containerRef}
        className={`arr-stave-frame${grand ? ' grand' : ''}`}
        role="application"
        aria-label="Voicing stave. Click a position to add a voice, click a note to remove it. The lead is fixed."
        onClick={handleClick}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      />
      <div className="arr-stave-palette" role="group" aria-label="Note tools">
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
          title="Remove last note"
          aria-label="Remove last note"
          disabled={disabled || stack.length <= 1}
          onClick={() => setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))}
        >
          &#9003;
        </button>
        <button
          type="button"
          className="arr-mod-btn"
          title="Clear added voices"
          aria-label="Clear added voices"
          disabled={disabled || stack.length <= 1}
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
