import '../../styles/topics/chord-progressions.css';
import { StatusLine } from '../../components/StatusLine';
import {
  chordDisplay,
  chordSymbol,
  extensionRevealLabel,
  familyLabel,
  inversionLabel,
  qualityParts,
  tonicQualityForSettings,
  type ProgChord,
} from '../../lib/progression/theory';
import { useProgressionSettings } from '../../state/settings/chord-progressions';
import { GuessRows } from './GuessRows';
import { ProgressionSettings } from './Settings';
import { useProgressionPractice } from './usePractice';

function barLabelParts(ch: ProgChord, showInversion: boolean) {
  return (
    <>
      <span className="bar-roman">{ch.roman}</span>
      <span className="bar-symbol">{chordDisplay(ch)}</span>
      <span className="bar-meta">
        {familyLabel(ch.family)} &middot; {extensionRevealLabel(ch.ext)}
      </span>
      {showInversion && ch.inversion ? <span className="bar-meta">{inversionLabel(ch.inversion)}</span> : null}
    </>
  );
}

function loadBadgeFor(status: string): string {
  if (status === 'loading') return ' (loading samples...)';
  if (status === 'ready') return ' (ready)';
  return '';
}

export function ProgressionTopic() {
  const settings = useProgressionSettings();
  const setSettingsState = useProgressionSettings.setState;
  const practice = useProgressionPractice(settings);
  const s = practice.resolvedSettings;
  const ready = practice.audioStatus === 'ready';

  const tonicRefChord: ProgChord | null = s.tonicFirst
    ? (() => {
        const quality = tonicQualityForSettings(s);
        const parts = qualityParts(quality);
        return {
          degree: 1,
          fn: 'tonic',
          rootPc: s.keyPc,
          rootName: s.key,
          quality,
          rootDegree: 1,
          family: parts.family,
          ext: parts.ext,
          symbol: chordSymbol(s.key, quality),
          roman: s.scale.tonicRoman,
          inversion: 0,
          secondary: false,
        };
      })()
    : null;

  return (
    <>
      <ProgressionSettings />

      <section className="card">
        <h2>Session</h2>
        <div className="buttons">
          {!ready && (
            <button type="button" onClick={practice.init} disabled={practice.audioStatus === 'loading'}>
              Initialize Audio<span className="loadbadge">{loadBadgeFor(practice.audioStatus)}</span>
            </button>
          )}
          <button type="button" className="secondary" onClick={practice.generate}>
            Generate
          </button>
          {ready && (
            <button type="button" onClick={practice.play}>
              Play
            </button>
          )}
          <button type="button" className="ghost" onClick={practice.stop}>
            Stop
          </button>
          <button type="button" className="secondary" onClick={practice.reveal}>
            Reveal Answer
          </button>
          <label className="toggle-switch" title="Play the chords you set in Your Guess instead of a generated progression">
            <span className="toggle-label">Custom progression</span>
            <input
              type="checkbox"
              checked={settings.customMode}
              onChange={(e) => setSettingsState({ customMode: e.target.checked })}
            />
            <span className="toggle-slider" aria-hidden="true" />
          </label>
          <button type="button" onClick={practice.next}>
            Next
          </button>
        </div>
        <StatusLine text={practice.statusText} kind={practice.statusKind} />
        <div className="bars">
          {tonicRefChord && (
            <div className={`bar tonic-ref${practice.activeBar === 'ref' ? ' active' : ''}`}>
              <span className="num">ref</span>
              {practice.revealed ? barLabelParts(tonicRefChord, false) : s.scale.tonicRoman}
            </div>
          )}
          {practice.progression.map((ch, i) => (
            <div className={`bar${practice.activeBar === i ? ' active' : ''}`} key={i}>
              <span className="num">{i + 1}</span>
              {practice.revealed ? barLabelParts(ch, s.inversions) : '?'}
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Your Guess</h2>
        <p className="score">{practice.scoreLine}</p>
        <GuessRows
          rows={practice.guessRows}
          results={practice.results}
          settings={s}
          inversionOptionsFor={practice.inversionOptionsFor}
          onChange={practice.updateGuessRow}
        />
        <div className="buttons" style={{ marginTop: '0.8rem' }}>
          <button type="button" onClick={practice.check}>
            Check Answers
          </button>
          <button type="button" className="secondary" onClick={practice.playSelection}>
            Play your selection
          </button>
          <button type="button" className="ghost" onClick={practice.clearGuesses}>
            Clear
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Session score</h2>
        <div className="session-scores">
          <div className="session-score-row">
            <span className="session-score-label">Overall (all fields)</span>
            <span className="session-score-value">
              {practice.stats.overall.correct} / {practice.stats.overall.total}
            </span>
          </div>
          <div className="session-score-row">
            <span className="session-score-label">Function (roman / degree)</span>
            <span className="session-score-value">
              {practice.stats.function.correct} / {practice.stats.function.total}
            </span>
          </div>
          <div className="session-score-row">
            <span className="session-score-label">Tonality (major, minor, etc.)</span>
            <span className="session-score-value">
              {practice.stats.tonality.correct} / {practice.stats.tonality.total}
            </span>
          </div>
        </div>
        <div className="help">Totals accumulate each time you use Check Answers until you reset.</div>
        <div className="buttons" style={{ marginTop: '0.65rem' }}>
          <button type="button" className="ghost" onClick={practice.resetScore}>
            Reset score
          </button>
        </div>
      </section>
    </>
  );
}
