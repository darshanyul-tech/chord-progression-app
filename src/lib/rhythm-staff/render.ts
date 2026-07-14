import { BAR_BOTTOM, BAR_TOP, LINE_Y, NOTE_Y, STAFF_LEFT, STAFF_RIGHT, measureWidth, noteX, sortNotes, type Measure } from '../rhythm/time';
import { RD_COL, drawNotehead, drawRest, svgEl } from './glyphs';

// Ported verbatim from legacy renderStaff()/drawMeasureNotes()
// (lines ~6211-6310, docs/04-notation-engine.md Part A). Parameterized
// into an explicit model per the doc's allowance (only Tier-1 change).

export interface RhythmStaffModel {
  beatsPerBar: number;
  beatValue: number;
  numMeasures: number;
  measures: Measure[];
  hasSubmitted: boolean;
  measureResults: boolean[];
  correctPattern: Measure[];
  flashMeasure: number | null;
  /** 0..1 playback cursor position across the whole staff, or null when not playing. */
  playbackFraction: number | null;
}

export function drawMeasureNotes(
  g: SVGElement,
  notes: Measure,
  measureIndex: number,
  numMeasures: number,
  measureTotalBeats: number,
  color: string,
  yOffset: number,
): void {
  const y = NOTE_Y + (yOffset || 0);
  sortNotes(notes).forEach((n) => {
    const x = noteX(measureIndex, n.beat, numMeasures, measureTotalBeats);
    if (n.isRest) drawRest(g, x, y, n.duration, color);
    else drawNotehead(g, x, y, n.duration, color);
  });
}

export function renderStaff(svg: SVGSVGElement, model: RhythmStaffModel): void {
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const { beatsPerBar, beatValue, numMeasures, measures, hasSubmitted, measureResults, correctPattern, flashMeasure, playbackFraction } =
    model;
  const measureTotalBeats = beatsPerBar * (4 / beatValue);

  svg.appendChild(svgEl('rect', { x: 46, y: BAR_TOP, width: 6, height: BAR_BOTTOM - BAR_TOP, fill: RD_COL.ink }));
  svg.appendChild(svgEl('rect', { x: 56, y: BAR_TOP, width: 6, height: BAR_BOTTOM - BAR_TOP, fill: RD_COL.ink }));

  const numText = svgEl('text', {
    x: 92, y: LINE_Y - 4, 'font-size': 38, 'font-family': "Georgia, 'Times New Roman', serif",
    fill: RD_COL.ink, 'text-anchor': 'middle', 'font-weight': '700',
  });
  numText.textContent = String(beatsPerBar);
  svg.appendChild(numText);
  const denText = svgEl('text', {
    x: 92, y: LINE_Y + 30, 'font-size': 38, 'font-family': "Georgia, 'Times New Roman', serif",
    fill: RD_COL.ink, 'text-anchor': 'middle', 'font-weight': '700',
  });
  denText.textContent = String(beatValue);
  svg.appendChild(denText);

  svg.appendChild(svgEl('line', { x1: 72, y1: LINE_Y, x2: STAFF_RIGHT, y2: LINE_Y, stroke: RD_COL.staff, 'stroke-width': 2 }));

  const mw = measureWidth(numMeasures);
  for (let m = 0; m <= numMeasures; m++) {
    const x = STAFF_LEFT + m * mw;
    const isFinal = m === numMeasures;
    svg.appendChild(svgEl('line', { x1: x, y1: BAR_TOP, x2: x, y2: BAR_BOTTOM, stroke: RD_COL.line, 'stroke-width': isFinal ? 3 : 1.2 }));
    if (isFinal) {
      svg.appendChild(svgEl('line', { x1: x - 5, y1: BAR_TOP, x2: x - 5, y2: BAR_BOTTOM, stroke: RD_COL.line, 'stroke-width': 1.2 }));
    }
  }

  if (flashMeasure !== null) {
    const fx = STAFF_LEFT + flashMeasure * mw;
    svg.appendChild(svgEl('rect', { x: fx, y: BAR_TOP - 4, width: mw, height: BAR_BOTTOM - BAR_TOP + 8, fill: RD_COL.wrong, opacity: 0.08, rx: 2 }));
  }

  if (playbackFraction !== null) {
    const cx = STAFF_LEFT + playbackFraction * (STAFF_RIGHT - STAFF_LEFT);
    svg.appendChild(svgEl('line', { x1: cx, y1: BAR_TOP - 6, x2: cx, y2: BAR_BOTTOM + 6, stroke: RD_COL.cursor, 'stroke-width': 1.5, opacity: 0.75 }));
  }

  if (!hasSubmitted) {
    for (let mi = 0; mi < numMeasures; mi++) {
      if (!(measures[mi] || []).length) {
        const cx = STAFF_LEFT + mi * mw + mw / 2;
        svg.appendChild(svgEl('rect', { x: cx - 8, y: LINE_Y - 22, width: 16, height: 5, fill: RD_COL.ink, opacity: 0.22, rx: 0.5 }));
      }
    }
  }

  measures.forEach((notes, mi) => {
    drawMeasureNotes(svg, notes, mi, numMeasures, measureTotalBeats, RD_COL.ink, 0);
  });

  if (hasSubmitted) {
    measures.forEach((_notes, mi) => {
      const ok = measureResults[mi];
      const mx = STAFF_LEFT + mi * mw + mw - 16;
      if (ok) {
        const tickG = svgEl('g', {});
        tickG.appendChild(svgEl('circle', { cx: mx, cy: LINE_Y - 14, r: 7, fill: RD_COL.ok }));
        const t = svgEl('text', { x: mx, y: LINE_Y - 10, 'text-anchor': 'middle', fill: '#fff', 'font-size': 10, 'font-weight': '700' });
        t.textContent = '✓';
        tickG.appendChild(t);
        svg.appendChild(tickG);
      } else {
        drawMeasureNotes(svg, correctPattern[mi] || [], mi, numMeasures, measureTotalBeats, RD_COL.wrong, -16);
      }
    });
  }
}
