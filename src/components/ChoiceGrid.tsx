export interface ChoiceDef {
  id: string;
  label: string;
}

interface ChoiceGridProps {
  choices: ChoiceDef[];
  wrongIds: string[];
  correctId: string | null;
  onSelect(id: string): void;
  disabledAll: boolean;
  groupClassName: string;
  choiceClassName: string;
  ariaLabel: string;
  emptyMessage?: string;
}

// Shared recognition answer grid (interval/chord/scale) — legacy per-topic
// choice buttons with correct/wrong/reveal-actual class states (D15 §2).
export function ChoiceGrid({
  choices,
  wrongIds,
  correctId,
  onSelect,
  disabledAll,
  groupClassName,
  choiceClassName,
  ariaLabel,
  emptyMessage,
}: ChoiceGridProps) {
  if (!choices.length) {
    return (
      <div className={groupClassName} role="group" aria-label={ariaLabel}>
        <p className="help" style={{ margin: 0 }}>
          {emptyMessage ?? 'Enable at least one option in the settings above.'}
        </p>
      </div>
    );
  }

  return (
    <div className={groupClassName} role="group" aria-label={ariaLabel}>
      {choices.map((c) => {
        const isWrong = wrongIds.includes(c.id);
        const isCorrectReveal = correctId === c.id;
        const cls = [choiceClassName, isWrong ? 'wrong' : '', isCorrectReveal ? 'correct reveal-actual' : '']
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={c.id}
            type="button"
            className={cls}
            disabled={disabledAll || isWrong}
            onClick={() => onSelect(c.id)}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
