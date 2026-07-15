import { GuessRows } from './GuessRows';
import { defaultGuessRow, type GuessRowState } from './usePractice';
import type { ExamChoicesProps } from '../../exam/types';
import type { ResolvedProgressionSettings } from '../../lib/progression/settings';
import { maxInversionFor, type ProgChord } from '../../lib/progression/theory';

// Ported from legacy examProgressionPanel markup (docs/06-exam-mode.md §A) —
// the exam's per-bar guess-row answer UI, reusing the practice-mode GuessRows
// component. No per-row reveal during the exam (results always null/idle).
export function ProgressionExamAnswer({ question, answer, onAnswer, disabled, activeBarIndex }: ExamChoicesProps) {
  const s = question.settings as ResolvedProgressionSettings;
  const progression = question.progression as ProgChord[];
  const rows = (answer as GuessRowState[] | null) ?? progression.map(() => defaultGuessRow(s));

  function handleChange(i: number, patch: Partial<GuessRowState>) {
    onAnswer(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function inversionOptionsFor(i: number): number[] {
    const ch = progression[i];
    const quality = ch ? ch.quality : 'maj7';
    return Array.from({ length: maxInversionFor(quality) + 1 }, (_, k) => k);
  }

  return (
    <>
      <div className="bars">
        {progression.map((_, i) => (
          <div className={`bar${activeBarIndex === i ? ' active' : ''}`} key={i}>
            <span className="num">{i + 1}</span>?
          </div>
        ))}
      </div>
      <h2 style={{ marginTop: '1rem' }}>Your answer</h2>
      <p className="sub">No feedback until the exam ends. {disabled ? 'Submitting…' : 'Submit anytime to move on.'}</p>
      <GuessRows
        rows={rows}
        results={rows.map(() => null)}
        settings={s}
        inversionOptionsFor={inversionOptionsFor}
        onChange={handleChange}
      />
    </>
  );
}
