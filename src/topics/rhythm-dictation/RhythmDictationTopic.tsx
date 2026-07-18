import { useEffect, useRef, useState } from 'react';
import '../../styles/topics/rhythm-dictation.css';
import { audio } from '../../lib/audio/engine';
import { TRIPLET_DURS } from '../../lib/rhythm/generator';
import { durationClose, durationFitsBar } from '../../lib/rhythm/time';
import { useIsActiveTopic } from '../../hooks/useIsActiveTopic';
import { SessionScoreLine } from '../../components/SessionScoreLine';
import { useRhythmDictationSettings } from '../../state/settings/rhythm-dictation';
import { NoteGlyphIcon, RestGlyphIcon } from './PaletteGlyph';
import { RhythmSettings } from './Settings';
import { RhythmStaffHost } from './RhythmStaffHost';
import { useRhythmPractice } from './usePractice';

// Base values only — dotted variants are reached by arming a base value and
// toggling Dot, exactly as Melodic Dictation does (its palette comment
// explains the composition rationale); the old dedicated dotted-quarter/
// dotted-eighth/dotted-half buttons are gone with them. Triplet entries stay
// rhythm-specific, shown only when triplets are enabled in Settings.
const PALETTE: { duration: number; label: string; title: string; size: 'whole' | 'sm' | 'lg' }[] = [
  { duration: 4, label: '1', title: 'Whole note (1)', size: 'whole' },
  { duration: 2, label: '2', title: 'Half note (2)', size: 'sm' },
  { duration: 1, label: '3', title: 'Quarter note (3)', size: 'sm' },
  { duration: 0.5, label: '4', title: 'Eighth note (4)', size: 'lg' },
  { duration: 0.25, label: '5', title: 'Sixteenth note (5)', size: 'lg' },
];
const TRIPLET_EIGHTH = { duration: 0.333, label: '6', title: 'Triplet eighth (6)', size: 'lg' as const };
const TRIPLET_QUARTER = { duration: 0.667, label: 'TQ', title: 'Triplet quarter', size: 'sm' as const };

const KEY_TO_DURATION: Record<string, number> = {
  '1': 4, '2': 2, '3': 1, '4': 0.5, '5': 0.25, '6': 0.333,
};

