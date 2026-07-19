import '../../styles/topics/melodic-dictation.css';
import { ChordStaffInput } from '../../components/theory/ChordStaffInput';
import { SessionScoreLine } from '../../components/SessionScoreLine';
import { useChordWritingSettings } from '../../state/settings/chord-writing';
import { ChordWritingSettings } from './Settings';
import { useChordWritingPractice } from './usePractice';

// Page layout: docs/14-theory-engine.md §8c — melodic dictation's card
// structure and CSS classes verbatim.
export function ChordWritingTopic() {
  const settings = useChordWritingSettings();
  const practice = useChordWritingPractice(settings);

  return (
    <>
      <ChordWritingSettings />

      <section className="card">
        <div className="buttons" style={{ marginTop: '0.1rem' }}>
          <button type="button" onClick={practice.next}>
            New question
          </button>
          <button type="button" className="ghost" onClick={practice.resetScore}>
            Reset score
          </button>
        </div>
        <SessionScoreLine className="cw-session-score" correct={practice.score.correct} total={practice.score.total} />
      </section>

      <section className="card md-card-wrap">
        <div id="chord-writing-app">
          <header className="md-header">
            <p className="md-prompt">{practice.promptText}</p>
          </header>

          <div className="md-staff-frame">
            {practice.question && (
              <ChordStaffInput
                clef={practice.question.clef}
                maxTones={practice.maxTones}
                stack={practice.stack}
                revealStack={practice.revealStack}
                armedAccidental={practice.armedAccidental}
                disabled={practice.hasSubmitted}
                onToggle={practice.toggle}
              />
            )}
          </div>

          <div className="md-bottom-bar">
            <div className="md-palette">
              <button
                type="button"
                className={`md-mod-btn md-mod-btn-lg${practice.armedAccidental === '#' ? ' md-mod-active' : ''}`}
                title="Sharp"
                aria-pressed={practice.armedAccidental === '#'}
                onClick={practice.toggleSharp}
              >
                &#9839;
              </button>
              <button
                type="button"
                className={`md-mod-btn md-mod-btn-lg${practice.armedAccidental === 'b' ? ' md-mod-active' : ''}`}
                title="Flat"
                aria-pressed={practice.armedAccidental === 'b'}
                onClick={practice.toggleFlat}
              >
                &#9837;
              </button>
              <button type="button" className="md-mod-btn" title="Clear" onClick={practice.clearAll}>
                &#10005;
              </button>
            </div>

            <div className="md-actions">
              {settings.hearIt && practice.hasSubmitted && (
                <button type="button" className="secondary" onClick={practice.playHearIt}>
                  Hear it
                </button>
              )}
              <button type="button" disabled={!practice.submitEnabled} onClick={practice.checkAnswer}>
                Submit &#8594;
              </button>
              {practice.hasSubmitted && (
                <button type="button" onClick={practice.next}>
                  Next &#8594;
                </button>
              )}
            </div>
          </div>

          <div className="md-feedback-strip" aria-live="polite">
            <span
              style={{
                color:
                  practice.feedbackKind === 'ok'
                    ? 'var(--accent-2)'
                    : practice.feedbackKind === 'bad'
                      ? 'var(--danger)'
                      : undefined,
              }}
            >
              {practice.feedbackMsg}
            </span>
          </div>
        </div>
      </section>
    </>
  );
}
