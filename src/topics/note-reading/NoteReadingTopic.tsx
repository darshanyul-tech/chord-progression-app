import '../../styles/topics/chord-recognition.css';
import '../../styles/topics/theory-shared.css';
import { TheoryStaffView } from '../../components/theory/TheoryStaffView';
import { GroupedChoiceGrid } from '../../components/GroupedChoiceGrid';
import { SessionScoreLine } from '../../components/SessionScoreLine';
import { StatusLine } from '../../components/StatusLine';
import { useNoteReadingSettings } from '../../state/settings/note-reading';
import { NoteReadingSettings } from './Settings';
import { useNoteReadingPractice } from './usePractice';

export function NoteReadingTopic() {
  const settings = useNoteReadingSettings();
  const practice = useNoteReadingPractice(settings);

  return (
    <>
      <NoteReadingSettings />
      <section className="card">
        <h2>Name the note</h2>

        {practice.question ? (
          <div className="theory-question-card">
            <p className="theory-prompt">What note is this?</p>
            <div className="theory-staff-frame">
              <TheoryStaffView clef={practice.question.clef} notes={[practice.question.spelling]} />
            </div>
          </div>
        ) : null}

        <StatusLine text={practice.statusText} kind={practice.statusKind} />

        <GroupedChoiceGrid
          groups={practice.choiceGroups}
          wrongIds={practice.wrongIds}
          correctId={practice.correctId}
          onSelect={practice.submitGuess}
          disabledAll={!practice.question || practice.answered}
          containerClassName="chord-answer-groups"
          groupClassName="chord-answer-group"
          groupTitleClassName="chord-answer-group-title"
          gridClassName="chord-choice-grid"
          choiceClassName="chord-choice"
          ariaLabel="Note reading answers"
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
