import { useLayoutEffect, useRef, useState } from 'react';
import { INTERVAL_TYPES, type IntervalEnabledEntry } from '../lib/recognition/intervals';

interface IntervalMatrixProps {
  enabledIntervals: Record<string, IntervalEnabledEntry>;
  onToggleCell(id: string, dir: 'asc' | 'desc'): void;
  onToggleAll(dir: 'asc' | 'desc'): void;
  /** Direction headers — Interval Recognition uses Ascending/Descending; Interval Singing uses Above/Below (09-improvement-plan.md §16.1). */
  ascLabel?: string;
  descLabel?: string;
}

// Below this available width the 14-column transposed grid can't keep its
// columns wide enough for the ticks + `m2`-style headers to breathe (they start
// crowding well before they actually clip), so we flip to the vertical layout
// instead of showing a squished grid. Measured against the container, not the
// viewport, so it also flips when a desktop window is narrowed or the syllabus
// sidebar eats the width. ~500px keeps ~5px+ of gap around every tick.
const TRANSPOSE_MIN_WIDTH = 500;

// Watches a container's width and reports only whether it's at/above `threshold`
// — a boolean, so React bails out of re-rendering except on the frame the layout
// actually flips (no per-pixel churn while dragging). Measured synchronously
// before first paint to avoid a layout flash.
function useWiderThan<T extends HTMLElement>(threshold: number) {
  const ref = useRef<T>(null);
  const [wide, setWide] = useState(true);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWide(el.getBoundingClientRect().width >= threshold);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w != null) setWide(w >= threshold);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [threshold]);
  return [ref, wide] as const;
}

// Shared between Interval Recognition and Interval Singing (docs/09-improvement-plan.md
// §16.1). Both practice the same INTERVAL_TYPES pool with the same asc/desc-per-
// interval enable matrix; only the direction labels and settings store differ.
//
// Responsive layout: on a wide container the matrix is transposed — intervals
// across the top (compact `id` headers like m2/M2/TT, full names in the title
// tooltip), the two directions down the side. When the container is narrower
// than TRANSPOSE_MIN_WIDTH it flips to the original vertical layout (intervals
// down the side) so it stays usable without horizontal scrolling on phones or a
// shrunk desktop window.
export function IntervalMatrix(props: IntervalMatrixProps) {
  const [ref, transposed] = useWiderThan<HTMLDivElement>(TRANSPOSE_MIN_WIDTH);

  return (
    <div className="interval-matrix-wrap" ref={ref}>
      {transposed ? <TransposedMatrix {...props} /> : <VerticalMatrix {...props} />}
    </div>
  );
}

function TransposedMatrix({
  enabledIntervals,
  onToggleCell,
  onToggleAll,
  ascLabel = 'Ascending',
  descLabel = 'Descending',
}: IntervalMatrixProps) {
  const directions: { dir: 'asc' | 'desc'; label: string }[] = [
    { dir: 'asc', label: ascLabel },
    { dir: 'desc', label: descLabel },
  ];
  return (
    <table className="interval-matrix transposed">
      <thead>
        <tr>
          <th></th>
          {INTERVAL_TYPES.map((def) => (
            <th key={def.id} title={def.label}>
              {def.id}
            </th>
          ))}
          <th></th>
        </tr>
      </thead>
      <tbody>
        {directions.map(({ dir, label }) => (
          <tr key={dir}>
            <td>{label}</td>
            {INTERVAL_TYPES.map((def) => (
              <td key={def.id}>
                <input
                  type="checkbox"
                  aria-label={`${def.label} ${label.toLowerCase()}`}
                  checked={enabledIntervals[def.id]?.[dir] ?? false}
                  onChange={() => onToggleCell(def.id, dir)}
                />
              </td>
            ))}
            <td>
              <button
                type="button"
                className="toggle-all-btn"
                aria-label={`Toggle all ${label.toLowerCase()}`}
                onClick={() => onToggleAll(dir)}
              >
                All
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function VerticalMatrix({
  enabledIntervals,
  onToggleCell,
  onToggleAll,
  ascLabel = 'Ascending',
  descLabel = 'Descending',
}: IntervalMatrixProps) {
  return (
    <table className="interval-matrix">
      <thead>
        <tr>
          <th>Interval</th>
          <th>{ascLabel}</th>
          <th>{descLabel}</th>
        </tr>
      </thead>
      <tbody>
        {INTERVAL_TYPES.map((def) => (
          <tr key={def.id}>
            <td>{def.label}</td>
            <td>
              <input
                type="checkbox"
                aria-label={`${def.label} ${ascLabel.toLowerCase()}`}
                checked={enabledIntervals[def.id]?.asc ?? false}
                onChange={() => onToggleCell(def.id, 'asc')}
              />
            </td>
            <td>
              <input
                type="checkbox"
                aria-label={`${def.label} ${descLabel.toLowerCase()}`}
                checked={enabledIntervals[def.id]?.desc ?? false}
                onChange={() => onToggleCell(def.id, 'desc')}
              />
            </td>
          </tr>
        ))}
        <tr className="interval-toggle-row">
          <td></td>
          <td>
            <button
              type="button"
              className="toggle-all-btn"
              aria-label={`Toggle all ${ascLabel.toLowerCase()}`}
              onClick={() => onToggleAll('asc')}
            >
              All
            </button>
          </td>
          <td>
            <button
              type="button"
              className="toggle-all-btn"
              aria-label={`Toggle all ${descLabel.toLowerCase()}`}
              onClick={() => onToggleAll('desc')}
            >
              All
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
