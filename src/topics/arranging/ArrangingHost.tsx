import '../../styles/arranging.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EMPTY_SCORE, useScoresStore } from '../../state/scores';
import { SessionScoreLine } from '../../components/SessionScoreLine';
import { StatusLine, type StatusKind } from '../../components/StatusLine';
import { SettingsDisclosure } from '../../components/SettingsDisclosure';
import { ChoiceGrid } from '../../components/ChoiceGrid';
import { getArrangingExercise } from './exercises';
import { useArrangingSettingsStore } from './settingsStores';
import { ArrangingSettings } from './ArrangingSettings';
import { VoicingStaffView } from './VoicingStaffView';
import { StackedPitchDropdowns } from './StackedPitchDropdowns';
import { useArrangingAudio } from './useArrangingAudio';
import type { ArrQuestion, PromptSpec } from './exerciseTypes';

const MAX_MC_GUESSES = 2;

function PromptView({ prompt }: { prompt: PromptSpec }) {
  const spelling = prompt.spelling ?? 'sharp';
  return (
    <div className="arr-prompt">
      {prompt.chordSymbol && <div className="arr-chord-symbol">{prompt.chordSymbol}</div>}
      {prompt.text && <p className="arr-prompt-text">{prompt.text}</p>}
      {prompt.staffPitches && (
        <div className="arr-staff-frame">
          <VoicingStaffView clef={prompt.clef ?? (Math.min(...prompt.staffPitches) < 55 ? 'bass' : 'treble')} spelling={spelling} columns={[prompt.staffPitches]} />
        </div>
      )}
      {prompt.melody && (
        <div className="arr-staff-frame">
          <VoicingStaffView clef="treble" spelling={spelling} columns={prompt.melody.map((m) => [m])} ariaLabel="Melodic fragment" />
        </div>
      )}
      {prompt.melody2 && (
        <div className="arr-staff-frame">
          <VoicingStaffView clef="treble" spelling={spelling} columns={prompt.melody2.map((m) => [m])} ariaLabel="Transformed fragment" />
        </div>
      )}
    </div>
  );
}

