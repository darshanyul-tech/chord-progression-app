import type { SoundType } from '../audio/percussion';
import { fillMeasure, getActiveDurations } from '../rhythm/generator';
import { durationClose, gridStep, metricPulseBeats, metricPulseCount, parseTimeSig, type Measure, type TimeSigInfo } from '../rhythm/time';

// New topic (docs/05-topics/04-meter-recognition.md) — reuses the ported
// rhythm-dictation generator/playback engine (D12 reuse mandate) rather than
// building any new generation machinery.

export const METER_SIGNATURES = ['2/4', '3/4', '4/4', '5/4', '3/8', '6/8', '9/8', '12/8'];

// Fixed internal difficulty (§3.2): the meter must be carried by grouping,
// not obscured by rhythmic noise — durations/rests/syncopation/triplets are
// not user-configurable for this topic.
const FIXED_DURATIONS = [1, 0.5, 1.5, 2];
const MIN_ENABLED_SIGNATURES = 2;
const MAX_PULSE_ONSET_ATTEMPTS = 8;

export type BeatEmphasisMode = 'emphasized' | 'neutral';
export const EMPHASIS_VALUES: Record<BeatEmphasisMode, number> = { emphasized: 70, neutral: 0 };

export const RECOGNITION_MAX_GUESSES = 3;
export const RECOGNITION_AUTO_ADVANCE_MS = 450;

export interface MeterRecognitionSettings extends Record<string, unknown> {
  enabledSignatures: string[];
  tempo: number;
  sound: SoundType;
  emphasis: BeatEmphasisMode;
  measures: number;
  autoAdvance: boolean;
}

export function defaultMeterRecognitionSettings(): MeterRecognitionSettings {
  return {
    enabledSignatures: ['2/4', '3/4', '4/4', '6/8'],
    tempo: 90,
    sound: 'percussive',
    emphasis: 'emphasized',
    measures: 4,
    autoAdvance: false,
  };
}

export interface MeterChoiceDef {
  id: string;
  label: string;
  btnClass: string;
}

/** Fixed canonical order (§4), filtered to whichever signatures are enabled. */
export function buildMeterChoiceDefs(enabledSignatures: string[]): MeterChoiceDef[] {
  return METER_SIGNATURES.filter((s) => enabledSignatures.includes(s)).map((s) => ({
    id: s,
    label: s,
    btnClass: 'interval-choice',
  }));
}

function pulseOnsetPositions(measureTotalBeats: number, pulse: number): number[] {
  const count = metricPulseCount(measureTotalBeats, pulse);
  return Array.from({ length: count }, (_, i) => i * pulse);
}

export function hasOnsetOnEveryPulse(bar: Measure, measureTotalBeats: number, pulse: number): boolean {
  return pulseOnsetPositions(measureTotalBeats, pulse).every((target) =>
    bar.some((n) => !n.isRest && durationClose(n.beat, target)),
  );
}

/** Last-resort fallback (§3.3) — trims/replaces whatever spans a missing pulse so every pulse gets an onset. */
export function forcePulseOnsets(bar: Measure, measureTotalBeats: number, pulse: number): Measure {
  const notes = bar.slice();
  pulseOnsetPositions(measureTotalBeats, pulse).forEach((target) => {
    if (notes.some((n) => !n.isRest && durationClose(n.beat, target))) return;
    const idx = notes.findIndex((n) => target >= n.beat - 0.001 && target < n.beat + n.duration - 0.001);
    if (idx >= 0) {
      const existing = notes[idx]!;
      const shrunk = target - existing.beat;
      if (shrunk > 0.01) notes[idx] = { ...existing, duration: shrunk };
      else notes.splice(idx, 1);
    }
    notes.push({ beat: target, duration: Math.min(pulse, measureTotalBeats - target), isRest: false });
  });
  return notes.sort((a, b) => a.beat - b.beat);
}

function generateBar(measureTotalBeats: number, durs: number[], step: number, pulse: number): Measure {
  return fillMeasure({
    measureTotalBeats,
    activeDurations: durs,
    restFrequency: 'none',
    syncopation: 'off',
    gridStepVal: step,
    pulseBeats: pulse,
  });
}

/** Regenerates bar 1 until every metric pulse has an onset (max 8 tries), then forces it (§3.3). */
function generateFirstBar(measureTotalBeats: number, durs: number[], step: number, pulse: number): Measure {
  let bar = generateBar(measureTotalBeats, durs, step, pulse);
  for (let attempt = 1; attempt < MAX_PULSE_ONSET_ATTEMPTS && !hasOnsetOnEveryPulse(bar, measureTotalBeats, pulse); attempt++) {
    bar = generateBar(measureTotalBeats, durs, step, pulse);
  }
  if (!hasOnsetOnEveryPulse(bar, measureTotalBeats, pulse)) {
    bar = forcePulseOnsets(bar, measureTotalBeats, pulse);
  }
  return bar;
}

export interface MeterQuestion {
  typeId: 'meterRecognition';
  answerId: string;
  answerLabel: string;
  pattern: Measure[];
  timeSig: TimeSigInfo;
  numMeasures: number;
  tempo: number;
  sound: SoundType;
  emphasisValue: number;
  choiceDefs: MeterChoiceDef[];
  promptDetail: string;
}

export function buildMeterQuestion(settings: MeterRecognitionSettings): MeterQuestion | null {
  const enabled = settings.enabledSignatures;
  if (enabled.length < MIN_ENABLED_SIGNATURES) return null;
  const sig = enabled[Math.floor(Math.random() * enabled.length)]!;
  const timeSig = parseTimeSig(sig);
  const durs = getActiveDurations(FIXED_DURATIONS, false, timeSig.measureBeats);
  const step = gridStep(durs);
  const pulse = metricPulseBeats(timeSig.beatValue, timeSig.beatsPerBar);

  const pattern: Measure[] = [];
  for (let i = 0; i < settings.measures; i++) {
    pattern.push(
      i === 0
        ? generateFirstBar(timeSig.measureBeats, durs, step, pulse)
        : generateBar(timeSig.measureBeats, durs, step, pulse),
    );
  }

  return {
    typeId: 'meterRecognition',
    answerId: sig,
    answerLabel: sig,
    pattern,
    timeSig,
    numMeasures: settings.measures,
    tempo: settings.tempo,
    sound: settings.sound,
    emphasisValue: EMPHASIS_VALUES[settings.emphasis],
    choiceDefs: buildMeterChoiceDefs(enabled),
    promptDetail: sig,
  };
}
