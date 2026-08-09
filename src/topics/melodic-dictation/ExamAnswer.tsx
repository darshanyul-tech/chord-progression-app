import { useState } from 'react';
import { VexStaffHost } from './VexStaffHost';
import { NotePalette, NotePaletteRestToggle } from '../../components/NotePalette';
import { EXAM_PALETTE_ENTRIES } from '../../components/notePaletteEntries';
import type { ExamDictationProps, ExamDictationResultProps } from '../../exam/types';
import { pitchedMeasuresEqual } from '../../lib/melody/grading';
import type { Clef, KeyDef, PitchedMeasure, PitchedNote } from '../../lib/melody/theory';
import { applyPlacement, defaultRestMeasure, type RestAdapter } from '../../lib/notation/gaps';
import { resolvePlacementBeat } from '../../lib/notation/placement';
import { getActiveDurations } from '../../lib/rhythm/generator';
import { gridStep, metricPulseBeats, type TimeSigInfo } from '../../lib/rhythm/time';

const melodyRestAdapter: RestAdapter<PitchedNote> = {
  beat: (n) => n.beat,
  duration: (n) => n.duration,
  isRest: (n) => n.rest,
  makeRest: (beat, duration) => ({ beat, duration, rest: true, midi: null }),
};

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
// needed in an exam context), kept in sync with it so the shared staff
// host's hover preview (which shows the whole resulting bar, not just the
// placed note — lib/notation/gaps.ts's applyPlacement) never shows a result
// this commit path wouldn't actually produce.
export function MelodicDictationAnswer({ question, answer, onAnswer, disabled }: ExamDictationProps) {
  const q = question as unknown as MelodicDictationQuestion;
  const [armedDuration, setArmedDuration] = useState(1);
  const [armedIsRest, setArmedIsRest] = useState(false);
  const [armedAccidental, setArmedAccidental] = useState<'' | '#' | 'b'>('');
  const pulse = metricPulseBeats(q.timeSig.beatValue, q.timeSig.beatsPerBar);
  const measures =
    (answer as PitchedMeasure[] | null) ?? Array.from({ length: q.numMeasures }, () => defaultRestMeasure(q.timeSig.measureBeats, pulse, melodyRestAdapter));
  const gridStepVal = gridStep(getActiveDurations(PALETTE_DURATIONS, false, q.timeSig.measureBeats));

  function placeNoteAt(measureIndex: number, rawBeat: number, midi: number) {
    if (disabled) return;
    const duration = armedDuration;
    const cap = q.timeSig.measureBeats;
    if (duration > cap + 0.001) return;
    const measure = measures[measureIndex];
    if (!measure) return;
    const beat = resolvePlacementBeat(rawBeat, duration, cap, gridStepVal);
    if (beat === null) return;
    const { notes } = applyPlacement(
      measure,
      { beat, duration, rest: armedIsRest, midi: armedIsRest ? null : midi },
      cap,
      pulse,
      melodyRestAdapter,
    );
    const next = measures.map((m, i) => (i === measureIndex ? notes : m));
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
          isTieActive={false}
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
        <button
          type="button"
          className="ghost"
          onClick={() => onAnswer(measures.map(() => defaultRestMeasure(q.timeSig.measureBeats, pulse, melodyRestAdapter)))}
        >
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
        isTieActive={false}
        onPlace={() => {}}
      />
    </div>
  );
}
