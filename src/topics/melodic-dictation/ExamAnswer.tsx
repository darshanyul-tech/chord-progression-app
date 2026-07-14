import { useState } from 'react';
import { VexStaffHost } from './VexStaffHost';
import type { ExamDictationProps, ExamDictationResultProps } from '../../exam/types';
import { pitchedMeasuresEqual } from '../../lib/melody/grading';
import type { Clef, KeyDef, PitchedMeasure } from '../../lib/melody/theory';
import { getActiveDurations } from '../../lib/rhythm/generator';
import { gridStep, type TimeSigInfo } from '../../lib/rhythm/time';

export interface MelodicDictationQuestion {
  typeId: 'melodicDictation';
  key: KeyDef;
  clef: Clef;
  timeSig: TimeSigInfo;
  numMeasures: number;
  measures: PitchedMeasure[];
  tempo: number;
}

export const PALETTE_DURATIONS = [4, 2, 1, 0.5, 0.25, 1.5, 0.75];
const PALETTE_LABELS = ['1', '2', '3', '4', '5', '7', '8'];

// Ported per docs/06-exam-mode.md §B3 — lightweight local copy of
// usePractice.ts's placement logic (no settings/session-score coupling
// needed in an exam context).
export function MelodicDictationAnswer({ question, answer, onAnswer, disabled }: ExamDictationProps) {
  const q = question as unknown as MelodicDictationQuestion;
  const [armedDuration, setArmedDuration] = useState(1);
  const [armedIsRest, setArmedIsRest] = useState(false);
  const [armedAccidental, setArmedAccidental] = useState<'' | '#' | 'b'>('');
  const measures = (answer as PitchedMeasure[] | null) ?? Array.from({ length: q.numMeasures }, () => []);
  const gridStepVal = gridStep(getActiveDurations(PALETTE_DURATIONS, false, q.timeSig.measureBeats));

  function placeNoteAt(measureIndex: number, beat: number, midi: number) {
    if (disabled) return;
    const duration = armedDuration;
    const cap = q.timeSig.measureBeats;
    if (duration > cap + 0.001 || beat + duration > cap + 0.001) return;
    const end = beat + duration;
    const overlaps = (n: { beat: number; duration: number }) => beat < n.beat + n.duration - 0.001 && end > n.beat + 0.001;
    const next = measures.map((m, i) =>
      i === measureIndex
        ? [...m.filter((n) => !overlaps(n)), { beat, duration, rest: armedIsRest, midi: armedIsRest ? null : midi }]
        : m,
    );
    onAnswer(next);
  }

  return (
    <>
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem' }}>
        <VexStaffHost
          model={{
            key: q.key,
            clef: q.clef,
            timeSig: q.timeSig,
            numMeasures: q.numMeasures,
            measures,
            hasSubmitted: false,
            isCorrect: false,
            revealMeasures: null,
          }}
          gridStepVal={gridStepVal}
          armedDuration={armedDuration}
          armedAccidental={armedAccidental}
          onPlace={placeNoteAt}
        />
      </div>
      <div className="buttons" style={{ marginTop: '0.5rem' }}>
        {PALETTE_DURATIONS.map((d, i) => (
          <button
            key={d}
            type="button"
            className={armedDuration === d ? 'secondary' : 'ghost'}
            onClick={() => setArmedDuration(d)}
          >
            {PALETTE_LABELS[i]}
          </button>
        ))}
        <button type="button" className={armedIsRest ? 'secondary' : 'ghost'} onClick={() => setArmedIsRest((p) => !p)}>
          Rest
        </button>
        <button
          type="button"
          className={armedAccidental === '#' ? 'secondary' : 'ghost'}
          onClick={() => setArmedAccidental((p) => (p === '#' ? '' : '#'))}
        >
          &#9839;
        </button>
        <button
          type="button"
          className={armedAccidental === 'b' ? 'secondary' : 'ghost'}
          onClick={() => setArmedAccidental((p) => (p === 'b' ? '' : 'b'))}
        >
          &#9837;
        </button>
        <button type="button" className="ghost" onClick={() => onAnswer(measures.map(() => []))}>
          Clear all
        </button>
      </div>
    </>
  );
}

export function MelodicDictationResult({ question, answer }: ExamDictationResultProps) {
  const q = question as unknown as MelodicDictationQuestion;
  const userMeasures = (answer as PitchedMeasure[] | null) ?? Array.from({ length: q.numMeasures }, () => []);
  const isCorrect = pitchedMeasuresEqual(userMeasures, q.measures);
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem', marginTop: '0.5rem' }}>
      <VexStaffHost
        model={{
          key: q.key,
          clef: q.clef,
          timeSig: q.timeSig,
          numMeasures: q.numMeasures,
          measures: userMeasures,
          hasSubmitted: true,
          isCorrect,
          revealMeasures: isCorrect ? null : q.measures,
        }}
        gridStepVal={0.25}
        armedDuration={1}
        armedAccidental=""
        onPlace={() => {}}
      />
    </div>
  );
}
