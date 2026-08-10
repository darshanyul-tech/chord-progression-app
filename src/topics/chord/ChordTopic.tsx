import '../../styles/topics/chord-recognition.css';
import { GroupedChoiceGrid } from '../../components/GroupedChoiceGrid';
import { SessionScoreLine } from '../../components/SessionScoreLine';
import { StatusLine } from '../../components/StatusLine';
import { TransportRow } from '../../components/TransportRow';
import { useChordRecognitionSettings } from '../../state/settings/chord-recognition';
import { enabledInversionQualities, enabledInversionsBySubsection } from '../../lib/recognition/chords';
import { ChordSettings } from './ChordSettings';
import { SettingsDisclosure } from '../../components/SettingsDisclosure';
import { useChordPractice } from './usePractice';
import { InversionGuessPicker } from './InversionGuessPicker';

function loadBadgeFor(status: string): string {
  if (status === 'loading') return ' (loading samples...)';
  if (status === 'ready') return ' (ready)';
  return '';
}

export function ChordTopic() {
  const settings = useChordRecognitionSettings();
  const setSettingsState = useChordRecognitionSettings.setState;
  const practice = useChordPractice(settings);

  const invQualities = enabledInversionQualities(settings.inversionChords);
  const invEnabled = enabledInversionsBySubsection(settings.seventhInversions, settings.ninthInversions);
  const q = practice.question;
  const isInversionQuestion = !!q && q.id.startsWith('inv:');
  const inversionReveal =
    practice.answered && isInversionQuestion && q ? { quality: q.quality, inversion: q.inversion } : null;
  const hasAnyAnswer = practice.choiceGroups.length > 0 || invQualities.length > 0;

  return (
    <>
      <SettingsDisclosure>
        <ChordSettings />
      </SettingsDisclosure>
      <section className="card">
        <h2>Listen &amp; identify</h2>
        <div className="field" style={{ marginBottom: '0.75rem' }}>
          <div className="field-toggle-header">
            <span className="field-toggle-title" id="chord-auto-advance-title">Auto-advance after answer</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                aria-labelledby="chord-auto-advance-title"
                checked={settings.autoAdvance}
                onChange={(e) => setSettingsState({ autoAdvance: e.target.checked })}
              />
              <span className="toggle-slider" aria-hidden="true" />
            </label>
          </div>
          <div className="help">
            When on, the next chord plays automatically after your answer is revealed. You get 3 guesses; only a
            correct <strong>first</strong> guess adds to your score.
          </div>
        </div>

        <TransportRow
          audioStatus={practice.audioStatus}
          loadBadgeText={loadBadgeFor(practice.audioStatus)}
          onInit={practice.init}
          onPlay={practice.play}
          playLabel="Play chord"
          replayVisible={!!practice.question}
          replayDisabled={practice.isPlaying}
          onReplay={practice.replay}
          onStop={practice.stop}
          nextVisible={practice.answered && !settings.autoAdvance}
          nextLabel="Next chord"
          onNext={practice.next}
        />

        <StatusLine text={practice.statusText} kind={practice.statusKind} />
        <p className="interval-prompt">{practice.promptText}</p>

        {practice.choiceGroups.length > 0 && (
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
            ariaLabel="Chord answers"
          />
        )}

        {invQualities.length > 0 && (
          <InversionGuessPicker
            qualities={invQualities}
            enabledInversions={invEnabled}
            onGuess={practice.submitGuess}
            wrongIds={practice.wrongIds}
            answered={practice.answered}
            disabled={!practice.question || practice.answered}
            reveal={inversionReveal}
            resetKey={q ? `${q.id}:${q.rootMidi}` : 'none'}
          />
        )}

        {!hasAnyAnswer && (
          <p className="help" style={{ margin: '0.65rem 0 0' }}>
            Enable at least one chord type above.
          </p>
        )}

        <SessionScoreLine
          className="chord-session-score"
          correct={practice.score.correct}
          total={practice.score.total}
        />
        <div className="buttons">
          <button type="button" className="ghost" onClick={practice.resetScore}>
            Reset score
          </button>
        </div>
      </section>
    </>
  );
}