export function ArrangingHost({ exerciseId }: { exerciseId: string }) {
  const exercise = getArrangingExercise(exerciseId)!;
  const store = useArrangingSettingsStore(exerciseId);
  const settings = store();
  const settingsKey = JSON.stringify(settings);

  const recordAttempt = useScoresStore((s) => s.recordAttempt);
  const resetScoreInStore = useScoresStore((s) => s.resetScore);
  const score = useScoresStore((s) => s.scores[exerciseId] ?? EMPTY_SCORE);

  const audio = useArrangingAudio();

  const [question, setQuestion] = useState<ArrQuestion | null>(null);
  const [answered, setAnswered] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [statusKind, setStatusKind] = useState<StatusKind>('');
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [correctId, setCorrectId] = useState<string | null>(null);
  const [guesses, setGuesses] = useState(0);
  // multi
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  // order
  const [order, setOrder] = useState<string[]>([]);
  // stacked
  const [rows, setRows] = useState<(number | null)[]>([]);

  const startRound = useCallback(() => {
    const q = exercise.generate(settings);
    setQuestion(q);
    setAnswered(false);
    setStatusText(q ? '' : 'Enable at least one option in the settings above.');
    setStatusKind(q ? '' : 'warn');
    setWrongIds([]);
    setCorrectId(null);
    setGuesses(0);
    setMultiSelected([]);
    if (q?.kind === 'order') setOrder(q.items.map((i) => i.id));
    if (q?.kind === 'stacked') setRows([...q.prefill]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseId, settingsKey]);

  const startRef = useRef(startRound);
  startRef.current = startRound;
  useEffect(() => startRef.current(), [exerciseId, settingsKey]);

  function finalize(correct: boolean, firstAttempt: boolean, revealMsg: string) {
    setAnswered(true);
    recordAttempt(exerciseId, correct && firstAttempt);
    setStatusText(revealMsg);
    setStatusKind(correct ? '' : 'warn');
  }

  // ---- MC ----
  function submitMc(id: string) {
    if (!question || question.kind !== 'mc' || answered || wrongIds.includes(id)) return;
    const next = guesses + 1;
    setGuesses(next);
    const first = next === 1;
    if (question.answerIds.includes(id)) {
      setCorrectId(id);
      finalize(true, first, first ? 'Correct! Point added.' : `Correct — ${question.explanation}`);
      return;
    }
    setWrongIds((p) => [...p, id]);
    if (next >= MAX_MC_GUESSES) {
      setCorrectId(question.answerIds[0]!);
      finalize(false, false, question.explanation);
    } else {
      setStatusText('Not quite — one guess left.');
      setStatusKind('warn');
    }
  }

  // ---- multi ----
  function toggleMulti(id: string) {
    if (answered) return;
    setMultiSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }
  function submitMulti() {
    if (!question || question.kind !== 'multi' || answered) return;
    const a = [...multiSelected].sort().join(',');
    const b = [...question.correctIds].sort().join(',');
    const correct = a === b;
    finalize(correct, true, `${correct ? 'Correct. ' : 'Not the full set. '}${question.explanation}`);
  }

  // ---- order ----
  function moveItem(idx: number, dir: -1 | 1) {
    if (answered) return;
    setOrder((p) => {
      const next = [...p];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return p;
      [next[idx], next[j]] = [next[j]!, next[idx]!];
      return next;
    });
  }
  function submitOrder() {
    if (!question || question.kind !== 'order' || answered) return;
    const correct = order.join(',') === question.correctOrder.join(',');
    finalize(correct, true, `${correct ? 'Correct order. ' : 'Not quite. '}${question.explanation}`);
  }

  // ---- stacked ----
  function submitStacked() {
    if (!question || question.kind !== 'stacked' || answered) return;
    if (rows.some((r) => r == null)) return;
    const result = question.grade(rows as number[]);
    finalize(result.correct, true, result.message);
  }

  const canSubmitStacked = useMemo(
    () => question?.kind === 'stacked' && rows.length === question.voiceCount && rows.every((r) => r != null),
    [question, rows],
  );

  const itemLabel = (id: string) =>
    (question?.kind === 'order' ? question.items.find((i) => i.id === id)?.label : id) ?? id;

  return (
    <>
      <SettingsDisclosure>
        <ArrangingSettings exercise={exercise} store={store} />
      </SettingsDisclosure>

      <section className="card">
        <h2>{exercise.title}</h2>
        <p className="sub arr-instruction">{exercise.instruction}</p>

        {question ? <PromptView prompt={question.prompt} /> : null}

        {/* Audio */}
        {question && (
          <div className="buttons" style={{ marginTop: '0.5rem' }}>
            {audio.status !== 'ready' ? (
              <button type="button" onClick={audio.initAudio} disabled={audio.status === 'loading'}>
                Initialize Audio
              </button>
            ) : (
              <>
                {(question.kind === 'mc' || question.kind === 'multi') && question.play && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => audio.play(question.play!, question.kind === 'mc' ? question.playMode ?? 'block' : 'block')}
                  >
                    Play
                  </button>
                )}
                {question.kind === 'stacked' && (
                  <button type="button" className="secondary" onClick={() => audio.play(rows.filter((r): r is number => r != null))}>
                    Play my entry
                  </button>
                )}
                {answered && question.kind === 'multi' && question.playCorrected && (
                  <button type="button" className="secondary" onClick={() => audio.playComparison(question.play ?? [], question.playCorrected!)}>
                    Play corrected version
                  </button>
                )}
                {answered && question.kind === 'stacked' && (
                  <button type="button" className="secondary" onClick={() => audio.play(question.reveal)}>
                    Play answer
                  </button>
                )}
              </>
            )}
          </div>
        )}

        <StatusLine text={statusText} kind={statusKind} />

        {/* Inputs */}
        {question?.kind === 'mc' && (
          <ChoiceGrid
            choices={question.choices}
            wrongIds={wrongIds}
            correctId={correctId}
            onSelect={submitMc}
            disabledAll={answered}
            groupClassName="arr-choice-grid"
            choiceClassName="arr-choice"
            ariaLabel={`${exercise.title} answers`}
          />
        )}

        {question?.kind === 'multi' && (
          <div className="arr-multi" role="group" aria-label={`${exercise.title} answers`}>
            {question.choices.map((c) => (
              <label key={c.id} className={`arr-multi-item${answered && question.correctIds.includes(c.id) ? ' correct' : ''}`}>
                <input type="checkbox" checked={multiSelected.includes(c.id)} disabled={answered} onChange={() => toggleMulti(c.id)} /> {c.label}
              </label>
            ))}
          </div>
        )}

        {question?.kind === 'order' && (
          <ol className="arr-order" aria-label="Score order, top to bottom">
            {order.map((id, i) => (
              <li key={id} className="arr-order-item">
                <span>{itemLabel(id)}</span>
                <span className="arr-order-btns">
                  <button type="button" aria-label="Move up" disabled={answered || i === 0} onClick={() => moveItem(i, -1)}>▲</button>
                  <button type="button" aria-label="Move down" disabled={answered || i === order.length - 1} onClick={() => moveItem(i, 1)}>▼</button>
                </span>
              </li>
            ))}
          </ol>
        )}

        {question?.kind === 'stacked' && (
          <StackedPitchDropdowns
            voiceCount={question.voiceCount}
            spelling={question.spelling}
            value={rows}
            lockedRows={question.lockedRows}
            disabled={answered}
            onChange={setRows}
          />
        )}

        <SessionScoreLine className="arr-session-score" correct={score.correct} total={score.total} />

        <div className="buttons" style={{ marginTop: '0.6rem' }}>
          {question?.kind === 'multi' && !answered && <button type="button" onClick={submitMulti}>Submit</button>}
          {question?.kind === 'order' && !answered && <button type="button" onClick={submitOrder}>Submit</button>}
          {question?.kind === 'stacked' && !answered && <button type="button" disabled={!canSubmitStacked} onClick={submitStacked}>Submit</button>}
          {answered && <button type="button" onClick={startRound}>Next</button>}
          <button type="button" className="ghost" onClick={() => resetScoreInStore(exerciseId)}>Reset score</button>
        </div>
      </section>
    </>
  );
}
