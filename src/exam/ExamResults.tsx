import { useEffect, useRef, useState } from 'react';
import type { DictationSummary, ExamAnswerRecord, ExamSummary } from './exam-machine';
import { abortExamPlayback, createExamPlaybackChannel } from './playback';
import type { ExamPlayContext } from './types';
import { audio } from '../lib/audio/engine';

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
// Phase 12.6 adds a per-question Replay button, backed by its own playback
// channel (results-screen questions are already-graded plain data, so no
// exam-machine phase/timer coupling is needed — every type's replayQuestion
// only ever touches ctx.channel/ctx.aborted, never typeConfig/onPhase).
export function ExamResults({ summary, dictationSummary, answers, onRepeat, onLeave }: ExamResultsProps) {
  const recognitionAnswers = answers.filter(
    (a): a is Extract<ExamAnswerRecord, { kind: 'recognition' }> => a.kind === 'recognition',
  );
  const dictationAnswers = answers.filter(
    (a): a is Extract<ExamAnswerRecord, { kind: 'dictation' }> => a.kind === 'dictation',
  );

  const channelRef = useRef(createExamPlaybackChannel());
  const [replayingKey, setReplayingKey] = useState<string | null>(null);

  useEffect(() => () => abortExamPlayback(channelRef.current, audio.sampler), []);

  async function replay(a: ExamAnswerRecord, key: string) {
    if (replayingKey) return;
    setReplayingKey(key);
    const ctx: ExamPlayContext = { typeConfig: {}, channel: channelRef.current, aborted: () => false, onPhase: () => {} };
    await a.type.replayQuestion(a.question, ctx);
    setReplayingKey(null);
  }

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
          const key = `recognition-${idx}`;
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
                <button
                  type="button"
                  className="ghost exam-result-replay"
                  onClick={() => replay(a, key)}
                  disabled={replayingKey !== null}
                >
                  {replayingKey === key ? 'Playing…' : 'Replay'}
                </button>
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
            {dictationAnswers.map((a, idx) => {
              const key = `dictation-${idx}`;
              return (
                <div className={`exam-result-card ${a.graded.matched ? 'perfect' : 'fail'}`} key={idx}>
                  <h3>
                    Question {idx + 1} ({a.type.label}){' '}
                    {a.graded.matched ? (
                      <span className="exam-badge ok">Matched</span>
                    ) : (
                      <span className="exam-badge bad">Not matched</span>
                    )}
                    {a.timedOut && <span className="exam-badge bad">Timed out</span>}
                    <button
                      type="button"
                      className="ghost exam-result-replay"
                      onClick={() => replay(a, key)}
                      disabled={replayingKey !== null}
                    >
                      {replayingKey === key ? 'Playing…' : 'Replay'}
                    </button>
                  </h3>
                  <a.type.ResultComponent question={a.question} answer={a.answer} matched={a.graded.matched} />
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="buttons" style={{ marginTop: '1rem' }}>
        <button type="button" onClick={onRepeat}>
          New test (same setup)
        </button>
        <button type="button" className="secondary" onClick={onLeave}>
          Leave test
        </button>
      </div>
    </section>
  );
}
