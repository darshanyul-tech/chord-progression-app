import '../../styles/topics/chord-recognition.css';
import '../../styles/topics/chord-comparison.css';
import { ChoiceGrid } from '../../components/ChoiceGrid';
import { SessionScoreLine } from '../../components/SessionScoreLine';
import { StatusLine } from '../../components/StatusLine';
import { TransportRow } from '../../components/TransportRow';
import { getChordComparisonChoiceDefs } from '../../lib/recognition/chordComparison';
import { useChordComparisonSettings } from '../../state/settings/chord-comparison';
import { ChordComparisonSettings } from './Settings';
import { useChordComparisonPractice } from './usePractice';

function loadBadgeFor(status: string): string {
  if (status === 'loading') return ' (loading samples...)';
  if (status === 'ready') return ' (ready)';
  return '';
}

export function ChordComparisonTopic() {
  const settings = useChordComparisonSettings();
  const setSettingsState = useChordComparisonSettings.setState;
  const practice = useChordComparisonPractice(settings);
  const choiceDefs = getChordComparisonChoiceDefs();

  return (
    <>
      <ChordComparisonSettings />
      <section className="card">
        <h2>Listen &amp; compare</h2>
        <div className="field" style={{ marginBottom: '0.75rem' }}>
          <div className="field-toggle-header">
            <span className="field-toggle-title" id="chord-comparison-auto-advance-title">Auto-advance after answer</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                aria-labelledby="chord-comparison-auto-advance-title"
                checked={settings.autoAdvance}
                onChange={(e) => setSettingsState({ autoAdvance: e.target.checked })}
              />
              <span className="toggle-slider" aria-hidden="true" />
            </label>
          </div>
          <div className="help">
            When on, the next pair plays automatically after your answer is revealed. You get 3 guesses; only a
            correct <strong>first</strong> guess adds to your score.
          </div>
        </div>

        <TransportRow
          audioStatus={practice.audioStatus}
          loadBadgeText={loadBadgeFor(practice.audioStatus)}
          onInit={practice.init}
          onPlay={practice.play}
          playLabel="Play pair"
          replayVisible={!!practice.question}
          replayDisabled={practice.isPlaying}
          onReplay={practice.replay}
          onStop={practice.stop}
          nextVisible={practice.answered && !settings.autoAdvance}
          nextLabel="Next pair"
          onNext={practice.next}
        />

        <StatusLine text={practice.statusText} kind={practice.statusKind} />
        <p className="chord-comparison-prompt">{practice.promptText}</p>

        <ChoiceGrid
          choices={choiceDefs}
          wrongIds={practice.wrongIds}
          correctId={practice.correctId}
          onSelect={practice.submitGuess}
          disabledAll={!practice.question || practice.answered}
          groupClassName="chord-comparison-choices"
          choiceClassName="chord-comparison-choice"
          ariaLabel="Chord comparison answers"
        />

        <SessionScoreLine
          className="chord-comparison-session-score"
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
