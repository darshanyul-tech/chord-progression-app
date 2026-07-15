import { pick } from '../theory';

// Ported verbatim from legacy INTERVAL_TYPES / interval* functions
// (docs/05-topics/01-interval-recognition.md).
export interface IntervalType {
  id: string;
  label: string;
  semitones: number;
}

export const INTERVAL_TYPES: IntervalType[] = [
  { id: 'm2', label: 'Minor 2nd', semitones: 1 },
  { id: 'M2', label: 'Major 2nd', semitones: 2 },
  { id: 'm3', label: 'Minor 3rd', semitones: 3 },
  { id: 'M3', label: 'Major 3rd', semitones: 4 },
  { id: 'P4', label: 'Perfect 4th', semitones: 5 },
  { id: 'TT', label: 'Tritone', semitones: 6 },
  { id: 'P5', label: 'Perfect 5th', semitones: 7 },
  { id: 'm6', label: 'Minor 6th', semitones: 8 },
  { id: 'M6', label: 'Major 6th', semitones: 9 },
  { id: 'm7', label: 'Minor 7th', semitones: 10 },
  { id: 'M7', label: 'Major 7th', semitones: 11 },
  { id: 'P8', label: 'Perfect octave', semitones: 12 },
  { id: 'm9', label: 'Minor 9th', semitones: 13 },
  { id: 'M9', label: 'Major 9th', semitones: 14 },
];

export const RECOGNITION_MAX_GUESSES = 3;
export const RECOGNITION_AUTO_ADVANCE_MS = 450;

export type IntervalDirectionMode = 'asc' | 'desc' | 'both';
export type IntervalDirection = 'asc' | 'desc';

export interface IntervalPoolEntry {
  id: string;
  label: string;
  semitones: number;
  direction: IntervalDirection;
}

export interface IntervalPracticeSettings {
  directionMode: IntervalDirectionMode;
  pool: IntervalPoolEntry[];
  noteLen: number;
  gap: number;
}

export interface IntervalChoiceDef {
  id: string;
  label: string;
  btnClass: string;
}

export interface IntervalQuestion {
  id: string;
  label: string;
  semitones: number;
  direction: IntervalDirection;
  rootMidi: number;
  answerId: string;
  answerLabel: string;
  playback: { noteLen: number; gap: number };
  choiceDefs: IntervalChoiceDef[];
  promptDetail: string;
}

// --- Settings -> practice pool (replaces legacy's DOM-reading getIntervalPracticeSettings) ---

export interface IntervalEnabledEntry {
  asc: boolean;
  desc: boolean;
}

export interface IntervalRecognitionSettings extends Record<string, unknown> {
  direction: IntervalDirectionMode;
  enabledIntervals: Record<string, IntervalEnabledEntry>;
  noteLen: number;
  gapLen: number;
  autoAdvance: boolean;
}

export function defaultIntervalRecognitionSettings(): IntervalRecognitionSettings {
  const enabledIntervals: Record<string, IntervalEnabledEntry> = {};
  INTERVAL_TYPES.forEach((t) => {
    const on = t.semitones <= 7;
    enabledIntervals[t.id] = { asc: on, desc: on };
  });
  return {
    direction: 'both',
    enabledIntervals,
    noteLen: 0.55,
    gapLen: 0.12,
    autoAdvance: false,
  };
}

export function buildIntervalPracticePool(settings: IntervalRecognitionSettings): IntervalPracticeSettings {
  const enabled: IntervalPoolEntry[] = [];
  INTERVAL_TYPES.forEach((def) => {
    const entry = settings.enabledIntervals[def.id];
    if (!entry) return;
    if (entry.asc) enabled.push({ id: def.id, label: def.label, semitones: def.semitones, direction: 'asc' });
    if (entry.desc) enabled.push({ id: def.id, label: def.label, semitones: def.semitones, direction: 'desc' });
  });
  let pool = enabled;
  if (settings.direction === 'asc') pool = enabled.filter((e) => e.direction === 'asc');
  else if (settings.direction === 'desc') pool = enabled.filter((e) => e.direction === 'desc');
  return { directionMode: settings.direction, pool, noteLen: settings.noteLen, gap: settings.gapLen };
}

export function getIntervalChoiceDefsForPractice(practice: Pick<IntervalPracticeSettings, 'pool'>): IntervalType[] {
  const seen: Record<string, boolean> = {};
  const defs: IntervalType[] = [];
  practice.pool.forEach((entry) => {
    if (!seen[entry.id]) {
      seen[entry.id] = true;
      const base = INTERVAL_TYPES.find((t) => t.id === entry.id);
      if (base) defs.push(base);
    }
  });
  return defs.sort((a, b) => a.semitones - b.semitones);
}

export function buildIntervalExamQuestion(practice: IntervalPracticeSettings): IntervalQuestion | null {
  if (!practice.pool.length) return null;
  const entry = pick(practice.pool);
  const minRoot = 48;
  const maxRoot = 72 - entry.semitones;
  const rootMidi = minRoot + Math.floor(Math.random() * (maxRoot - minRoot + 1));
  const base = INTERVAL_TYPES.find((t) => t.id === entry.id);
  const choiceDefs = getIntervalChoiceDefsForPractice(practice).map((d) => ({
    id: d.id,
    label: d.label,
    btnClass: 'interval-choice',
  }));
  return {
    id: entry.id,
    label: base ? base.label : entry.label,
    semitones: entry.semitones,
    direction: entry.direction,
    rootMidi,
    answerId: entry.id,
    answerLabel: base ? base.label : entry.label,
    playback: { noteLen: practice.noteLen, gap: practice.gap },
    choiceDefs,
    promptDetail: `${entry.direction === 'asc' ? 'Ascending' : 'Descending'} ${base ? base.label : entry.label}`,
  };
}

export function pickIntervalQuestion(practice: IntervalPracticeSettings): IntervalQuestion | null {
  const s = practice;
  if (!s.pool.length) return null;
  return buildIntervalExamQuestion(s);
}

export function intervalPlaybackNotes(
  q: Pick<IntervalQuestion, 'rootMidi' | 'semitones' | 'direction'>,
): number[] {
  const low = q.rootMidi;
  const high = q.rootMidi + q.semitones;
  if (q.direction === 'asc') return [low, high];
  return [high, low];
}
