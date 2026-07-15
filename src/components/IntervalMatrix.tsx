import { INTERVAL_TYPES, type IntervalEnabledEntry } from '../lib/recognition/intervals';

interface IntervalMatrixProps {
  enabledIntervals: Record<string, IntervalEnabledEntry>;
  onToggleCell(id: string, dir: 'asc' | 'desc'): void;
  onToggleAll(dir: 'asc' | 'desc'): void;
  /** Column headers — Interval Recognition uses Ascending/Descending; Interval Singing uses Above/Below (09-improvement-plan.md §16.1). */
  ascLabel?: string;
  descLabel?: string;
}

// Shared between Interval Recognition and Interval Singing (docs/09-improvement-plan.md
// §16.1: "interval pool (reuse the interval-recognition matrix component)") —
// both practice the same INTERVAL_TYPES pool with the same asc/desc-per-row
// enable matrix; only the column labels and the settings store differ.
export function IntervalMatrix({ enabledIntervals, onToggleCell, onToggleAll, ascLabel = 'Ascending', descLabel = 'Descending' }: IntervalMatrixProps) {
  return (
    <div className="interval-matrix-wrap">
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
    </div>
  );
}
