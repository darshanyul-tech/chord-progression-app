import '../../styles/topics/chord-recognition.css';
import '../../styles/topics/theory-shared.css';
import { ChoiceGrid } from '../../components/ChoiceGrid';
import { SessionScoreLine } from '../../components/SessionScoreLine';
import { StatusLine } from '../../components/StatusLine';
import { useScaleHomeKeysSettings } from '../../state/settings/scale-home-keys';
import { ScaleHomeKeysSettings } from './Settings';
import { useScaleHomeKeysPractice } from './usePractice';

export function ScaleHomeKeysTopic() {
  const settings = useScaleHomeKeysSettings();
  const practice = useScaleHomeKeysPractice(settings);

  return (
    <>
      <ScaleHomeKeysSettings />
      <section className="card">
        <h2>Name the home key</h2>

        {practice.question ? (
          <div className="theory-question-card">
            <p className="theory-prompt">{practice.promptText}</p>
          </div>
        ) : null}

        <StatusLine text={practice.statusText} kind={practice.statusKind} />

        <ChoiceGrid
          choices={practice.choices}
          wrongIds={practice.wrongIds}
          correctId={practice.correctId}
          onSelect={practice.submitGuess}
          disabledAll={!practice.question || practice.answered}
          groupClassName="chord-choice-grid"
          choiceClassName="chord-choice"
          ariaLabel="Scale home key answers"
          emptyMessage="Enable at least one mode above."
        />

        <SessionScoreLine className="theory-session-score" correct={practice.score.correct} total={practice.score.total} />

        <div className="buttons" style={{ marginTop: '0.65rem' }}>
          {practice.answered && (
            <button type="button" onClick={practice.next}>
              Next
            </button>
          )}
          <button type="button" className="ghost" onClick={practice.resetScore}>
            Reset score
          </button>
        </div>
      </section>
    </>
  );
}
