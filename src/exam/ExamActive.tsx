import type { ExamPaperQuestion } from './exam-machine';

interface ExamActiveProps {
  entry: ExamPaperQuestion;
  index: number;
  total: number;
  phaseLabel: string;
  remainingSec: number | null;
  canSubmit: boolean;
  answer: unknown;
  onAnswer(answer: unknown): void;
  onSubmit(): void;
  onLeave(): void;
}

function formatCountdown(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Ported from legacy examActiveOverlay markup (docs/06-exam-mode.md §A) —
// hosts whichever ChoicesComponent the current question's type contributes.
export function ExamActive({
  entry,
  index,
  total,
  phaseLabel,
  remainingSec,
  canSubmit,
  answer,
  onAnswer,
  onSubmit,
  onLeave,
}: ExamActiveProps) {
  const Choices = entry.type.ChoicesComponent;
  return (
    <section className="card exam-panel wide">
      <p className="exam-progress">
        Question {index + 1} of {total}
      </p>
      <p className="exam-phase">{phaseLabel}</p>
      {remainingSec !== null && <p className="exam-timer">{formatCountdown(remainingSec)}</p>}

      <Choices question={entry.question} answer={answer} onAnswer={onAnswer} disabled={!canSubmit} />

      <div className="buttons" style={{ marginTop: '0.9rem' }}>
        <button type="button" onClick={onSubmit} disabled={!canSubmit}>
          Submit answer
        </button>
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
