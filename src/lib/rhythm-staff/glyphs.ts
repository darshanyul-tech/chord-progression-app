// Ported verbatim from legacy rhythm-dictation IIFE (glyph drawing,
// lines ~6078-6218, docs/04-notation-engine.md Part A).

export const RD_COL = {
  ink: '#000000',
  headFill: '#5a5a5a',
  staff: '#000000',
  line: '#000000',
  wrong: '#8b0000',
  ok: '#000000',
  cursor: '#000000',
};

export function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.keys(attrs).forEach((k) => el.setAttribute(k, String(attrs[k])));
  return el;
}

export function addFilledFlag(gNote: SVGGElement, stemX: number, stemTop: number, ink: string, index: number): void {
  const y0 = stemTop - index * 11;
  gNote.appendChild(
    svgEl('path', {
      d:
        `M${stemX} ${y0}` +
        ` C${stemX + 11} ${y0 + 1} ${stemX + 12} ${y0 + 9}` +
        ` ${stemX + 10} ${y0 + 14}` +
        ` C${stemX + 5} ${y0 + 16} ${stemX} ${y0 + 12} Z`,
      fill: ink,
      stroke: 'none',
    }),
  );
}

export function drawNoteGlyph(
  parent: SVGElement,
  duration: number,
  lineY: number,
  scale?: number,
  accentInk?: string | null,
): void {
  const s = scale || 1;
  const ink = accentInk || RD_COL.ink;
  const headFill = accentInk ? accentInk : RD_COL.headFill;
  const stemX = 9;
  const stemTop = -42;
  const gNote = svgEl('g', { transform: `translate(0,${lineY}) scale(${s})` });

  if (Math.abs(duration - 0.333) < 0.02 || Math.abs(duration - 0.667) < 0.02) {
    const tri = svgEl('g', {});
    const text = svgEl('text', {
      x: 0, y: -36, 'text-anchor': 'middle', fill: ink, 'font-size': 12, 'font-weight': '700',
      'font-family': 'Inter, sans-serif',
    });
    text.textContent = '3';
    tri.appendChild(text);
    const offsets = duration < 0.5 ? [-14, 0, 14] : [-10, 10];
    offsets.forEach((ox) => {
      const tg = svgEl('g', { transform: `translate(${ox},0)` });
      tg.appendChild(svgEl('ellipse', { cx: 0, cy: 0, rx: 7, ry: 5, transform: 'rotate(-22)', fill: headFill, stroke: 'none' }));
      tg.appendChild(svgEl('line', { x1: 6, y1: 0, x2: 6, y2: -30, stroke: ink, 'stroke-width': 2, 'stroke-linecap': 'square' }));
      tri.appendChild(tg);
    });
    tri.appendChild(svgEl('line', { x1: -20, y1: -10, x2: 20, y2: -10, stroke: ink, 'stroke-width': 1.6 }));
    gNote.appendChild(tri);
    parent.appendChild(gNote);
    return;
  }

  gNote.appendChild(
    svgEl('ellipse', {
      cx: 0, cy: 0, rx: 11, ry: 7.5,
      transform: 'rotate(-22)',
      fill: duration < 2 ? headFill : 'none',
      stroke: duration < 2 ? 'none' : ink,
      'stroke-width': duration < 2 ? 0 : 1.8,
    }),
  );

  if (duration < 4) {
    gNote.appendChild(
      svgEl('line', { x1: stemX, y1: 0, x2: stemX, y2: stemTop, stroke: ink, 'stroke-width': 2, 'stroke-linecap': 'square' }),
    );
    if (duration <= 0.5) {
      const flagCount = duration <= 0.25 ? 2 : 1;
      for (let f = 0; f < flagCount; f++) addFilledFlag(gNote, stemX, stemTop, ink, f);
    }
  }

  if (Math.abs(duration - 1.5) < 0.02 || Math.abs(duration - 0.75) < 0.02 || Math.abs(duration - 2.5) < 0.02) {
    gNote.appendChild(svgEl('circle', { cx: 16, cy: 2, r: 3.2, fill: ink }));
  }

  parent.appendChild(gNote);
}

export function drawRestGlyph(
  parent: SVGElement,
  duration: number,
  lineY: number,
  scale?: number,
  accentInk?: string | null,
): void {
  const s = scale || 1;
  const ink = accentInk || RD_COL.ink;
  const gRest = svgEl('g', { transform: `translate(0,${lineY}) scale(${s})` });

  if (duration >= 4) {
    gRest.appendChild(svgEl('rect', { x: -12, y: -6, width: 24, height: 6, fill: ink }));
  } else if (duration >= 2) {
    gRest.appendChild(svgEl('rect', { x: -11, y: -14, width: 22, height: 5, fill: ink }));
  } else if (duration >= 1) {
    gRest.appendChild(
      svgEl('path', { d: 'M0 6 L5 -4 L2 4 L8 4 L0 18', fill: 'none', stroke: ink, 'stroke-width': 1.8, 'stroke-linejoin': 'round' }),
    );
  } else {
    gRest.appendChild(
      svgEl('path', { d: 'M0 10 Q7 2 0 -6', fill: 'none', stroke: ink, 'stroke-width': 1.7, 'stroke-linecap': 'round' }),
    );
  }
  parent.appendChild(gRest);
}

export function drawNotehead(g: SVGElement, x: number, y: number, duration: number, color?: string | null): void {
  const wrap = svgEl('g', { transform: `translate(${x},0)` });
  const ink = color && color !== RD_COL.headFill ? color : null;
  drawNoteGlyph(wrap, duration, y, 1, ink);
  g.appendChild(wrap);
}

export function drawRest(g: SVGElement, x: number, y: number, duration: number, color?: string | null): void {
  const wrap = svgEl('g', { transform: `translate(${x},0)` });
  drawRestGlyph(wrap, duration, y, 1, color && color !== RD_COL.headFill ? color : null);
  g.appendChild(wrap);
}
