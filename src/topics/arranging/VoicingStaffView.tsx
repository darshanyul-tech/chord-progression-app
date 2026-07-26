import { useEffect, useRef } from 'react';
import { Accidental, Formatter, Renderer, Stave, StaveNote } from 'vexflow';
import { midiToName, type Spelling } from '../../lib/arranging/pitch';

interface VoicingStaffViewProps {
  clef?: 'treble' | 'bass';
  spelling?: Spelling;
  /** Each column is a chord (array of MIDI). A single voicing = one column; a melody = one MIDI per column. */
  columns: number[][];
  ariaLabel?: string;
}

function vexKey(midi: number, spelling: Spelling): { key: string; acc: string | null } {
  const { letter, accidental, octave } = midiToName(midi, spelling);
  const accStr = accidental ?? '';
  return { key: `${letter.toLowerCase()}${accStr}/${octave}`, acc: accidental };
}

// Direct VexFlow render of chords/voicings (buildVexScore is single-note-per-beat
// melody-oriented; voicings need stacked noteheads). Read-only, display only.
export function VoicingStaffView({ clef = 'treble', spelling = 'sharp', columns, ariaLabel }: VoicingStaffViewProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = '';
    if (!columns.length) return;

    const width = 90 + columns.length * 70;
    const height = 150;
    const renderer = new Renderer(el, Renderer.Backends.SVG);
    renderer.resize(width, height);
    const ctx = renderer.getContext();

    const stave = new Stave(6, 24, width - 16);
    stave.addClef(clef).setContext(ctx).draw();

    const notes = columns.map((col) => {
      const sorted = [...col].sort((a, b) => a - b);
      const keys = sorted.map((m) => vexKey(m, spelling));
      const note = new StaveNote({ keys: keys.map((k) => k.key), duration: 'w', clef });
      keys.forEach((k, i) => {
        if (k.acc) note.addModifier(new Accidental(k.acc), i);
      });
      return note;
    });

    try {
      Formatter.FormatAndDraw(ctx, stave, notes);
    } catch {
      // Rendering a pathological voicing must never crash the topic.
    }
  }, [clef, spelling, columns]);

  return <div ref={ref} role="img" aria-label={ariaLabel ?? 'Music notation stave (read-only)'} />;
}