export function RhythmDictationTopic() {
  const settings = useRhythmDictationSettings();
  const practice = useRhythmPractice(settings);
  const isActive = useIsActiveTopic('rhythm-dictation');
  const submitBtnRef = useRef<HTMLButtonElement>(null);
  const [paletteFlash, setPaletteFlash] = useState(false);
  const paletteFlashTimerRef = useRef<number | null>(null);

  function flashPalette() {
    setPaletteFlash(true);
    if (paletteFlashTimerRef.current !== null) clearTimeout(paletteFlashTimerRef.current);
    paletteFlashTimerRef.current = window.setTimeout(() => setPaletteFlash(false), 280);
  }

  useEffect(() => () => {
    if (paletteFlashTimerRef.current !== null) clearTimeout(paletteFlashTimerRef.current);
  }, []);

  useEffect(() => {
    if (!isActive) return;
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT') return;

      if (Object.prototype.hasOwnProperty.call(KEY_TO_DURATION, e.key)) {
        const dur = KEY_TO_DURATION[e.key]!;
        const isTriplet = TRIPLET_DURS.some((td) => durationClose(td, dur));
        if (isTriplet && !settings.triplets) {
          flashPalette();
          return;
        }
        practice.armDuration(dur);
        return;
      }
      switch (e.key) {
        case 'r': case 'R': practice.toggleRest(); break;
        case 'd': case 'D': practice.toggleDot(); break;
        case 'Backspace': e.preventDefault(); practice.removeLastNote(); break;
        case 'Delete': practice.clearActiveMeasure(); break;
        case ' ': e.preventDefault(); practice.startPlayback(); break;
        case 'Enter': if (practice.submitEnabled) practice.checkAnswer(); break;
        case 'ArrowRight':
          practice.setActiveMeasureIndex(Math.min(practice.activeMeasureIndex + 1, practice.numMeasures - 1));
          break;
        case 'ArrowLeft':
          practice.setActiveMeasureIndex(Math.max(practice.activeMeasureIndex - 1, 0));
          break;
        default:
          break;
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, practice.activeMeasureIndex, practice.numMeasures, practice.submitEnabled, settings.triplets]);

  function handleStaffClick(measureIndex: number, rawBeat: number) {
    practice.setActiveMeasureIndex(measureIndex);
    if (practice.hasSubmitted) return;
    practice.placeNoteAt(measureIndex, rawBeat, practice.armedDuration, practice.armedIsRest);
  }

  const paletteButtons = settings.triplets
    ? [...PALETTE, TRIPLET_EIGHTH, TRIPLET_QUARTER].sort((a, b) => a.duration - b.duration)
    : PALETTE;
  const ready = practice.audioStatus === 'ready';

  return (
    <>
      <RhythmSettings />

      <section className="card">
        <div className="buttons" style={{ marginTop: '0.1rem' }}>
          {!ready && (
            <button type="button" onClick={() => audio.initAudio()} disabled={practice.audioStatus === 'loading'}>
              Initialize Audio
              <span className="loadbadge">{practice.audioStatus === 'loading' ? ' (loading samples...)' : ''}</span>
            </button>
          )}
          <button type="button" onClick={practice.generateQuestion}>
            New question
          </button>
          <button type="button" className="secondary" onClick={practice.previewPattern} disabled={!ready}>
            Preview pattern
          </button>
          <button type="button" className="ghost" onClick={practice.resetScore}>
            Reset score
          </button>
        </div>
        <SessionScoreLine
          className="rd-session-score"
          correct={practice.score.correct}
          total={practice.score.total}
        />
      </section>

      <section className="card rhythm-card-wrap">
        <div id="rhythm-dictation-app" className={isActive ? '' : undefined}>
          <header className="rd-header">
            <p className="rd-prompt">
              {ready ? 'Notate the played rhythm.' : 'Press Initialize Audio above to hear questions.'}
            </p>
          </header>

          <div className="rd-staff-frame">
            <RhythmStaffHost
              model={{
                beatsPerBar: practice.timeSig.beatsPerBar,
                beatValue: practice.timeSig.beatValue,
                numMeasures: practice.numMeasures,
                measures: practice.userMeasures,
                hasSubmitted: practice.hasSubmitted,
                measureResults: practice.measureResults,
                correctPattern: practice.correctPattern,
                flashMeasure: practice.flashMeasure,
                playbackFraction: practice.playbackFraction,
                cursorMeasureIndex: practice.activeMeasureIndex,
                cursorBeat: practice.cursorBeat,
              }}
              gridStepVal={practice.gridStepVal}
              armedDuration={practice.effectiveDuration(practice.armedDuration)}
              armedIsRest={practice.armedIsRest}
              onClick={handleStaffClick}
              onCursorMove={practice.moveCursor}
              onPlaceAtCursor={practice.placeAtCursor}
              onCursorFocus={practice.focusCursor}
              onCursorBlur={practice.blurCursor}
            />
            <p className="rd-capacity-hint" aria-live="polite">
              {practice.capacityHint}
            </p>
          </div>

          <div className="rd-bottom-bar">
            <div className={`rd-palette${paletteFlash ? ' rd-palette-flash' : ''}`}>
              {paletteButtons.map((btn) => {
                const isTriplet = TRIPLET_DURS.some((td) => durationClose(td, btn.duration));
                // Gate and preview the *effective* (dot-adjusted) duration —
                // arming "Quarter" while Dot is on means the actual value
                // being placed is a dotted quarter, so that's what needs to
                // be checked against settings/bar-fit and shown in the icon
                // (same composition as Melodic Dictation's palette).
                const effective = practice.effectiveDuration(btn.duration);
                const allowed =
                  practice.activeDurations.some((d) => durationClose(d, effective)) || (isTriplet && settings.triplets);
                const fits = durationFitsBar(effective, practice.timeSig.measureBeats);
                const disabled = !allowed || !fits;
                const armed = durationClose(practice.armedDuration, btn.duration);
                const effectiveTitle =
                  practice.isDotActive && !isTriplet
                    ? btn.title.replace(/^(\S+)/, (word) => `Dotted ${word.toLowerCase()}`)
                    : btn.title;
                // Explain *why* a duration is greyed out, mirroring Melodic
                // Dictation: unchecked in settings vs. checked but too big
                // for the current bar.
                let title = effectiveTitle;
                if (disabled) {
                  const checkedInSettings = settings.durations.some((d) => durationClose(d, effective));
                  if (!checkedInSettings && !isTriplet) {
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
                    className={`rd-note-btn rd-note-btn-${btn.size}${armed ? ' rd-btn-armed' : ''}${disabled ? ' rd-dur-disabled' : ''}`}
                    title={title}
                    aria-pressed={armed}
                    onClick={() => practice.armDuration(btn.duration)}
                  >
                    <NoteGlyphIcon duration={effective} />
                    <span>{btn.label}</span>
                  </button>
                );
              })}
              <div className="rd-palette-sep" />
              <button
                type="button"
                className={`rd-mod-btn rd-rest-btn${practice.armedIsRest ? ' rd-mod-active' : ''}`}
                title="Rest mode (R)"
                aria-pressed={practice.armedIsRest}
                onClick={practice.toggleRest}
              >
                <RestGlyphIcon />
              </button>
              <button
                type="button"
                className={`rd-mod-btn rd-mod-btn-lg${practice.isDotActive ? ' rd-mod-active' : ''}`}
                title="Dot (D)"
                aria-pressed={practice.isDotActive}
                onClick={practice.toggleDot}
              >
                &#183;
              </button>
              <button type="button" className="rd-mod-btn" title="Backspace" onClick={practice.removeLastNote}>
                &#9003;
              </button>
              <button type="button" className="rd-mod-btn" title="Clear measure" onClick={practice.clearActiveMeasure}>
                &#10005;
              </button>
            </div>

            <div className="rd-actions">
              <div id="rd-countin-dots" aria-hidden="true">
                <span className={practice.countinLit >= 1 ? 'rd-dot-lit' : ''} />
                <span className={practice.countinLit >= 2 ? 'rd-dot-lit' : ''} />
                <span className={practice.countinLit >= 3 ? 'rd-dot-lit' : ''} />
                <span className={practice.countinLit >= 4 ? 'rd-dot-lit' : ''} />
              </div>
              <button type="button" className="rd-transport-btn" title="Replay" onClick={practice.replay} disabled={!ready}>
                &#8634;
              </button>
              <button type="button" className="rd-transport-btn" title={practice.isPlaying ? 'Stop' : 'Play'} onClick={practice.startPlayback} disabled={!ready}>
                {practice.isPlaying ? '■' : '▶'}
              </button>
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
