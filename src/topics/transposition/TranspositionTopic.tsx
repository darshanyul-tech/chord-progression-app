import '../../styles/topics/melodic-dictation.css';
import { SlotStaffInput } from '../../components/theory/SlotStaffInput';
import { SessionScoreLine } from '../../components/SessionScoreLine';
import { useTranspositionSettings } from '../../state/settings/transposition';
import { TranspositionSettings } from './Settings';
import { SourceStaff } from './SourceStaff';
import { useTranspositionPractice } from './usePractice';

// Page layout: docs/15-theory-topics/08 §4 — source phrase above the answer
// stave, both inside one .md-staff-frame panel, otherwise docs/14 §8c
// verbatim (melodic dictation's card structure/classes).
export function TranspositionTopic() {
  const settings = useTranspositionSettings();
  const practice = useTranspositionPractice(settings);

  return (
    <>
      <TranspositionSettings />

      <section className="card">
        <div className="buttons" style={{ marginTop: '0.1rem' }}>
          <button type="button" onClick={practice.next}>
            New question
          </button>
          <button type="button" className="ghost" onClick={practice.resetScore}>
            Reset score
          </button>
        </div>
        <SessionScoreLine className="tp-session-score" correct={practice.score.correct} total={practice.score.total} />
      </section>

      <section className="card md-card-wrap">
        <div id="transposition-app">
          <header className="md-header">
            <p className="md-prompt">{practice.promptText}</p>
          </header>

          <div className="md-staff-frame">
            {practice.question && (
              <>
                <SourceStaff
                  clef={practice.question.clef}
                  // Safe for major MELODY_KEYS specifically (Transposition's
                  // only source domain, docs §3): id === vexKeySpec for all
                  // of them, e.g. 'Bb' -> 'Bb'.
                  vexKeySpec={practice.question.sourceKeyId}
                  timeSig={practice.question.timeSig}
                  rhythmMeasures={practice.question.sourceMelody.measures}
                  spelledNotes={practice.question.sourceSpelled}
                />
                <SlotStaffInput
                  clef={practice.question.clef}
                  vexKeySpec={practice.question.targetVexKeySpec}
                  signatureKey={practice.targetKey ?? undefined}
                  slots={practice.slots}
                  durations={practice.durations}
                  slotColors={practice.slotColors}
                  armedAccidental={practice.armedAccidental}
                  disabled={practice.hasSubmitted}
                  onPlace={practice.placeAt}
                />
              </>
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
