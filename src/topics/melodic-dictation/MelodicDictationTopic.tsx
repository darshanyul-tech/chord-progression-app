import { useEffect, useRef } from 'react';
import '../../styles/topics/melodic-dictation.css';
import { durationClose, durationFitsBar } from '../../lib/rhythm/time';
import { useIsActiveTopic } from '../../hooks/useIsActiveTopic';
import { SessionScoreLine } from '../../components/SessionScoreLine';
import { NoteGlyphIcon, RestGlyphIcon } from '../rhythm-dictation/PaletteGlyph';
import { useMelodicDictationSettings } from '../../state/settings/melodic-dictation';
import { MelodicSettings } from './Settings';
import { VexStaffHost } from './VexStaffHost';
import { useMelodicPractice } from './usePractice';

const PALETTE: { duration: number; label: string; title: string }[] = [
  { duration: 4, label: '1', title: 'Whole note (1)' },
  { duration: 2, label: '2', title: 'Half note (2)' },
  { duration: 1, label: '3', title: 'Quarter note (3)' },
  { duration: 0.5, label: '4', title: 'Eighth note (4)' },
  { duration: 0.25, label: '5', title: 'Sixteenth note (5)' },
  { duration: 1.5, label: '7', title: 'Dotted quarter (7)' },
  { duration: 0.75, label: '8', title: 'Dotted eighth (8)' },
];

const KEY_TO_DURATION: Record<string, number> = {
  '1': 4, '2': 2, '3': 1, '4': 0.5, '5': 0.25, '7': 1.5, '8': 0.75,
};

function loadBadgeFor(status: string): string {
  if (status === 'loading') return ' (loading samples...)';
  if (status === 'ready') return ' (ready)';
  return '';
}

export function MelodicDictationTopic() {
  const settings = useMelodicDictationSettings();
  const practice = useMelodicPractice(settings);
  const isActive = useIsActiveTopic('melodic-dictation');
  const submitBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isActive) return;
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT') return;

      if (Object.prototype.hasOwnProperty.call(KEY_TO_DURATION, e.key)) {
        practice.armDuration(KEY_TO_DURATION[e.key]!);
        return;
      }
      switch (e.key) {
        case 'r':
        case 'R':
          practice.toggleRest();
          break;
        case 'd':
        case 'D':
          practice.toggleDot();
          break;
        case 's':
        case 'S':
          practice.toggleSharp();
          break;
        case 'f':
        case 'F':
          practice.toggleFlat();
          break;
        case 'Backspace':
          e.preventDefault();
          practice.removeLastNote();
          break;
        case 'Delete':
          practice.clearActiveMeasure();
          break;
        case ' ':
          e.preventDefault();
          practice.startPlayback();
          break;
        case 'Enter':
          if (practice.submitEnabled) practice.checkAnswer();
          break;
        case 'ArrowUp':
          e.preventDefault();
          practice.nudgeLastNote(1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          practice.nudgeLastNote(-1);
          break;
        default:
          break;
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, practice.submitEnabled]);

  function handlePlace(measureIndex: number, beat: number, midi: number) {
    practice.setActiveMeasureIndex(measureIndex);
    if (practice.hasSubmitted) return;
    practice.placeNoteAt(measureIndex, beat, practice.armedDuration, practice.armedIsRest, practice.armedIsRest ? null : midi);
  }

  const ready = practice.audioStatus === 'ready';

  return (
    <>
      <MelodicSettings />

      <section className="card">
        <div className="buttons" style={{ marginTop: '0.1rem' }}>
          {!ready && (
            <button type="button" onClick={practice.init} disabled={practice.audioStatus === 'loading'}>
              Initialize Audio<span className="loadbadge">{loadBadgeFor(practice.audioStatus)}</span>
            </button>
          )}
          <button type="button" onClick={practice.generateQuestion}>
            New question
          </button>
          <button type="button" className="secondary" onClick={practice.replay} disabled={!ready}>
            Replay
          </button>
          <button type="button" className="ghost" onClick={practice.stopPlayback}>
            Stop
          </button>
          <button type="button" className="ghost" onClick={practice.resetScore}>
            Reset score
          </button>
        </div>
        <SessionScoreLine
          className="md-session-score"
          correct={practice.score.correct}
          total={practice.score.total}
        />
      </section>

      <section className="card md-card-wrap">
        <div id="melodic-dictation-app">
          <header className="md-header">
            <p className="md-prompt">
              {ready ? 'Notate the melody you hear (pitch and rhythm).' : 'Press Initialize Audio above to hear questions.'}
            </p>
          </header>

          <div className="md-staff-frame">
            <VexStaffHost
              model={{
                key: practice.key,
                clef: practice.clef,
                timeSig: practice.timeSig,
                numMeasures: practice.numMeasures,
                measures: practice.userMeasures,
                hasSubmitted: practice.hasSubmitted,
                isCorrect: practice.isCorrect,
                revealMeasures: practice.hasSubmitted && !practice.isCorrect ? practice.correctMeasures : null,
              }}
              gridStepVal={practice.gridStepVal}
              armedDuration={practice.effectiveDuration(practice.armedDuration)}
              armedAccidental={practice.armedAccidental}
              onPlace={handlePlace}
            />
          </div>

          <div className="md-bottom-bar">
            <div className="md-palette">
              {PALETTE.map((btn) => {
                const allowed = practice.activeDurations.some((d) => durationClose(d, btn.duration));
                const fits = durationFitsBar(practice.effectiveDuration(btn.duration), practice.timeSig.measureBeats);
                const disabled = !allowed || !fits;
                const armed = durationClose(practice.armedDuration, btn.duration);
                return (
                  <button
                    key={btn.duration}
                    type="button"
                    className={`md-note-btn${armed ? ' md-btn-armed' : ''}${disabled ? ' md-dur-disabled' : ''}`}
                    title={btn.title}
                    onClick={() => practice.armDuration(btn.duration)}
                  >
                    <NoteGlyphIcon duration={btn.duration} />
                    <span>{btn.label}</span>
                  </button>
                );
              })}
              <div className="md-palette-sep" />
              <button
                type="button"
                className={`md-mod-btn md-rest-btn${practice.armedIsRest ? ' md-mod-active' : ''}`}
                title="Rest mode (R)"
                onClick={practice.toggleRest}
              >
                <RestGlyphIcon />
              </button>
              <button
                type="button"
                className={`md-mod-btn${practice.isDotActive ? ' md-mod-active' : ''}`}
                title="Dot (D)"
                onClick={practice.toggleDot}
              >
                &#183;
              </button>
              <button
                type="button"
                className={`md-mod-btn${practice.armedAccidental === '#' ? ' md-mod-active' : ''}`}
                title="Sharp (S)"
                onClick={practice.toggleSharp}
              >
                &#9839;
              </button>
              <button
                type="button"
                className={`md-mod-btn${practice.armedAccidental === 'b' ? ' md-mod-active' : ''}`}
                title="Flat (F)"
                onClick={practice.toggleFlat}
              >
                &#9837;
              </button>
              <button type="button" className="md-mod-btn" title="Backspace" onClick={practice.removeLastNote}>
                &#9003;
              </button>
              <button type="button" className="md-mod-btn" title="Clear measure" onClick={practice.clearActiveMeasure}>
                &#10005;
              </button>
            </div>

            <div className="md-actions">
              <button type="button" ref={submitBtnRef} disabled={!practice.submitEnabled} onClick={practice.checkAnswer}>
                Submit &#8594;
              </button>
              {practice.hasSubmitted && (
                <button type="button" onClick={practice.generateQuestion}>
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
