import { useEffect, useRef } from 'react';
import '../../styles/topics/melodic-dictation.css';
import type { NoteSpelling } from '../../lib/melody/theory';
import { durationClose, durationFitsBar } from '../../lib/rhythm/time';
import { useIsActiveTopic } from '../../hooks/useIsActiveTopic';
import { SessionScoreLine } from '../../components/SessionScoreLine';
import { NoteGlyphIcon, RestGlyphIcon } from '../rhythm-dictation/PaletteGlyph';
import { useMelodicDictationSettings } from '../../state/settings/melodic-dictation';
import { MelodicSettings } from './Settings';
import { VexStaffHost } from './VexStaffHost';
import { useMelodicPractice } from './usePractice';

// Base values only — dotted variants are reached by arming a base value and
// toggling Dot (below), not via separate dedicated buttons. A duration's
// dotted form is still gated by the same settings.durations list (e.g. a
// dotted quarter needs 1.5 checked under Note & rest values), just resolved
// through effectiveDuration() instead of a hardcoded second palette entry —
// so the composition works for every base value, not just quarter/eighth.
const PALETTE: { duration: number; label: string; title: string; size: 'whole' | 'sm' | 'lg' }[] = [
  { duration: 4, label: '1', title: 'Whole note (1)', size: 'whole' },
  { duration: 2, label: '2', title: 'Half note (2)', size: 'sm' },
  { duration: 1, label: '3', title: 'Quarter note (3)', size: 'sm' },
  { duration: 0.5, label: '4', title: 'Eighth note (4)', size: 'lg' },
  { duration: 0.25, label: '5', title: 'Sixteenth note (5)', size: 'lg' },
];

const KEY_TO_DURATION: Record<string, number> = {
  '1': 4, '2': 2, '3': 1, '4': 0.5, '5': 0.25,
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
        case 't':
        case 'T':
          practice.toggleTie();
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

  function handlePlace(measureIndex: number, beat: number, midi: number, spelling?: NoteSpelling) {
    practice.setActiveMeasureIndex(measureIndex);
    if (practice.hasSubmitted) return;
    practice.placeNoteAt(
      measureIndex,
      beat,
      practice.armedDuration,
      practice.armedIsRest,
      practice.armedIsRest ? null : midi,
      practice.armedIsRest ? undefined : spelling,
    );
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
                flashMeasure: practice.flashMeasure,
                playbackFraction: practice.playbackFraction,
                cursorMeasureIndex: practice.activeMeasureIndex,
                cursorBeat: practice.cursorBeat,
                cursorMidi: practice.cursorMidi,
              }}
              gridStepVal={practice.gridStepVal}
              armedDuration={practice.effectiveDuration(practice.armedDuration)}
              armedIsRest={practice.armedIsRest}
              armedAccidental={practice.armedAccidental}
              isTieActive={practice.isTieActive}
              onPlace={handlePlace}
              onCursorMoveBeat={practice.moveCursorBeat}
              onCursorMovePitch={practice.moveCursorPitch}
              onPlaceAtCursor={practice.placeAtCursor}
              onCursorFocus={practice.focusCursor}
              onCursorBlur={practice.blurCursor}
            />
            <p className="md-capacity-hint" aria-live="polite">
              {practice.capacityHint}
            </p>
          </div>

          <div className="md-bottom-bar">
            <div className="md-palette">
              {PALETTE.map((btn) => {
                // Gate and preview the *effective* (dot-adjusted) duration —
                // arming "Quarter" while Dot is on means the actual value
                // being placed is a dotted quarter, so that's what needs to
                // be checked against settings/bar-fit and shown in the icon.
                const effective = practice.effectiveDuration(btn.duration);
                const allowed = practice.activeDurations.some((d) => durationClose(d, effective));
                const fits = durationFitsBar(effective, practice.timeSig.measureBeats);
                const disabled = !allowed || !fits;
                const armed = durationClose(practice.armedDuration, btn.duration);
                const effectiveTitle = practice.isDotActive
                  ? btn.title.replace(/^(\S+)/, (word) => `Dotted ${word.toLowerCase()}`)
                  : btn.title;
                // Explain *why* a duration is greyed out — a bare disabled
                // button gives no hint that e.g. a whole note simply can't
                // fit the current question's time signature. activeDurations
                // is already bar-fit-filtered (getActiveDurations), so it
                // can't tell "unchecked in settings" apart from "checked but
                // too big for this bar" — check the raw settings for that.
                let title = effectiveTitle;
                if (disabled) {
                  const checkedInSettings = settings.durations.some((d) => durationClose(d, effective));
                  if (!checkedInSettings) {
                    title = `${effectiveTitle} — not enabled in Note & rest values above`;
                  } else {
                    const sigLabel = `${practice.timeSig.beatsPerBar}/${practice.timeSig.beatValue}`;
                    title = `${effectiveTitle} — doesn't fit this ${sigLabel} bar`;
                  }
                }
                return (
                  <button
                    key={btn.duration}
                    type="button"
                    className={`md-note-btn md-note-btn-${btn.size}${armed ? ' md-btn-armed' : ''}${disabled ? ' md-dur-disabled' : ''}`}
                    title={title}
                    aria-pressed={armed}
                    onClick={() => practice.armDuration(btn.duration)}
                  >
                    <NoteGlyphIcon duration={effective} />
                    <span>{btn.label}</span>
                  </button>
                );
              })}
              <div className="md-palette-sep" />
              <button
                type="button"
                className={`md-mod-btn md-rest-btn${practice.armedIsRest ? ' md-mod-active' : ''}`}
                title="Rest mode (R)"
                aria-pressed={practice.armedIsRest}
                onClick={practice.toggleRest}
              >
                <RestGlyphIcon />
              </button>
              <button
                type="button"
                className={`md-mod-btn md-mod-btn-lg${practice.isDotActive ? ' md-mod-active' : ''}`}
                title="Dot (D)"
                aria-pressed={practice.isDotActive}
                onClick={practice.toggleDot}
              >
                &#183;
              </button>
              <button
                type="button"
                className={`md-mod-btn md-mod-btn-lg${practice.isTieActive ? ' md-mod-active' : ''}`}
                title="Tie (T)"
                aria-pressed={practice.isTieActive}
                onClick={practice.toggleTie}
              >
                &#8995;
              </button>
              <button
                type="button"
                className={`md-mod-btn md-mod-btn-lg${practice.armedAccidental === '#' ? ' md-mod-active' : ''}`}
                title="Sharp (S)"
                aria-pressed={practice.armedAccidental === '#'}
                onClick={practice.toggleSharp}
              >
                &#9839;
              </button>
              <button
                type="button"
                className={`md-mod-btn md-mod-btn-lg${practice.armedAccidental === 'b' ? ' md-mod-active' : ''}`}
                title="Flat (F)"
                aria-pressed={practice.armedAccidental === 'b'}
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
