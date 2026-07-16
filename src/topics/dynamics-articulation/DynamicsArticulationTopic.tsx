import '../../styles/topics/dynamics-articulation.css';
import { ChoiceGrid } from '../../components/ChoiceGrid';
import { SessionScoreLine } from '../../components/SessionScoreLine';
import { StatusLine } from '../../components/StatusLine';
import { TransportRow } from '../../components/TransportRow';
import { getDynamicsArticulationChoiceDefs } from '../../lib/recognition/dynamicsArticulation';
import { useDynamicsArticulationSettings } from '../../state/settings/dynamics-articulation';
import { DynamicsArticulationSettings } from './Settings';
import { useDynamicsArticulationPractice } from './usePractice';

function loadBadgeFor(status: string): string {
  if (status === 'loading') return ' (loading samples...)';
  if (status === 'ready') return ' (ready)';
  return '';
}

export function DynamicsArticulationTopic() {
  const settings = useDynamicsArticulationSettings();
  const setSettingsState = useDynamicsArticulationSettings.setState;
  const practice = useDynamicsArticulationPractice(settings);
  const choiceDefs = getDynamicsArticulationChoiceDefs(settings);

  return (
    <>
      <DynamicsArticulationSettings />
      <section className="card">
        <h2>Listen &amp; judge</h2>
        <div className="field" style={{ marginBottom: '0.75rem' }}>
          <div className="field-toggle-header">
            <span className="field-toggle-title" id="da-auto-advance-title">Auto-advance after answer</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                aria-labelledby="da-auto-advance-title"
                checked={settings.autoAdvance}
                onChange={(e) => setSettingsState({ autoAdvance: e.target.checked })}
              />
              <span className="toggle-slider" aria-hidden="true" />
            </label>
          </div>
          <div className="help">
            When on, the next phrase plays automatically after your answer is revealed. You get 3 guesses; only a
            correct <strong>first</strong> guess adds to your score.
          </div>
        </div>

        <TransportRow
          audioStatus={practice.audioStatus}
          loadBadgeText={loadBadgeFor(practice.audioStatus)}
          onInit={practice.init}
          onPlay={practice.play}
          playLabel="Play phrase"
          replayVisible={!!practice.question}
          replayDisabled={practice.isPlaying}
          onReplay={practice.replay}
          onStop={practice.stop}
          nextVisible={practice.answered && !settings.autoAdvance}
          nextLabel="Next phrase"
          onNext={practice.next}
        />

        <StatusLine text={practice.statusText} kind={practice.statusKind} />
        <p className="dynamics-articulation-prompt">{practice.promptText}</p>

        <ChoiceGrid
          choices={choiceDefs}
          wrongIds={practice.wrongIds}
          correctId={practice.correctId}
          onSelect={practice.submitGuess}
          disabledAll={!practice.question || practice.answered}
          groupClassName="dynamics-articulation-choices"
          choiceClassName="dynamics-articulation-choice"
          ariaLabel="Dynamics and articulation answers"
        />

        <SessionScoreLine
          className="dynamics-articulation-session-score"
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
