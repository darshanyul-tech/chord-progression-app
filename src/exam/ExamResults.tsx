import type { DictationSummary, ExamAnswerRecord, ExamSummary } from './exam-machine';

interface ExamResultsProps {
  summary: ExamSummary;
  dictationSummary: DictationSummary;
  answers: ExamAnswerRecord[];
  onRepeat(): void;
  onLeave(): void;
}

// Ported from legacy ExamController.showResults() (docs/06-exam-mode.md §A),
// extended in Phase 8 (§B3) with a separate "Dictation" section — matched/
// not-matched per question, side-by-side staff via each type's own
// ResultComponent, never blended into the recognition stats above it.
export function ExamResults({ summary, dictationSummary, answers, onRepeat, onLeave }: ExamResultsProps) {
  const recognitionAnswers = answers.filter(
    (a): a is Extract<ExamAnswerRecord, { kind: 'recognition' }> => a.kind === 'recognition',
  );
  const dictationAnswers = answers.filter(
    (a): a is Extract<ExamAnswerRecord, { kind: 'dictation' }> => a.kind === 'dictation',
  );

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
        {dictationSummary.total > 0 && (
          <div className="exam-stat">
            <div className="label">Dictation (separate from recognition accuracy)</div>
            <div className="value">
              {dictationSummary.matched}/{dictationSummary.total} matched
            </div>
          </div>
        )}
      </div>

      <div className="exam-result-list">
        {recognitionAnswers.map((a, idx) => {
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

      {dictationAnswers.length > 0 && (
        <>
          <h2 style={{ marginTop: '1.25rem' }}>Dictation</h2>
          <div className="exam-result-list">
            {dictationAnswers.map((a, idx) => (
              <div className={`exam-result-card ${a.graded.matched ? 'perfect' : 'fail'}`} key={idx}>
                <h3>
                  Question {idx + 1} ({a.type.label}){' '}
                  {a.graded.matched ? (
                    <span className="exam-badge ok">Matched</span>
                  ) : (
                    <span className="exam-badge bad">Not matched</span>
                  )}
                  {a.timedOut && <span className="exam-badge bad">Timed out</span>}
                </h3>
                <a.type.ResultComponent question={a.question} answer={a.answer} matched={a.graded.matched} />
              </div>
            ))}
          </div>
        </>
      )}

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
