import { useEffect, useRef } from 'react';
import { Renderer, Stave } from 'vexflow';
import type { Clef } from '../../lib/melody/theory';

interface KeySignatureViewProps {
  clef: Clef;
  vexKeySpec: string;
}

const CANVAS_WIDTH = 260;
const CANVAS_HEIGHT = 130;

/**
 * A stave with just a clef and key signature — no time signature, no notes
 * (docs/14-theory-engine.md §7). Trivial direct VexFlow usage rather than
 * going through buildVexScore/drawMeasureVoice, since there's no voice to
 * lay out at all. The 0-accidental (C/Am) signature renders as a plain
 * stave with nothing extra drawn — verified in KeySignatureView.test.tsx.
 */
export function KeySignatureView({ clef, vexKeySpec }: KeySignatureViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';
    const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
    renderer.resize(CANVAS_WIDTH, CANVAS_HEIGHT);
    const context = renderer.getContext();
    const stave = new Stave(10, 30, CANVAS_WIDTH - 20);
    stave.addClef(clef);
    stave.addKeySignature(vexKeySpec);
    stave.setContext(context).draw();

    const svg = containerRef.current.querySelector('svg');
    if (svg) {
      svg.setAttribute('viewBox', `0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`);
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      svg.style.removeProperty('width');
      svg.style.removeProperty('height');
    }
  }, [clef, vexKeySpec]);

  return <div ref={containerRef} role="img" aria-label={`Key signature staff, ${clef} clef`} />;
}
