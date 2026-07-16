import '../../styles/topics/chord-singing.css';
import { PitchMeter } from '../../components/PitchMeter';
import { SessionScoreLine } from '../../components/SessionScoreLine';
import { StatusLine } from '../../components/StatusLine';
import { audio } from '../../lib/audio/engine';
import { midiToNoteName } from '../../lib/theory';
import { useChordSingingSettings } from '../../state/settings/chord-singing';
import { ChordSingingSettings } from './Settings';
import { useChordSingingPractice } from './usePractice';
import type { SungGradeResult } from '../../lib/pitch/grading';

function ToneProgressStrip({
  toneOffsets,
  toneIndex,
  toneResults,
  isListening,
  toneRoleLabel,
}: {
  toneOffsets: number[];
  toneIndex: number;
  toneResults: SungGradeResult[];
  isListening: boolean;
  toneRoleLabel: (offset: number) => string;
}) {
  return (
    <div className="chord-singing-tone-strip" role="list" aria-label="Tone progress">
      {toneOffsets.map((offset, i) => {
        const result = toneResults[i];
        let state = 'pending';
        if (result) state = result.correct ? 'correct' : 'wrong';
        else if (i === toneIndex && isListening) state = 'active';
        return (
          <div key={i} role="listitem" className={`chord-singing-tone-chip chord-singing-tone-chip-${state}`}>
            {toneRoleLabel(offset)}
            {state === 'correct' ? ' ✓' : state === 'wrong' ? ' ✗' : ''}
          </div>
        );
      })}
    </div>
  );
}

function promptTextFor(
  phase: string,
  question: { qualityLabel: string; toneOffsets: number[]; promptMode: 'echo' | 'construction' } | null,
  toneIndex: number,
  attemptsUsed: number,
  maxAttempts: number,
  toneRoleLabel: (offset: number) => string,
): string {
  if (!question) return '';
  if (phase === 'presenting') {
    return question.promptMode === 'echo' ? 'Listen to the chord…' : 'Listen to the root…';
  }
  if (phase === 'listening') {
    const label = toneRoleLabel(question.toneOffsets[toneIndex]!);
    const constructionHint = question.promptMode === 'construction' ? ` Sing a ${question.qualityLabel} chord.` : '';
    return `Sing tone ${toneIndex + 1} of ${question.toneOffsets.length} (${label}).${constructionHint} Attempt ${attemptsUsed + 1} of ${maxAttempts}.`;
  }
  if (phase === 'revealing') return 'Revealing — chord tones, then the full chord.';
  if (phase === 'done') return 'Round complete.';
  return '';
}

export function ChordSingingTopic() {
  const settings = useChordSingingSettings();
  const practice = useChordSingingPractice(settings);

  const audioReady = practice.audioStatus === 'ready';
  const micReady = practice.micStatus === 'ready';
  const canPlay = audioReady && micReady;

  return (
    <>
      <ChordSingingSettings />
      <section className="card">
        <h2>Sing the chord</h2>
        <p className="sub">
          A chord is presented; sing its tones one at a time, root to top. Audio never leaves your device — no
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
            <p className="chord-singing-prompt">
              {promptTextFor(
                practice.phase,
                practice.question,
                practice.toneIndex,
                practice.attemptsUsed,
                practice.maxAttempts,
                practice.toneRoleLabel,
              )}
              {practice.phase === 'presenting' && practice.question.promptMode === 'echo'
                ? ` Root: ${midiToNoteName(practice.question.rootMidi)}.`
                : ''}
            </p>

            <ToneProgressStrip
              toneOffsets={practice.question.toneOffsets}
              toneIndex={practice.toneIndex}
              toneResults={practice.toneResults}
              isListening={practice.phase === 'listening'}
              toneRoleLabel={practice.toneRoleLabel}
            />

            {practice.phase === 'listening' && (
              <PitchMeter centsOffset={practice.liveCentsOffset} toleranceCents={practice.toleranceCents} />
            )}
          </>
        )}

        <p
          className="chord-singing-feedback"
          aria-live="polite"
          style={{ color: practice.feedbackKind === 'ok' ? 'var(--accent-2)' : practice.feedbackKind === 'bad' ? 'var(--danger)' : undefined }}
        >
          {practice.feedbackMsg}
        </p>

        <SessionScoreLine
          className="chord-singing-session-score"
          correct={practice.score.correct}
          total={practice.score.total}
        />
      </section>
    </>
  );
}
