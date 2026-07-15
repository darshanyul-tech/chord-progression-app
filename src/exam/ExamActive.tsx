import { useEffect, useRef } from 'react';
import type { ExamPaperEntry } from './exam-machine';

interface ExamActiveProps {
  entry: ExamPaperEntry;
  index: number;
  total: number;
  phaseLabel: string;
  remainingSec: number | null;
  canSubmit: boolean;
  remainingReplays: number;
  isReplaying: boolean;
  answer: unknown;
  activeBarIndex: number | 'ref' | null;
  onAnswer(answer: unknown): void;
  onSubmit(): void;
  onReplay(): void;
  onLeave(): void;
}

function formatCountdown(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Ported from legacy examActiveOverlay markup (docs/06-exam-mode.md §A) —
// hosts whichever answer component the current question's type contributes
// (ChoicesComponent for recognition, AnswerComponent for dictation, §B3).
export function ExamActive({
  entry,
  index,
  total,
  phaseLabel,
  remainingSec,
  canSubmit,
  remainingReplays,
  isReplaying,
  answer,
  activeBarIndex,
  onAnswer,
  onSubmit,
  onReplay,
  onLeave,
}: ExamActiveProps) {
  const disabled = !canSubmit;
  const showReplay = remainingSec !== null;
  const panelRef = useRef<HTMLElement>(null);

  // Focus management (09-improvement-plan.md §14.3): each new question moves
  // focus to its own panel instead of leaving it on the just-clicked Submit
  // button from the previous question.
  useEffect(() => {
    panelRef.current?.focus();
  }, [index]);

  return (
    <section className="card exam-panel wide" ref={panelRef} tabIndex={-1}>
      <p className="exam-progress">
        Question {index + 1} of {total}
      </p>
      <div className="exam-progress-bar" role="progressbar" aria-valuenow={index + 1} aria-valuemin={1} aria-valuemax={total}>
        <div className="exam-progress-bar-fill" style={{ width: `${((index + 1) / total) * 100}%` }} />
      </div>
      <p className="exam-phase">{phaseLabel}</p>
      {remainingSec !== null && (
        <p className="exam-timer" role="timer" aria-live="off">
          {formatCountdown(remainingSec)}
        </p>
      )}

      {entry.kind === 'recognition' ? (
        <entry.type.ChoicesComponent
          question={entry.question}
          answer={answer}
          onAnswer={onAnswer}
          disabled={disabled}
          activeBarIndex={activeBarIndex}
        />
      ) : (
        <entry.type.AnswerComponent question={entry.question} answer={answer} onAnswer={onAnswer} disabled={disabled} />
      )}

      <div className="buttons" style={{ marginTop: '0.9rem' }}>
        <button type="button" onClick={onSubmit} disabled={disabled}>
          Submit answer
        </button>
        {showReplay && (
          <button type="button" className="secondary" onClick={onReplay} disabled={remainingReplays <= 0 || isReplaying}>
            Replay ({remainingReplays} left)
          </button>
        )}
        <button
          type="button"
          className="ghost"
          onClick={() => {
            if (window.confirm('Leave the exam? Your progress on this attempt will be lost.')) onLeave();
          }}
        >
          Leave exam
        </button>
      </div>
    </section>
  );
}
