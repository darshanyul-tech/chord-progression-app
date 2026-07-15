import '../../styles/topics/chord-recognition.css';
import { GroupedChoiceGrid } from '../../components/GroupedChoiceGrid';
import { SessionScoreLine } from '../../components/SessionScoreLine';
import { StatusLine } from '../../components/StatusLine';
import { TransportRow } from '../../components/TransportRow';
import { useScaleRecognitionSettings } from '../../state/settings/scales';
import { ScaleSettings } from './ScaleSettings';
import { useScalePractice } from './usePractice';

function loadBadgeFor(status: string): string {
  if (status === 'loading') return ' (loading samples...)';
  if (status === 'ready') return ' (ready)';
  return '';
}

export function ScaleTopic() {
  const settings = useScaleRecognitionSettings();
  const setSettingsState = useScaleRecognitionSettings.setState;
  const practice = useScalePractice(settings);

  return (
    <>
      <ScaleSettings />
      <section className="card">
        <h2>Listen &amp; identify</h2>
        <div className="field" style={{ marginBottom: '0.75rem' }}>
          <div className="field-toggle-header">
            <span className="field-toggle-title">Auto-advance after answer</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.autoAdvance}
                onChange={(e) => setSettingsState({ autoAdvance: e.target.checked })}
              />
              <span className="toggle-slider" aria-hidden="true" />
            </label>
          </div>
          <div className="help">
            When on, the next scale plays automatically after your answer is revealed. You get 3 guesses; only a
            correct <strong>first</strong> guess adds to your score.
          </div>
        </div>

        <TransportRow
          audioStatus={practice.audioStatus}
          loadBadgeText={loadBadgeFor(practice.audioStatus)}
          onInit={practice.init}
          onPlay={practice.play}
          playLabel="Play scale"
          replayVisible={!!practice.question}
          replayDisabled={practice.isPlaying}
          onReplay={practice.replay}
          onStop={practice.stop}
          nextVisible={practice.answered && !settings.autoAdvance}
          nextLabel="Next scale"
          onNext={practice.next}
        />

        <StatusLine text={practice.statusText} kind={practice.statusKind} />
        <p className="interval-prompt">{practice.promptText}</p>

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
          ariaLabel="Scale answers"
          emptyMessage="Enable at least one scale above."
        />

        <SessionScoreLine
          className="chord-session-score"
          correct={practice.score.correct}
          total={practice.score.total}
        />
        <div className="buttons" style={{ marginTop: '0.65rem' }}>
          <button type="button" className="ghost" onClick={practice.resetScore}>
            Reset score
          </button>
        </div>
      </section>
    </>
  );
}
