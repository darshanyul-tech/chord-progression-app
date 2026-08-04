import { Fragment } from 'react';

export interface GroupedChoiceItem {
  id: string;
  label: string;
  // When true, a thin full-width divider is drawn before this item, splitting
  // its group into visual sub-sets.
  dividerBefore?: boolean;
}

export interface GroupedChoiceGroup {
  title: string;
  items: GroupedChoiceItem[];
}

interface GroupedChoiceGridProps {
  groups: GroupedChoiceGroup[];
  wrongIds: string[];
  correctId: string | null;
  onSelect(id: string): void;
  disabledAll: boolean;
  containerClassName: string;
  groupClassName: string;
  groupTitleClassName: string;
  gridClassName: string;
  choiceClassName: string;
  ariaLabel: string;
  emptyMessage?: string;
}

// Shared grouped recognition answer grid (chord/scale) — legacy per-topic
// grouped choice buttons with correct/wrong/reveal-actual class states.
export function GroupedChoiceGrid({
  groups,
  wrongIds,
  correctId,
  onSelect,
  disabledAll,
  containerClassName,
  groupClassName,
  groupTitleClassName,
  gridClassName,
  choiceClassName,
  ariaLabel,
  emptyMessage,
}: GroupedChoiceGridProps) {
  if (!groups.length) {
    return (
      <div className={containerClassName} role="group" aria-label={ariaLabel}>
        <p className="help" style={{ margin: 0 }}>
          {emptyMessage ?? 'Enable at least one option above.'}
        </p>
      </div>
    );
  }

  return (
    <div className={containerClassName} role="group" aria-label={ariaLabel}>
      {groups.map((grp) => (
        <div key={grp.title} className={groupClassName}>
          <h3 className={groupTitleClassName}>{grp.title}</h3>
          <div className={gridClassName}>
            {grp.items.map((item) => {
              const isWrong = wrongIds.includes(item.id);
              const isCorrectReveal = correctId === item.id;
              const cls = [choiceClassName, isWrong ? 'wrong' : '', isCorrectReveal ? 'correct reveal-actual' : '']
                .filter(Boolean)
                .join(' ');
              const button = (
                <button
                  key={item.id}
                  type="button"
                  className={cls}
                  disabled={disabledAll || isWrong}
                  onClick={() => onSelect(item.id)}
                >
                  {item.label}
                </button>
              );
              if (item.dividerBefore) {
                return (
                  <Fragment key={item.id}>
                    <span className="grouped-choice-divider" aria-hidden="true" />
                    {button}
                  </Fragment>
                );
              }
              return button;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
