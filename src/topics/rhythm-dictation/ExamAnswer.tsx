import { useState } from 'react';
import { RhythmStaffHost } from './RhythmStaffHost';
import { NotePalette, NotePaletteRestToggle } from '../../components/NotePalette';
import { EXAM_PALETTE_ENTRIES } from '../../components/notePaletteEntries';
import type { ExamDictationProps, ExamDictationResultProps } from '../../exam/types';
import { resolvePlacementBeat } from '../../lib/notation/placement';
import { getActiveDurations } from '../../lib/rhythm/generator';
import { durationFitsBar, gridStep, measuresEqual, type Measure, type TimeSigInfo } from '../../lib/rhythm/time';

export interface RhythmDictationQuestion {
  typeId: 'rhythmDictation';
  pattern: Measure[];
  timeSig: TimeSigInfo;
  numMeasures: number;
  tempo: number;
  sound: 'percussive' | 'instrumental' | 'melodic';
  emphasis: number;
  metroVolume: number;
}

const PALETTE_DURATIONS = EXAM_PALETTE_ENTRIES.map((e) => e.duration);

// Ported per docs/06-exam-mode.md §B3 — lightweight local copy of
// usePractice.ts's overlap-replace placement algorithm (no settings/session
// -score coupling needed in an exam context).
export function RhythmDictationAnswer({ question, answer, onAnswer, disabled }: ExamDictationProps) {
  const q = question as unknown as RhythmDictationQuestion;
  const [armedDuration, setArmedDuration] = useState(1);
  const [armedIsRest, setArmedIsRest] = useState(false);
  const measures = (answer as Measure[] | null) ?? Array.from({ length: q.numMeasures }, () => []);
  const gridStepVal = gridStep(getActiveDurations(PALETTE_DURATIONS, false, q.timeSig.measureBeats));

  function placeNoteAt(measureIndex: number, rawBeat: number, duration: number, isRest: boolean) {
    if (disabled) return;
    const cap = q.timeSig.measureBeats;
    if (!durationFitsBar(duration, cap)) return;
    const measure = measures[measureIndex] ?? [];
    // Same click resolver as practice mode (lib/notation/placement.ts) — the
    // staff host now reports a raw proportional beat from the real drawn
    // geometry, and this maps it to a direct hit or the nearest free slot.
    const resolved = resolvePlacementBeat(measure, rawBeat, duration, cap, gridStepVal);
    if (!resolved) return;
    const { beat } = resolved;
    const end = beat + duration;
    if (end > cap + 0.001) return;
    const overlaps = (n: { beat: number; duration: number }) => beat < n.beat + n.duration - 0.001 && end > n.beat + 0.001;
    const next = measures.map((m, i) =>
      i === measureIndex ? [...m.filter((n) => !overlaps(n)), { beat, duration, isRest }] : m,
    );
    onAnswer(next);
  }

  return (
    <>
      <div className="rhythm-card-wrap" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem' }}>
        <RhythmStaffHost
          model={{
            beatsPerBar: q.timeSig.beatsPerBar,
            beatValue: q.timeSig.beatValue,
            numMeasures: q.numMeasures,
            measures,
            hasSubmitted: false,
            measureResults: [],
            correctPattern: [],
            flashMeasure: null,
            playbackFraction: null,
            cursorMeasureIndex: 0,
            cursorBeat: null,
          }}
          gridStepVal={gridStepVal}
          armedDuration={armedDuration}
          armedIsRest={armedIsRest}
          isTieActive={false}
          onClick={(measureIndex, rawBeat) => placeNoteAt(measureIndex, rawBeat, armedDuration, armedIsRest)}
        />
      </div>
      <div className="note-palette-row" style={{ marginTop: '0.5rem' }}>
        <NotePalette entries={EXAM_PALETTE_ENTRIES} armedDuration={armedDuration} onArm={setArmedDuration} />
        <NotePaletteRestToggle active={armedIsRest} onToggle={() => setArmedIsRest((p) => !p)} />
        <button type="button" className="ghost" onClick={() => onAnswer(measures.map(() => []))}>
          Clear all
        </button>
      </div>
    </>
  );
}

export function RhythmDictationResult({ question, answer }: ExamDictationResultProps) {
  const q = question as unknown as RhythmDictationQuestion;
  const userMeasures = (answer as Measure[] | null) ?? Array.from({ length: q.numMeasures }, () => []);
  const measureResults = q.pattern.map((bar, i) => measuresEqual(userMeasures[i] ?? [], bar));
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem', marginTop: '0.5rem' }}>
      <RhythmStaffHost
        model={{
          beatsPerBar: q.timeSig.beatsPerBar,
          beatValue: q.timeSig.beatValue,
          numMeasures: q.numMeasures,
          measures: userMeasures,
          hasSubmitted: true,
          measureResults,
          correctPattern: q.pattern,
          flashMeasure: null,
          playbackFraction: null,
          cursorMeasureIndex: 0,
          cursorBeat: null,
        }}
        // Read-only result view (hasSubmitted: true above) never shows a
        // hover ghost, so these four are inert placeholders.
        gridStepVal={0.25}
        armedDuration={1}
        armedIsRest={false}
        isTieActive={false}
        onClick={() => {}}
      />
    </div>
  );
}
