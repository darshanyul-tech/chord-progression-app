import { useEffect, useRef, useState } from 'react';
import '../../styles/topics/rhythm-dictation.css';
import { audio } from '../../lib/audio/engine';
import { TRIPLET_DURS } from '../../lib/rhythm/generator';
import { beatFromClickX, durationClose, durationFitsBar } from '../../lib/rhythm/time';
import { useIsActiveTopic } from '../../hooks/useIsActiveTopic';
import { SessionScoreLine } from '../../components/SessionScoreLine';
import { useRhythmDictationSettings } from '../../state/settings/rhythm-dictation';
import { NoteGlyphIcon, RestGlyphIcon } from './PaletteGlyph';
import { RhythmSettings } from './Settings';
import { RhythmStaffHost } from './RhythmStaffHost';
import { useRhythmPractice } from './usePractice';

const PALETTE: { duration: number; label: string; title: string }[] = [
  { duration: 4, label: '1', title: 'Whole note (1)' },
  { duration: 2, label: '2', title: 'Half note (2)' },
  { duration: 1, label: '3', title: 'Quarter note (3)' },
  { duration: 0.5, label: '4', title: 'Eighth note (4)' },
  { duration: 0.25, label: '5', title: 'Sixteenth note (5)' },
  { duration: 0.333, label: '6', title: 'Triplet eighth (6)' },
  { duration: 1.5, label: '7', title: 'Dotted quarter (7)' },
  { duration: 0.75, label: '8', title: 'Dotted eighth (8)' },
  { duration: 3, label: 'H.', title: 'Dotted half' },
];
const TRIPLET_QUARTER = { duration: 0.667, label: 'TQ', title: 'Triplet quarter' };

const KEY_TO_DURATION: Record<string, number> = {
  '1': 4, '2': 2, '3': 1, '4': 0.5, '5': 0.25, '6': 0.333, '7': 1.5, '8': 0.75,
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

  function handleStaffClick(measureIndex: number, clickX: number) {
    practice.setActiveMeasureIndex(measureIndex);
    if (practice.hasSubmitted || !practice.armedDuration) return;
    const dur = practice.effectiveDuration(practice.armedDuration);
    const beat = beatFromClickX(clickX, measureIndex, dur, practice.numMeasures, practice.timeSig.measureBeats, practice.gridStepVal);
    practice.placeNoteAt(measureIndex, beat, practice.armedDuration, practice.armedIsRest);
  }

  const paletteButtons = settings.triplets ? [...PALETTE, TRIPLET_QUARTER].sort((a, b) => a.duration - b.duration) : PALETTE;
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
            <div className="rd-header-right">
              <span id="rd-score-inline">
                {practice.score.correct} / {practice.score.total}
              </span>
            </div>
          </header>

          <div className="rd-staff-wrap">
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
                }}
                onClick={handleStaffClick}
              />
            </div>
            <p className="rd-capacity-hint" aria-live="polite">
              {practice.capacityHint}
            </p>
          </div>

          <div className="rd-bottom-bar">
            <div className={`rd-palette${paletteFlash ? ' rd-palette-flash' : ''}`}>
              {paletteButtons.map((btn) => {
                const isTriplet = TRIPLET_DURS.some((td) => durationClose(td, btn.duration));
                if (isTriplet && !settings.triplets) return null;
                const allowed =
                  practice.activeDurations.some((d) => durationClose(d, btn.duration)) || (isTriplet && settings.triplets);
                const fits = durationFitsBar(practice.effectiveDuration(btn.duration), practice.timeSig.measureBeats);
                const disabled = !allowed || !fits;
                const armed = durationClose(practice.armedDuration, btn.duration);
                return (
                  <button
                    key={btn.duration}
                    type="button"
                    className={`rd-note-btn${armed ? ' rd-btn-armed' : ''}${disabled ? ' rd-dur-disabled' : ''}`}
                    title={btn.title}
                    onClick={() => practice.armDuration(btn.duration)}
                  >
                    <NoteGlyphIcon duration={btn.duration} />
                    <span>{btn.label}</span>
                  </button>
                );
              })}
              <div className="rd-palette-sep" />
              <button
                type="button"
                className={`rd-mod-btn rd-rest-btn${practice.armedIsRest ? ' rd-mod-active' : ''}`}
                title="Rest mode (R)"
                onClick={practice.toggleRest}
              >
                <RestGlyphIcon />
              </button>
              <button
                type="button"
                className={`rd-mod-btn${practice.isDotActive ? ' rd-mod-active' : ''}`}
                title="Dot (D)"
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
