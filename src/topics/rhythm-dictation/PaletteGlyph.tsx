import { useEffect, useRef } from 'react';
import { Dot, Formatter, Renderer, Stave, StaveNote, Voice } from 'vexflow';
import { vexDurationFor } from '../../lib/rhythm-staff/vexDuration';

const ICON_WIDTH = 44;
const ICON_HEIGHT = 68;

function renderMiniNote(container: HTMLDivElement, duration: number, isRest: boolean) {
  container.innerHTML = '';
  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(ICON_WIDTH, ICON_HEIGHT);
  const context = renderer.getContext();

  // Stave is only used as a positioning reference (line/clef geometry) —
  // its lines are never drawn, so the palette icon shows just the glyph.
  const stave = new Stave(-20, 0, ICON_WIDTH + 40, { numLines: 0 });

  const { duration: vexDur, dots } = vexDurationFor(duration);
  const note = new StaveNote({ keys: ['b/4'], duration: isRest ? `${vexDur}r` : vexDur, autoStem: !isRest });
  if (dots > 0) Dot.buildAndAttach([note], { all: true });

  const voice = new Voice({ numBeats: 4, beatValue: 4 });
  voice.setMode(Voice.Mode.SOFT);
  voice.addTickables([note]);
  new Formatter().joinVoices([voice]).format([voice], ICON_WIDTH - 4);
  voice.draw(context, stave);

  const svg = container.querySelector('svg');
  if (svg) {
    svg.setAttribute('viewBox', `0 0 ${ICON_WIDTH} ${ICON_HEIGHT}`);
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.style.removeProperty('width');
    svg.style.removeProperty('height');
  }
}

export function NoteGlyphIcon({ duration }: { duration: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) renderMiniNote(ref.current, duration, false);
  }, [duration]);
  return <div ref={ref} className="rd-glyph" aria-hidden="true" />;
}

export function RestGlyphIcon() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) renderMiniNote(ref.current, 1, true);
  }, []);
  return <div ref={ref} className="rd-glyph" aria-hidden="true" />;
}
