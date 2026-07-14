import { degreeOptions, extensionOptions, familyOptions } from '../../lib/progression/grading';
import { inversionLabel } from '../../lib/progression/theory';
import type { ResolvedProgressionSettings } from '../../lib/progression/settings';
import type { GuessRowState } from './usePractice';

interface BarResult {
  text: string;
  ok: boolean;
}

interface GuessRowsProps {
  rows: GuessRowState[];
  results: (BarResult | null)[];
  settings: ResolvedProgressionSettings;
  inversionOptionsFor(i: number): number[];
  onChange(i: number, patch: Partial<GuessRowState>): void;
}

export function GuessRows({ rows, results, settings, inversionOptionsFor, onChange }: GuessRowsProps) {
  const degOpts = degreeOptions(settings);
  const famOpts = familyOptions(settings);
  const extOpts = extensionOptions(settings);

  return (
    <div className="guess-rows">
      {rows.map((row, i) => {
        const result = results[i] ?? null;
        const resultClass = result ? (result.ok ? 'result ok' : 'result bad') : 'result idle';
        const resultText = result ? result.text : 'awaiting';
        return (
          <div className="guess-row" key={i}>
            <span className="barlabel">Bar {i + 1}</span>
            <select value={row.off} onChange={(e) => onChange(i, { off: Number(e.target.value) })}>
              {degOpts.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select value={row.fam} onChange={(e) => onChange(i, { fam: e.target.value })}>
              {famOpts.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select value={row.ext} onChange={(e) => onChange(i, { ext: Number(e.target.value) })}>
              {extOpts.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {settings.inversions && (
              <select value={row.inv} onChange={(e) => onChange(i, { inv: Number(e.target.value) })}>
                {inversionOptionsFor(i).map((k) => (
                  <option key={k} value={k}>
                    {inversionLabel(k)}
                  </option>
                ))}
              </select>
            )}
            <span className={resultClass}>{resultText}</span>
          </div>
        );
      })}
    </div>
  );
}
