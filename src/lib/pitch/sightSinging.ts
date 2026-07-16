import { generateMelody, type GeneratedMelody } from '../melody/generator';
import type { ChromaticSetting, MelodicDictationSettings } from '../melody/settings';
import type { PitchedMeasure } from '../melody/theory';
import { gradeSungSequence, type SungGradeOptions, type SungSequenceGradeResult } from './grading';
import type { RootRangePreset, RootRangeWindow } from './question';
import type { ToleranceLevel } from './settings';

// Sight Singing (docs/05-topics/13-sight-singing.md) — third microphone
// topic, reusing the entire lib/pitch stack plus melody generation
// (lib/melody/generator.ts) and notation display (lib/melody/vexscore.ts,
// display-only — no new notation code). A notated melody is sung note by
// note; grading is pitch-only in v1 (no rhythm grading — spec §1's binding
// scope decision: onset detection is a different problem, and bolting it on
// would make wrong-pitch and wrong-time failures indistinguishable).

/** 'leapy' is excluded v1 — leaps compound with singing error and make the manual gate unpassable (spec §2). */
export type SightSingingMotion = 'steps' | 'mixed';
/** 'moderate' is excluded v1 — spec §2 only offers none/light for this topic. */
export type SightSingingChromatic = 'none' | 'light';

export interface SightSingingSettings extends Record<string, unknown> {
  key: string;
  randomKey: boolean;
  measures: number;
  motion: SightSingingMotion;
  chromatic: SightSingingChromatic;
  vocalRange: RootRangePreset;
  tolerance: ToleranceLevel;
  octaveEquivalence: boolean;
  holdTimeSec: number;
  autoAdvance: boolean;
}

export function defaultSightSingingSettings(): SightSingingSettings {
  return {
    key: 'C',
    randomKey: false,
    measures: 1,
    motion: 'steps',
    chromatic: 'none',
    vocalRange: 'auto',
    tolerance: 'default',
    octaveEquivalence: true,
    holdTimeSec: 0.5,
    autoAdvance: false,
  };
}

/**
 * Fixed dictation-settings fields (§3.1) — rhythm here is decoration, not a
 * graded target, so it's kept plain: treble clef, 4/4, quarter/eighth
 * values only, no rests, no syncopation. Asserted by a unit test so a
 * melody-generator default change can't silently reintroduce rests.
 */
function toMelodicDictationSettings(settings: SightSingingSettings): MelodicDictationSettings {
  return {
    clef: 'treble',
    key: settings.key,
    randomKey: settings.randomKey,
    range: 'narrow',
    chromatic: settings.chromatic as ChromaticSetting,
    signatures: ['4/4'],
    durations: [1, 0.5], // quarter, eighth
    rests: 'none',
    syncopation: 'off',
    measures: settings.measures,
    tempo: 76,
    motion: settings.motion,
    previewOnPlace: false,
  };
}

function flattenMelody(melody: GeneratedMelody): number[] {
  const midis: number[] = [];
  melody.measures.forEach((bar) => {
    bar.forEach((n) => {
      if (!n.rest) midis.push(n.midi!);
    });
  });
  return midis;
}

function transposeMeasures(measures: PitchedMeasure[], semitones: number): PitchedMeasure[] {
  if (semitones === 0) return measures;
  return measures.map((bar) => bar.map((n) => (n.rest ? n : { ...n, midi: n.midi! + semitones })));
}

function allInWindow(midis: number[], window: RootRangeWindow): boolean {
  return midis.length > 0 && midis.every((m) => m >= window.lowMidi && m <= window.highMidi);
}

/** Tries octave shifts (the melody generator's own range is already an octave or so wide) to fit the whole melody inside the vocal window, without changing its shape. */
function fitMelodyToWindow(melody: GeneratedMelody, window: RootRangeWindow): GeneratedMelody | null {
  for (let octaves = -3; octaves <= 3; octaves++) {
    const measures = transposeMeasures(melody.measures, octaves * 12);
    if (allInWindow(flattenMelody({ ...melody, measures }), window)) {
      return { ...melody, measures };
    }
  }
  return null;
}

/** The tonic-pitch-class MIDI note closest to `referenceMidi`, for the key-orientation chord (§4.1). */
function nearestTonicMidi(tonicPc: number, referenceMidi: number): number {
  let best = referenceMidi;
  let bestDist = Infinity;
  for (let m = referenceMidi - 12; m <= referenceMidi + 12; m++) {
    if (((m % 12) + 12) % 12 === tonicPc) {
      const dist = Math.abs(m - referenceMidi);
      if (dist < bestDist) {
        bestDist = dist;
        best = m;
      }
    }
  }
  return best;
}

export interface SightSingingQuestion {
  melody: GeneratedMelody;
  /** Flattened onset sequence in performance order — every note, no rests were allowed. */
  targetMidis: number[];
  /** Root for the key-orientation tonic chord. */
  tonicMidi: number;
  keyLabel: string;
}

const MAX_REGENERATE_RETRIES = 8;

/**
 * Builds one question: generates a melody (bounded retries), then fits it
 * (by octave transposition, shape unchanged) inside the vocal-range window
 * — the intersection the spec calls for, achieved by clamp-transposing the
 * generator's own output rather than feeding an arbitrary window into
 * generateMelody's unrelated 'narrow'/'medium'/'wide' range enum.
 */
export function buildSightSingingQuestion(
  settings: SightSingingSettings,
  vocalRange: RootRangeWindow,
): SightSingingQuestion {
  const dictationSettings = toMelodicDictationSettings(settings);
  let melody = generateMelody(dictationSettings);
  let fitted = fitMelodyToWindow(melody, vocalRange);
  for (let attempt = 1; !fitted && attempt < MAX_REGENERATE_RETRIES; attempt++) {
    melody = generateMelody(dictationSettings);
    fitted = fitMelodyToWindow(melody, vocalRange);
  }
  const finalMelody = fitted ?? melody;
  const targetMidis = flattenMelody(finalMelody);
  const tonicMidi = nearestTonicMidi(finalMelody.key.tonicPc, targetMidis[0] ?? vocalRange.lowMidi);

  return { melody: finalMelody, targetMidis, tonicMidi, keyLabel: finalMelody.key.id };
}

/**
 * Grades a completed attempt: gradeSungSequence with rootMidi = 0, since
 * targetMidis are already absolute pitches (root 0 + absolute target =
 * absolute-pitch grading — the existing gradeSungInterval signature already
 * supports this without a wrapper type).
 */
export function gradeSungMelody(
  targetMidis: number[],
  captures: number[],
  opts: SungGradeOptions,
): SungSequenceGradeResult {
  return gradeSungSequence(0, targetMidis, captures, opts);
}
