import { useState } from 'react';
import { RhythmStaffHost } from './RhythmStaffHost';
import type { ExamDictationProps, ExamDictationResultProps } from '../../exam/types';
import { getActiveDurations } from '../../lib/rhythm/generator';
import { beatFromClickX, durationFitsBar, gridStep, measuresEqual, type Measure, type TimeSigInfo } from '../../lib/rhythm/time';

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

export const PALETTE_DURATIONS = [4, 2, 1, 0.5, 0.25, 1.5, 0.75];
const PALETTE_LABELS = ['1', '2', '3', '4', '5', '7', '8'];

// Ported per docs/06-exam-mode.md §B3 — lightweight local copy of
// usePractice.ts's overlap-replace placement algorithm (no settings/session
// -score coupling needed in an exam context).
export function RhythmDictationAnswer({ question, answer, onAnswer, disabled }: ExamDictationProps) {
  const q = question as unknown as RhythmDictationQuestion;
  const [armedDuration, setArmedDuration] = useState(1);
  const [armedIsRest, setArmedIsRest] = useState(false);
  const measures = (answer as Measure[] | null) ?? Array.from({ length: q.numMeasures }, () => []);
  const gridStepVal = gridStep(getActiveDurations(PALETTE_DURATIONS, false, q.timeSig.measureBeats));

  function placeNoteAt(measureIndex: number, beat: number, duration: number, isRest: boolean) {
    if (disabled) return;
    const cap = q.timeSig.measureBeats;
    if (!durationFitsBar(duration, cap) || beat + duration > cap + 0.001) return;
    const end = beat + duration;
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
          }}
          onClick={(measureIndex, clickX) => {
            const beat = beatFromClickX(clickX, measureIndex, armedDuration, q.numMeasures, q.timeSig.measureBeats, gridStepVal);
            placeNoteAt(measureIndex, beat, armedDuration, armedIsRest);
          }}
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
        }}
        onClick={() => {}}
      />
    </div>
  );
}
