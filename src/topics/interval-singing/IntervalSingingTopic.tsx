import '../../styles/topics/interval-singing.css';
import { SessionScoreLine } from '../../components/SessionScoreLine';
import { StatusLine } from '../../components/StatusLine';
import { audio } from '../../lib/audio/engine';
import { useIntervalSingingSettings } from '../../state/settings/interval-singing';
import { SingingSettings } from './Settings';
import { useIntervalSingingPractice } from './usePractice';

function PitchMeter({ centsOffset, toleranceCents }: { centsOffset: number | null; toleranceCents: number }) {
  const clamped = centsOffset === null ? 0 : Math.max(-100, Math.min(100, centsOffset));
  const pct = 50 + (clamped / 100) * 50;
  const inTolerance = centsOffset !== null && Math.abs(centsOffset) <= toleranceCents;
  const toleranceWidthPct = (toleranceCents / 100) * 100;

  return (
    <div className="pitch-meter">
      <div
        className="pitch-meter-track"
        role="img"
        aria-label={centsOffset === null ? 'Listening for pitch' : `${Math.round(centsOffset)} cents from the target`}
      >
        <div
          className="pitch-meter-tolerance"
          style={{ left: `${50 - toleranceWidthPct / 2}%`, width: `${toleranceWidthPct}%` }}
        />
        <div className="pitch-meter-center" />
        {centsOffset !== null && (
          <div className={`pitch-meter-needle${inTolerance ? ' in-tune' : ''}`} style={{ left: `${pct}%` }} />
        )}
      </div>
      <p className="pitch-meter-label">
        {centsOffset === null ? 'Listening…' : `${centsOffset > 0 ? '+' : ''}${Math.round(centsOffset)}¢ from target`}
      </p>
    </div>
  );
}

export function IntervalSingingTopic() {
  const settings = useIntervalSingingSettings();
  const practice = useIntervalSingingPractice(settings);

  const audioReady = practice.audioStatus === 'ready';
  const micReady = practice.micStatus === 'ready';
  const canPlay = audioReady && micReady;

  return (
    <>
      <SingingSettings />
      <section className="card">
        <h2>Sing the interval</h2>
        <p className="sub">
          A root note plays; sing the named interval above or below it. Audio never leaves your device — no
          recording, no upload.
        </p>

        <div className="buttons" style={{ marginTop: '0.1rem' }}>
          {!audioReady && (
            <button type="button" onClick={() => audio.initAudio()} disabled={practice.audioStatus === 'loading'}>
              Initialize Audio
              <span className="loadbadge">{practice.audioStatus === 'loading' ? ' (loading samples...)' : ''}</span>
            </button>
          )}
          {audioReady && !micReady && (
            <button type="button" onClick={practice.initMic} disabled={practice.micStatus === 'requesting'}>
              Enable microphone
              <span className="loadbadge">{practice.micStatus === 'requesting' ? ' (waiting for permission...)' : ''}</span>
            </button>
          )}
          <button type="button" onClick={practice.newQuestion} disabled={!canPlay}>
            New question
          </button>
          <button
            type="button"
            className="secondary"
            onClick={practice.replayRoot}
            disabled={!canPlay || !practice.question}
          >
            Replay root
          </button>
          <button type="button" className="ghost" onClick={practice.stop}>
            Stop
          </button>
          <button type="button" className="ghost" onClick={practice.resetScore}>
            Reset score
          </button>
        </div>

        <StatusLine text={practice.statusText} kind={practice.statusKind} />

        {practice.question && (
          <>
            <p className="singing-prompt">
              {practice.phase === 'playingRoot' && 'Listen to the root…'}
              {practice.phase === 'listening' &&
                `Sing ${practice.question.intervalLabel} ${practice.question.targetSemitones >= 0 ? 'above' : 'below'} the root. Attempt ${practice.attemptsUsed + 1} of ${practice.maxAttempts}.`}
              {practice.phase === 'revealing' && 'Revealing — root and target together.'}
              {practice.phase === 'done' && 'Round complete.'}
            </p>

            {practice.phase === 'listening' && (
              <PitchMeter centsOffset={practice.liveCentsOffset} toleranceCents={practice.toleranceCents} />
            )}
          </>
        )}

        <p
          className="singing-feedback"
          aria-live="polite"
          style={{ color: practice.feedbackKind === 'ok' ? 'var(--accent-2)' : practice.feedbackKind === 'bad' ? 'var(--danger)' : undefined }}
        >
          {practice.feedbackMsg}
        </p>

        <SessionScoreLine
          className="singing-session-score"
          correct={practice.score.correct}
          total={practice.score.total}
        />
      </section>
    </>
  );
}
