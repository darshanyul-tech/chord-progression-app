import { useState } from 'react';
import { VexStaffHost } from './VexStaffHost';
import { NotePalette, NotePaletteRestToggle } from '../../components/NotePalette';
import { EXAM_PALETTE_ENTRIES } from '../../components/notePaletteEntries';
import type { ExamDictationProps, ExamDictationResultProps } from '../../exam/types';
import { pitchedMeasuresEqual } from '../../lib/melody/grading';
import type { Clef, KeyDef, PitchedMeasure } from '../../lib/melody/theory';
import { resolvePlacementBeat } from '../../lib/notation/placement';
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

const PALETTE_DURATIONS = EXAM_PALETTE_ENTRIES.map((e) => e.duration);

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

  // Mirrors usePractice.ts's placeNoteAt resolution (docs/12-melodic-
  // dictation-fixes.md MD-3): a raw click-beat estimate resolves to either a
  // direct hit on an existing note (replace — clears whatever the new,
  // possibly-larger duration now spans, since clicking squarely on a note is
  // a deliberate swap) or the nearest free slot for the armed duration (a
  // gap click, which never overlaps anything by construction).
  function placeNoteAt(measureIndex: number, rawBeat: number, midi: number) {
    if (disabled) return;
    const duration = armedDuration;
    const cap = q.timeSig.measureBeats;
    if (duration > cap + 0.001) return;
    const measure = measures[measureIndex];
    if (!measure) return;
    const resolved = resolvePlacementBeat(measure, rawBeat, duration, cap, gridStepVal);
    if (!resolved) return;
    const { beat, isReplace } = resolved;
    const end = beat + duration;
    if (isReplace && end > cap + 0.001) return;
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
            flashMeasure: null,
            playbackFraction: null,
            cursorMeasureIndex: 0,
            cursorBeat: null,
            cursorMidi: null,
          }}
          gridStepVal={gridStepVal}
          armedDuration={armedDuration}
          armedIsRest={armedIsRest}
          armedAccidental={armedAccidental}
          onPlace={placeNoteAt}
        />
      </div>
      <div className="note-palette-row" style={{ marginTop: '0.5rem' }}>
        <NotePalette entries={EXAM_PALETTE_ENTRIES} armedDuration={armedDuration} onArm={setArmedDuration} />
        <NotePaletteRestToggle active={armedIsRest} onToggle={() => setArmedIsRest((p) => !p)} />
        <button
          type="button"
          className={armedAccidental === '#' ? 'secondary' : 'ghost'}
          title="Sharp"
          onClick={() => setArmedAccidental((p) => (p === '#' ? '' : '#'))}
        >
          &#9839;
        </button>
        <button
          type="button"
          className={armedAccidental === 'b' ? 'secondary' : 'ghost'}
          title="Flat"
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
          flashMeasure: null,
          playbackFraction: null,
          cursorMeasureIndex: 0,
          cursorBeat: null,
          cursorMidi: null,
        }}
        gridStepVal={0.25}
        armedDuration={1}
        armedIsRest={false}
        armedAccidental=""
        onPlace={() => {}}
      />
    </div>
  );
}
