import '../../styles/topics/chord-recognition.css';
import '../../styles/topics/theory-shared.css';
import { KeySignatureView } from '../../components/theory/KeySignatureView';
import { ChoiceGrid } from '../../components/ChoiceGrid';
import { SessionScoreLine } from '../../components/SessionScoreLine';
import { StatusLine } from '../../components/StatusLine';
import { useKeySignatureSettings } from '../../state/settings/key-signatures';
import { KeySignatureSettings } from './Settings';
import { useKeySignaturePractice } from './usePractice';

export function KeySignaturesTopic() {
  const settings = useKeySignatureSettings();
  const practice = useKeySignaturePractice(settings);

  return (
    <>
      <KeySignatureSettings />
      <section className="card">
        <h2>Name the key</h2>

        {practice.question ? (
          <div className="theory-question-card">
            <p className="theory-prompt">Name the {practice.question.askMode} key.</p>
            <div className="theory-staff-frame">
              <KeySignatureView clef={practice.question.clef} vexKeySpec={practice.question.vexKeySpec} />
            </div>
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
          ariaLabel="Key signature answers"
          emptyMessage="Enable at least one clef above."
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
