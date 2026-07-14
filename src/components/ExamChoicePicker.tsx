import type { ExamChoicesProps } from '../exam/types';

// Ported from legacy renderExamRecognitionChoices/makeExamRecognitionChoiceBtn
// (docs/06-exam-mode.md §A): pick-only choice buttons — no correct/wrong
// reveal during the exam itself (legacy's "no feedback until the end").
// Shared by interval/chord/scale exam types (flat vs. grouped choiceDefs).

interface ChoiceItem {
  id: string;
  label: string;
}

interface ChoiceGroup {
  title: string;
  items: ChoiceItem[];
}

export interface ExamGuess {
  guessId: string | null;
  guessLabel: string;
}

function ChoiceButton({
  item,
  selected,
  disabled,
  onPick,
}: {
  item: ChoiceItem;
  selected: boolean;
  disabled: boolean;
  onPick(item: ChoiceItem): void;
}) {
  return (
    <button
      type="button"
      className={`exam-rec-choice${selected ? ' exam-pick-selected' : ''}`}
      disabled={disabled}
      onClick={() => onPick(item)}
    >
      {item.label}
    </button>
  );
}

export function ExamChoicePicker({ question, answer, onAnswer, disabled }: ExamChoicesProps) {
  const guess = answer as ExamGuess | null;
  const grouped = (question.choiceGrouped as ChoiceGroup[] | undefined) ?? [];
  const defs = (question.choiceDefs as ChoiceItem[] | undefined) ?? [];

  function pick(item: ChoiceItem) {
    onAnswer({ guessId: item.id, guessLabel: item.label });
  }

  if (grouped.length) {
    return (
      <div className="chord-answer-groups">
        {grouped.map((grp) => (
          <div className="chord-answer-group" key={grp.title}>
            <h3 className="chord-answer-group-title">{grp.title}</h3>
            <div className="chord-choice-grid">
              {grp.items.map((item) => (
                <ChoiceButton
                  key={item.id}
                  item={item}
                  selected={guess?.guessId === item.id}
                  disabled={disabled}
                  onPick={pick}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (defs.length) {
    return (
      <div className="chord-choice-grid">
        {defs.map((item) => (
          <ChoiceButton
            key={item.id}
            item={item}
            selected={guess?.guessId === item.id}
            disabled={disabled}
            onPick={pick}
          />
        ))}
      </div>
    );
  }

  return <p className="help">No answer choices configured.</p>;
}
