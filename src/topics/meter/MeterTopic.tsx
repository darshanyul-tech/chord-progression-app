import '../../styles/topics/interval-recognition.css';
import '../../styles/topics/meter-recognition.css';
import { ChoiceGrid } from '../../components/ChoiceGrid';
import { SessionScoreLine } from '../../components/SessionScoreLine';
import { StatusLine } from '../../components/StatusLine';
import { TransportRow } from '../../components/TransportRow';
import { useMeterRecognitionSettings } from '../../state/settings/meter-recognition';
import { MeterSettings } from './MeterSettings';
import { useMeterPractice } from './usePractice';

function loadBadgeFor(status: string): string {
  if (status === 'loading') return ' (loading samples...)';
  if (status === 'ready') return ' (ready)';
  return '';
}

const AMBIGUOUS_PAIR = ['2/4', '4/4'];

export function MeterTopic() {
  const settings = useMeterRecognitionSettings();
  const practice = useMeterPractice(settings);

  const isAmbiguousSetup =
    settings.emphasis === 'neutral' &&
    settings.enabledSignatures.length === 2 &&
    AMBIGUOUS_PAIR.every((sig) => settings.enabledSignatures.includes(sig));

  return (
    <>
      <MeterSettings />
      <section className="card">
        <h2>Listen &amp; identify</h2>

        <TransportRow
          audioStatus={practice.audioStatus}
          loadBadgeText={loadBadgeFor(practice.audioStatus)}
          onInit={practice.init}
          onPlay={practice.play}
          playLabel="Play excerpt"
          replayVisible={!!practice.question}
          onReplay={practice.replay}
          onStop={practice.stop}
          nextVisible={practice.answered && !settings.autoAdvance}
          nextLabel="Next excerpt"
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
          ariaLabel="Time signature answers"
          emptyMessage="Enable at least two time signatures in the settings above."
        />
        {isAmbiguousSetup && (
          <p className="status warn">
            2/4 and 4/4 with neutral emphasis are genuinely hard to tell apart — enable emphasis or add another
            signature in the settings above if this feels like guessing.
          </p>
        )}

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
