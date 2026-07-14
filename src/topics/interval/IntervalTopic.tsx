import '../../styles/topics/interval-recognition.css';
import { ChoiceGrid } from '../../components/ChoiceGrid';
import { SessionScoreLine } from '../../components/SessionScoreLine';
import { StatusLine } from '../../components/StatusLine';
import { TransportRow } from '../../components/TransportRow';
import { useIntervalRecognitionSettings } from '../../state/settings/interval-recognition';
import { IntervalSettings } from './Settings';
import { useIntervalPractice } from './usePractice';

function loadBadgeFor(status: string): string {
  if (status === 'loading') return ' (loading samples...)';
  if (status === 'ready') return ' (ready)';
  return '';
}

export function IntervalTopic() {
  const settings = useIntervalRecognitionSettings();
  const setSettingsState = useIntervalRecognitionSettings.setState;
  const practice = useIntervalPractice(settings);

  return (
    <>
      <IntervalSettings />
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
            When on, the next interval plays automatically after your answer is revealed. You get 3 guesses; only a
            correct <strong>first</strong> guess adds to your score.
          </div>
        </div>

        <TransportRow
          audioStatus={practice.audioStatus}
          loadBadgeText={loadBadgeFor(practice.audioStatus)}
          onInit={practice.init}
          onPlay={practice.play}
          playLabel="Play interval"
          replayVisible={!!practice.question}
          onReplay={practice.replay}
          onStop={practice.stop}
          nextVisible={practice.answered && !settings.autoAdvance}
          nextLabel="Next interval"
          onNext={practice.next}
        />

        <StatusLine text={practice.statusText} kind={practice.statusKind} />
        <p className="interval-prompt">{practice.promptText}</p>

        <ChoiceGrid
          choices={practice.choiceDefs}
          wrongIds={practice.wrongIds}
          correctId={practice.correctId}
          onSelect={practice.submitGuess}
          disabledAll={!practice.question || practice.answered}
          groupClassName="interval-choices"
          choiceClassName="interval-choice"
          ariaLabel="Interval answers"
          emptyMessage="Enable at least one interval in the settings above."
        />

        <SessionScoreLine
          className="interval-session-score"
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
