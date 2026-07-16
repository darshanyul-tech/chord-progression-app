import { f0FromMidi } from '../pitch/analysis';
import { midiToNoteName, random } from '../theory';

// New topic (docs/05-topics/11-tuning.md) — no legacy source, no microphone.
// A reference note plays, then the same note again either in tune or
// detuned by a small, fixed (per-difficulty) number of cents; the user says
// which. Trains the fine pitch discrimination both singing topics' ±cents
// tolerances rest on.

export type TuningDifficulty = 'easy' | 'medium' | 'hard';
export type TuningAnswerId = 'flat' | 'intune' | 'sharp';
export type TuningRegister = 'low' | 'mid' | 'high' | 'any';

/** Fixed detune magnitude in cents per difficulty (§2) — every detuned question at a level uses exactly this value. */
export const TUNING_DETUNE_CENTS: Record<TuningDifficulty, number> = {
  easy: 25,
  medium: 15,
  hard: 8,
};

interface RegisterWindow {
  lowMidi: number;
  highMidi: number;
}

const REGISTER_WINDOWS: Record<TuningRegister, RegisterWindow> = {
  low: { lowMidi: 48, highMidi: 59 }, // C3-B3
  mid: { lowMidi: 60, highMidi: 71 }, // C4-B4
  high: { lowMidi: 72, highMidi: 83 }, // C5-B5
  any: { lowMidi: 48, highMidi: 83 },
};

/** Fixed base rate (§2 — not a setting; an imbalanced rate corrupts the "In tune" answer's meaning). */
const IN_TUNE_CHANCE = 1 / 3;

export interface TuningSettings extends Record<string, unknown> {
  difficulty: TuningDifficulty;
  register: TuningRegister;
  noteLen: number;
  pauseSec: number;
  autoAdvance: boolean;
}

export function defaultTuningSettings(): TuningSettings {
  return {
    difficulty: 'easy',
    register: 'mid',
    noteLen: 1.0,
    pauseSec: 0.8,
    autoAdvance: false,
  };
}

export interface TuningChoiceDef {
  id: TuningAnswerId;
  label: string;
}

/** The fixed three answer buttons — never varies with settings (§3). */
export function getTuningChoiceDefs(): TuningChoiceDef[] {
  return [
    { id: 'flat', label: 'Flat' },
    { id: 'intune', label: 'In tune' },
    { id: 'sharp', label: 'Sharp' },
  ];
}

export interface TuningQuestion {
  baseMidi: number;
  baseNoteName: string;
  /** Signed cents the second hearing differs from the first: 0, +magnitude (sharp), or -magnitude (flat). */
  detuneCents: number;
  /** Hz for the second hearing — the base note's frequency shifted by detuneCents (no note-name spelling exists for a detuned pitch). */
  testFrequencyHz: number;
  answerId: TuningAnswerId;
  choiceDefs: TuningChoiceDef[];
}

export function buildTuningQuestion(settings: TuningSettings): TuningQuestion {
  const win = REGISTER_WINDOWS[settings.register];
  const baseMidi = win.lowMidi + Math.floor(random() * (win.highMidi - win.lowMidi + 1));

  let detuneCents = 0;
  let answerId: TuningAnswerId = 'intune';
  if (random() >= IN_TUNE_CHANCE) {
    const magnitude = TUNING_DETUNE_CENTS[settings.difficulty];
    const sharp = random() < 0.5;
    detuneCents = sharp ? magnitude : -magnitude;
    answerId = sharp ? 'sharp' : 'flat';
  }

  const baseFreq = f0FromMidi(baseMidi);
  const testFrequencyHz = baseFreq * Math.pow(2, detuneCents / 1200);

  return {
    baseMidi,
    baseNoteName: midiToNoteName(baseMidi),
    detuneCents,
    testFrequencyHz,
    answerId,
    choiceDefs: getTuningChoiceDefs(),
  };
}
