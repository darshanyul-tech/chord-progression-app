import '../../styles/topics/meter-transposition.css';
import { GlyphIcon } from '../rhythm-dictation/PaletteGlyph';
import { RhythmStaffHost } from '../rhythm-dictation/RhythmStaffHost';
import { SessionScoreLine } from '../../components/SessionScoreLine';
import { meterTranspositionPromptText } from '../../lib/written-theory/meterTransposition';
import { useMeterTranspositionSettings } from '../../state/settings/meter-transposition';
import { MeterTranspositionSettings } from './Settings';
import { SourceRhythmStaff } from './SourceRhythmStaff';
import { useMeterTranspositionPractice } from './usePractice';

// Page layout: docs/15-theory-topics/09 §5 — source rhythm above the answer
// stave, both inside one shared frame, engine §8c's bottom-bar structure —
// here mirroring Rhythm Dictation's own rd-* family (the answer surface is
// the rhythm staff, not the pitched one Transposition's md-* reuse fits) at
// a topic-scoped #meter-transposition-app root. No audio UI anywhere in this
// topic (docs: "no playback, no metronome, no count-in").
export function MeterTranspositionTopic() {
  const settings = useMeterTranspositionSettings();
  const practice = useMeterTranspositionPractice(settings);
  const q = practice.question;

  function handleStaffClick(measureIndex: number, rawBeat: number) {
    practice.setActiveMeasureIndex(measureIndex);
    practice.placeAt(measureIndex, rawBeat);
  }

  return (
    <>
      <MeterTranspositionSettings />

      <section className="card">
        <div className="buttons" style={{ marginTop: '0.1rem' }}>
          <button type="button" onClick={practice.next}>
            New question
          </button>
          <button type="button" className="ghost" onClick={practice.resetScore}>
            Reset score
          </button>
        </div>
        <SessionScoreLine className="rd-session-score" correct={practice.score.correct} total={practice.score.total} />
      </section>

      <section className="card rhythm-card-wrap">
        <div id="meter-transposition-app">
          <header className="rd-header">
            <p className="rd-prompt">{q ? meterTranspositionPromptText(q) : 'Adjust settings to enable at least one meter pair.'}</p>
          </header>

          {q && (
            <>
              <div className="rd-staff-frame mt-source-frame">
                <SourceRhythmStaff beatsPerBar={q.sourceSig.beatsPerBar} beatValue={q.sourceSig.beatValue} measures={q.sourceMeasures} />
              </div>

              <div className="rd-staff-frame">
                <RhythmStaffHost
                  model={{
                    beatsPerBar: q.targetSig.beatsPerBar,
                    beatValue: q.targetSig.beatValue,
                    numMeasures: q.bars,
                    measures: practice.userMeasures,
                    hasSubmitted: practice.hasSubmitted,
                    measureResults: practice.measureResults,
                    correctPattern: q.expectedMeasures,
                    flashMeasure: practice.flashMeasure,
                    playbackFraction: null,
                    cursorMeasureIndex: practice.activeMeasureIndex,
                    cursorBeat: null,
                  }}
                  gridStepVal={practice.gridStepVal}
                  armedDuration={q.paletteDurations[practice.armedIndex]?.duration ?? 1}
                  armedIsRest={q.paletteDurations[practice.armedIndex]?.isRest ?? false}
                  isTieActive={false}
                  onClick={handleStaffClick}
                />
              </div>

              <div className="rd-bottom-bar">
                <div className="rd-palette">
                  {q.paletteDurations.map((entry, i) => (
                    <button
                      key={`${entry.duration}-${entry.isRest}`}
                      type="button"
                      className={`rd-note-btn rd-note-btn-sm${i === practice.armedIndex ? ' rd-btn-armed' : ''}`}
                      title={entry.isRest ? 'Rest' : 'Note'}
                      aria-pressed={i === practice.armedIndex}
                      onClick={() => practice.armDuration(i)}
                    >
                      <GlyphIcon duration={entry.duration} isRest={entry.isRest} />
                    </button>
                  ))}
                  <div className="rd-palette-sep" />
                  <button type="button" className="rd-mod-btn" title="Backspace" onClick={practice.removeLastNote}>
                    &#9003;
                  </button>
                  <button type="button" className="rd-mod-btn" title="Clear bar" onClick={practice.clearActiveMeasure}>
                    &#10005;
                  </button>
                </div>

                <div className="rd-actions">
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
            </>
          )}

          <div className="rd-feedback-strip" aria-live="polite">
            <span style={{ color: practice.feedbackKind === 'ok' ? 'var(--accent-2)' : practice.feedbackKind === 'bad' ? 'var(--danger)' : undefined }}>
              {practice.feedbackMsg}
            </span>
            <span>{practice.questionScoreText}</span>
          </div>
        </div>
      </section>
    </>
  );
}
