import '../../styles/topics/melodic-dictation.css';
import { SlotStaffInput } from '../../components/theory/SlotStaffInput';
import { SessionScoreLine } from '../../components/SessionScoreLine';
import { useIntervalWritingSettings } from '../../state/settings/interval-writing';
import { IntervalWritingSettings } from './Settings';
import { useIntervalWritingPractice } from './usePractice';

// Page layout: docs/14-theory-engine.md §8c — melodic dictation's card
// structure and CSS classes verbatim, so the writing topics' controls sit
// exactly where aural users already know them.
export function IntervalWritingTopic() {
  const settings = useIntervalWritingSettings();
  const practice = useIntervalWritingPractice(settings);

  return (
    <>
      <IntervalWritingSettings />

      <section className="card">
        <div className="buttons" style={{ marginTop: '0.1rem' }}>
          <button type="button" onClick={practice.next}>
            New question
          </button>
          <button type="button" className="ghost" onClick={practice.resetScore}>
            Reset score
          </button>
        </div>
        <SessionScoreLine className="iw-session-score" correct={practice.score.correct} total={practice.score.total} />
      </section>

      <section className="card md-card-wrap">
        <div id="interval-writing-app">
          <header className="md-header">
            <p className="md-prompt">{practice.promptText}</p>
          </header>

          <div className="md-staff-frame">
            {practice.question && (
              <SlotStaffInput
                clef={practice.question.clef}
                slots={practice.slots}
                lockedIndices={[0]}
                slotColors={practice.slotColors}
                armedAccidental={practice.armedAccidental}
                disabled={practice.hasSubmitted}
                onPlace={practice.placeAt}
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
              <button type="button" className="md-mod-btn" title="Backspace" onClick={practice.removeLast}>
                &#9003;
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
