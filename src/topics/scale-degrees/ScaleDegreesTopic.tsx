import '../../styles/topics/chord-recognition.css';
import '../../styles/topics/theory-shared.css';
import { TheoryStaffView } from '../../components/theory/TheoryStaffView';
import { GroupedChoiceGrid } from '../../components/GroupedChoiceGrid';
import { SessionScoreLine } from '../../components/SessionScoreLine';
import { StatusLine } from '../../components/StatusLine';
import { useScaleDegreesSettings } from '../../state/settings/scale-degrees';
import { ScaleDegreesSettings } from './Settings';
import { useScaleDegreesPractice } from './usePractice';

export function ScaleDegreesTopic() {
  const settings = useScaleDegreesSettings();
  const practice = useScaleDegreesPractice(settings);

  // A single choice grid, wrapped to fit the GroupedChoiceGrid API with one
  // unlabeled group — mirrors the shared answer-frame styling everywhere else.
  const groups = practice.choices.length ? [{ title: 'Scale degree', items: practice.choices }] : [];

  return (
    <>
      <ScaleDegreesSettings />
      <section className="card">
        <h2>Which degree?</h2>

        {practice.question ? (
          <div className="theory-question-card">
            <p className="theory-prompt">{practice.question.promptText}</p>
            {settings.display === 'staffAndText' && (
              <div className="theory-staff-frame">
                <TheoryStaffView
                  clef={practice.question.clef}
                  vexKeySpec={practice.question.key.vexKeySpec}
                  notes={[practice.question.note]}
                />
              </div>
            )}
          </div>
        ) : null}

        <StatusLine text={practice.statusText} kind={practice.statusKind} />

        <GroupedChoiceGrid
          groups={groups}
          wrongIds={practice.wrongIds}
          correctId={practice.correctId}
          onSelect={practice.submitGuess}
          disabledAll={!practice.question || practice.answered}
          containerClassName="chord-answer-groups"
          groupClassName="chord-answer-group"
          groupTitleClassName="chord-answer-group-title"
          gridClassName="chord-choice-grid"
          choiceClassName="chord-choice"
          ariaLabel="Scale degree answers"
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
