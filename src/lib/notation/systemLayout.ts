// Responsive multi-system layout for the dictation staves. A staff is drawn
// into a VexFlow canvas and then CSS-scaled to fill its container
// (width:100%), so on-screen note size = containerWidth / canvasWidth. The old
// renderers used a fixed canvasWidth and crammed every measure onto one row,
// so the notes shrank without bound as the container narrowed or the page was
// zoomed in.
//
// Instead we set canvasWidth == the container's own width, i.e. a 1:1 scale, so
// notes always render at their native, readable size and keep a consistent
// ratio to the page. To fit that fixed measure size, only so many measures
// share a staff line before the rest wrap onto stacked rows below — the staff
// grows taller rather than the notes getting smaller.

export interface SystemLayout {
  /** Measures drawn side by side on one staff line. */
  measuresPerRow: number;
  /** Stacked staff lines needed to hold every measure. */
  numRows: number;
  /** VexFlow drawing-canvas width — the container's width, for a 1:1 render scale. */
  canvasWidth: number;
}

export interface SystemLayoutOptions {
  /** Target minimum width (canvas px, == on-screen px at 1:1) each measure should keep before wrapping. */
  minMeasurePx: number;
  marginLeft: number;
  marginRight: number;
  /** Optional ceiling on measures per row even when the container is very wide. */
  maxPerRow?: number;
  /** Measures per row when the container width is unknown (0, e.g. an unattached test container). */
  fallbackPerRow?: number;
  /** Canvas width when the container width is unknown (default 1000, the legacy fixed canvas). */
  fallbackCanvasWidth?: number;
}

/**
 * Picks how many measures share a staff line so each keeps at least
 * `minMeasurePx` of width at a 1:1 render scale, wrapping the rest onto stacked
 * rows. `canvasWidth` is the container's own width so the SVG renders at native
 * size (notes never shrink with the page — the staff stacks instead).
 */
export function computeSystemLayout(
  numMeasures: number,
  containerWidthPx: number,
  opts: SystemLayoutOptions,
): SystemLayout {
  const { minMeasurePx, marginLeft, marginRight, maxPerRow = Infinity, fallbackPerRow, fallbackCanvasWidth = 1000 } = opts;
  const n = Math.max(1, numMeasures);

  if (containerWidthPx > 0) {
    const usable = containerWidthPx - marginLeft - marginRight;
    const fit = Math.floor(usable / minMeasurePx);
    const measuresPerRow = Math.max(1, Math.min(n, maxPerRow, fit || 1));
    const numRows = Math.ceil(n / measuresPerRow);
    return { measuresPerRow, numRows, canvasWidth: containerWidthPx };
  }

  // Width unknown (e.g. jsdom render tests): fall back to the caller's legacy
  // fixed canvas and per-row count rather than guessing from a zero width.
  const measuresPerRow = Math.max(1, Math.min(n, fallbackPerRow ?? maxPerRow ?? n));
  const numRows = Math.ceil(n / measuresPerRow);
  return { measuresPerRow, numRows, canvasWidth: fallbackCanvasWidth };
}
