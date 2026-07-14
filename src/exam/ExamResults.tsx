import type { ExamAnswerRecord, ExamSummary } from './exam-machine';

interface ExamResultsProps {
  summary: ExamSummary;
  answers: ExamAnswerRecord[];
  onRepeat(): void;
  onLeave(): void;
}

// Ported from legacy ExamController.showResults() (docs/06-exam-mode.md §A) —
// per-question user-answer vs. correct-answer comparison plus summary stats.
// GradedAnswer.results is generic (progression has >1 row, the other three
// always have exactly 1), so a single render path covers all four types.
export function ExamResults({ summary, answers, onRepeat, onLeave }: ExamResultsProps) {
  return (
    <section className="card exam-panel wide">
      <h2>Exam results</h2>
      <div className="exam-summary-stats">
        <div className="exam-stat">
          <div className="label">Overall</div>
          <div className="value">
            {summary.perfectQuestions}/{summary.totalQuestions} correct ({summary.qPct}%)
          </div>
        </div>
        {summary.byType.map((row) => {
          const pct = row.total ? Math.round((100 * row.perfect) / row.total) : 0;
          return (
            <div className="exam-stat" key={row.label}>
              <div className="label">{row.label}</div>
              <div className="value">
                {row.perfect}/{row.total} ({pct}%)
              </div>
            </div>
          );
        })}
      </div>

      <div className="exam-result-list">
        {answers.map((a, idx) => {
          const cls = a.graded.perfect ? 'perfect' : a.graded.correctUnits > 0 ? 'partial' : 'fail';
          const multiRow = a.graded.results.length > 1;
          return (
            <div className={`exam-result-card ${cls}`} key={idx}>
              <h3>
                Question {idx + 1} ({a.type.label}): {a.type.formatResultHeading(a.question)}{' '}
                {a.graded.perfect ? (
                  <span className="exam-badge ok">Correct</span>
                ) : multiRow ? (
                  <span className="exam-badge bad">
                    {a.graded.correctUnits}/{a.graded.totalUnits} bars
                  </span>
                ) : (
                  <span className="exam-badge bad">Incorrect</span>
                )}
                {a.timedOut && <span className="exam-badge bad">Timed out</span>}
                {a.submittedEarly && <span className="exam-badge ok">Early submit</span>}
              </h3>
              <div className="exam-bar-compare">
                {multiRow && (
                  <div className="exam-bar-row hdr">
                    <span />
                    <span>Your answer</span>
                    <span>Actual</span>
                  </div>
                )}
                {a.graded.results.map((br) => (
                  <div className={`exam-bar-row${br.ok ? '' : ' miss'}`} key={br.bar}>
                    <span>{multiRow ? `Bar ${br.bar}` : ''}</span>
                    <span className="you">{br.yours}</span>
                    <span className="actual">{br.actual}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="buttons" style={{ marginTop: '1rem' }}>
        <button type="button" onClick={onRepeat}>
          Repeat test
        </button>
        <button type="button" className="secondary" onClick={onLeave}>
          Leave test
        </button>
      </div>
    </section>
  );
}
