import { useEffect, useRef } from 'react';
import { Dot, Formatter, Renderer, Stave, StaveNote, Stem, Voice } from 'vexflow';
import { vexDurationFor } from '../../lib/rhythm-staff/vexDuration';

const ICON_WIDTH = 44;
const ICON_HEIGHT = 68;
const BBOX_PAD = 3;
const INK_PAD = 4;
/** Longest side of the offscreen raster used to find the glyph's true ink extent (docs/12 MD-1). */
const RASTER_TARGET = 240;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * VexFlow draws noteheads/flags as `<text>` glyphs from a SMuFL font — their
 * `getBBox()` reflects the font's em-box (ascent/descent), not the glyph's
 * visible ink, so sizing a viewBox directly from it (as the safe containing
 * box below does) leaves the glyph rendering tiny inside a mostly-blank
 * button. This rasterizes the glyph into an offscreen canvas and scans for
 * actual opaque pixels to find the true ink box, in `containingBox`'s unit
 * space. Returns null (caller keeps the safe containing box) if canvas/Image
 * rasterization isn't available (e.g. the test environment) or finds no ink.
 */
async function rasterizeInkBox(svg: SVGSVGElement, containingBox: Box): Promise<Box | null> {
  try {
    if (containingBox.width <= 0 || containingBox.height <= 0) return null;
    const aspect = containingBox.width / containingBox.height;
    const w = Math.max(1, Math.round(aspect >= 1 ? RASTER_TARGET : RASTER_TARGET * aspect));
    const h = Math.max(1, Math.round(aspect >= 1 ? RASTER_TARGET / aspect : RASTER_TARGET));

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('viewBox', `${containingBox.x} ${containingBox.y} ${containingBox.width} ${containingBox.height}`);
    clone.setAttribute('width', String(w));
    clone.setAttribute('height', String(h));
    clone.style.removeProperty('width');
    clone.style.removeProperty('height');
    const xml = new XMLSerializer().serializeToString(clone);
    const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(xml)))}`;

    const img = new Image();
    const loaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('PaletteGlyph rasterization: image load failed'));
    });
    img.src = dataUrl;
    await loaded;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    let minX = w;
    let maxX = -1;
    let minY = h;
    let maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3]! > 10) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX) return null;

    return {
      x: containingBox.x + (minX / w) * containingBox.width,
      y: containingBox.y + (minY / h) * containingBox.height,
      width: ((maxX - minX + 1) / w) * containingBox.width,
      height: ((maxY - minY + 1) / h) * containingBox.height,
    };
  } catch {
    return null;
  }
}

function setViewBox(svg: SVGSVGElement, box: Box) {
  svg.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`);
}

function renderMiniNote(container: HTMLDivElement, duration: number, isRest: boolean): () => void {
  container.innerHTML = '';
  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(ICON_WIDTH, ICON_HEIGHT);
  const context = renderer.getContext();

  // Stave is only used as a positioning reference (line/clef geometry) —
  // its lines are never drawn, so the palette icon shows just the glyph.
  const stave = new Stave(-20, 0, ICON_WIDTH + 40, { numLines: 0 });

  const { duration: vexDur, dots } = vexDurationFor(duration);
  // Fixed stem-up (not autoStem): b/4 is the staff middle line, where
  // VexFlow's auto-stem rule points down — that pushed the glyph's ink
  // below this icon's fixed viewBox and out of its button (see docs/12).
  const note = new StaveNote({
    keys: ['b/4'],
    duration: isRest ? `${vexDur}r` : vexDur,
    autoStem: false,
    stemDirection: Stem.UP,
  });
  if (dots > 0) Dot.buildAndAttach([note], { all: true });

  const voice = new Voice({ numBeats: 4, beatValue: 4 });
  voice.setMode(Voice.Mode.SOFT);
  voice.addTickables([note]);
  new Formatter().joinVoices([voice]).format([voice], ICON_WIDTH - 4);
  voice.draw(context, stave);

  const svg = container.querySelector('svg');
  let cancelled = false;
  if (svg) {
    // Pass 1 (synchronous, safe): a box guaranteed to contain every real
    // path/rect the note drew — stem direction, dots, and rest glyphs all
    // have different extents, and the icon's old fixed box didn't contain
    // all of them (see docs/12). Guarantees no clipping even if pass 2 below
    // can't run.
    const inner = svg.querySelector('g, svg > *') as SVGGraphicsElement | null;
    let box: Box = { x: 0, y: 0, width: ICON_WIDTH, height: ICON_HEIGHT };
    try {
      const bbox = (inner ?? svg).getBBox();
      if (bbox.width > 0 && bbox.height > 0) {
        box = {
          x: bbox.x - BBOX_PAD,
          y: bbox.y - BBOX_PAD,
          width: bbox.width + BBOX_PAD * 2,
          height: bbox.height + BBOX_PAD * 2,
        };
      }
    } catch {
      /* getBBox unsupported (e.g. jsdom without layout) — fall back to the fixed box */
    }
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.style.removeProperty('width');
    svg.style.removeProperty('height');
    setViewBox(svg, box);

    // Pass 2 (async, best-effort): the safe box above is sized from
    // getBBox(), which for VexFlow's SMuFL <text> glyphs reflects the
    // font's em-box rather than visible ink — that left the glyph rendering
    // tiny in a mostly-blank button. Rasterize and tighten to the true ink
    // extent once it resolves; harmless if it never does (pass 1 already
    // rendered correctly, just less tightly cropped).
    void rasterizeInkBox(svg, box).then((ink) => {
      if (cancelled || !ink) return;
      setViewBox(svg, {
        x: ink.x - INK_PAD,
        y: ink.y - INK_PAD,
        width: ink.width + INK_PAD * 2,
        height: ink.height + INK_PAD * 2,
      });
    });
  }
  return () => {
    cancelled = true;
  };
}

/** General form of NoteGlyphIcon/RestGlyphIcon below — renders the actual glyph for any (duration, isRest) pair, e.g. a dotted-crotchet rest or a triplet quaver's own shape, not just a generic "rest mode" marker. */
export function GlyphIcon({ duration, isRest }: { duration: number; isRest: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) return renderMiniNote(ref.current, duration, isRest);
    return undefined;
  }, [duration, isRest]);
  return <div ref={ref} className="rd-glyph" aria-hidden="true" />;
}

export function NoteGlyphIcon({ duration }: { duration: number }) {
  return <GlyphIcon duration={duration} isRest={false} />;
}

export function RestGlyphIcon() {
  return <GlyphIcon duration={1} isRest={true} />;
}
