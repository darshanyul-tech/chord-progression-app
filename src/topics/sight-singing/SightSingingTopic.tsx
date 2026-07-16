import '../../styles/topics/sight-singing.css';
import { PitchMeter } from '../../components/PitchMeter';
import { SessionScoreLine } from '../../components/SessionScoreLine';
import { StatusLine } from '../../components/StatusLine';
import { audio } from '../../lib/audio/engine';
import type { SungGradeResult } from '../../lib/pitch/grading';
import { useSightSingingSettings } from '../../state/settings/sight-singing';
import { SightSingingSettings } from './Settings';
import { SightSingingStaffHost } from './SightSingingStaffHost';
import { useSightSingingPractice } from './usePractice';

function NoteProgressStrip({
  count,
  noteIndex,
  noteResults,
  isListening,
}: {
  count: number;
  noteIndex: number;
  noteResults: SungGradeResult[];
  isListening: boolean;
}) {
  return (
    <div className="sight-singing-note-strip" role="list" aria-label="Note progress">
      {Array.from({ length: count }, (_, i) => {
        const result = noteResults[i];
        let state = 'pending';
        if (result) state = result.correct ? 'correct' : 'wrong';
        else if (i === noteIndex && isListening) state = 'active';
        return (
          <div key={i} role="listitem" className={`sight-singing-note-chip sight-singing-note-chip-${state}`}>
            {i + 1}
            {state === 'correct' ? ' ✓' : state === 'wrong' ? ' ✗' : ''}
          </div>
        );
      })}
    </div>
  );
}

function promptTextFor(
  phase: string,
  noteIndex: number,
  totalNotes: number,
  attemptsUsed: number,
  maxAttempts: number,
): string {
  if (phase === 'presenting') return 'Listen to the tonic chord, then the starting note…';
  if (phase === 'listening') {
    return `Sing note ${noteIndex + 1} of ${totalNotes}. Attempt ${attemptsUsed + 1} of ${maxAttempts}.`;
  }
  if (phase === 'revealing') return 'Revealing — the melody, note by note.';
  if (phase === 'done') return 'Round complete.';
  return '';
}

export function SightSingingTopic() {
  const settings = useSightSingingSettings();
  const practice = useSightSingingPractice(settings);

  const audioReady = practice.audioStatus === 'ready';
  const micReady = practice.micStatus === 'ready';
  const canPlay = audioReady && micReady;

  return (
    <>
      <SightSingingSettings />
      <section className="card">
        <h2>Sight sing the melody</h2>
        <p className="sub">
          A short melody is notated below; sing it back one note at a time. Audio never leaves your device — no
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
            onClick={practice.replayStartNote}
            disabled={!canPlay || !practice.question}
          >
            Replay start note
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
            <p className="sight-singing-prompt">
              {promptTextFor(practice.phase, practice.noteIndex, practice.question.targetMidis.length, practice.attemptsUsed, practice.maxAttempts)}
            </p>

            <div className="sight-singing-staff">
              <SightSingingStaffHost melody={practice.question.melody} activeFraction={practice.activeFraction} />
            </div>

            <NoteProgressStrip
              count={practice.question.targetMidis.length}
              noteIndex={practice.noteIndex}
              noteResults={practice.noteResults}
              isListening={practice.phase === 'listening'}
            />

            {practice.phase === 'listening' && (
              <PitchMeter centsOffset={practice.liveCentsOffset} toleranceCents={practice.toleranceCents} />
            )}
          </>
        )}

        <p
          className="sight-singing-feedback"
          aria-live="polite"
          style={{ color: practice.feedbackKind === 'ok' ? 'var(--accent-2)' : practice.feedbackKind === 'bad' ? 'var(--danger)' : undefined }}
        >
          {practice.feedbackMsg}
        </p>

        <SessionScoreLine
          className="sight-singing-session-score"
          correct={practice.score.correct}
          total={practice.score.total}
        />
      </section>
    </>
  );
}
