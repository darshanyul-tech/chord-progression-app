import { pick, random } from '../theory';
import { CHORD_RECOGNITION_RECIPES, chordTypeById } from '../recognition/chords';
import { gradeSungSequence, type SungGradeOptions, type SungGradeResult } from './grading';
import type { RootRangePreset, RootRangeWindow } from './question';
import type { ToleranceLevel } from './settings';

// Chord Singing (docs/05-topics/10-chord-singing.md) — second microphone
// topic, reusing the entire lib/pitch stack (this was the explicit design
// intent recorded in 09-improvement-plan.md §16.4: "the same lib/pitch
// stack powers Chord Singing and Sight Singing"). One voice can't sing a
// chord, so the user arpeggiates it tone by tone; gradeSungInterval grades
// each tone unchanged, one call per offset.

/**
 * v1 singable subset of CHORD_RECOGNITION_TYPES — restricted to qualities
 * with at most 4 tones (5-6 tone chords exceed practical breath/attention
 * span for a sung arpeggio). Extended/altered qualities are out of scope v1.
 */
export const CHORD_SINGING_ALLOWED_IDS = [
  'maj',
  'm',
  'dim',
  'aug',
  'sus4',
  'sus2',
  'maj7',
  'm7',
  '7',
  'm7b5',
  'dim7',
  'maj6',
  'm6',
];

// Module-load assertion (§3.1): catches a future edit to
// CHORD_RECOGNITION_RECIPES that would silently break the "one tone at a
// time" premise this whole topic is built on.
CHORD_SINGING_ALLOWED_IDS.forEach((id) => {
  const recipe = CHORD_RECOGNITION_RECIPES[id];
  if (!recipe || recipe.length > 4) {
    throw new Error(`chordSinging: allowed quality '${id}' must have a recipe of at most 4 tones`);
  }
});

export type ChordSingingPromptMode = 'echo' | 'construction';
export type ChordSingingDirectionMode = 'up' | 'down' | 'both';

export interface ChordSingingSettings extends Record<string, unknown> {
  enabledTypes: string[];
  promptMode: ChordSingingPromptMode;
  direction: ChordSingingDirectionMode;
  rootRange: RootRangePreset;
  tolerance: ToleranceLevel;
  octaveEquivalence: boolean;
  holdTimeSec: number;
  autoAdvance: boolean;
}

export function defaultChordSingingSettings(): ChordSingingSettings {
  return {
    enabledTypes: ['maj', 'm'],
    promptMode: 'echo',
    direction: 'up',
    rootRange: 'auto',
    tolerance: 'default',
    octaveEquivalence: true,
    holdTimeSec: 0.5,
    autoAdvance: false,
  };
}

export interface ChordSingingQuestion {
  rootMidi: number;
  qualityId: string;
  qualityLabel: string;
  /** Tone offsets from the root, in singing order — ascending for 'up', reversed (highest first) for 'down'. */
  toneOffsets: number[];
  promptMode: ChordSingingPromptMode;
}

/**
 * Builds one question, or null when no enabled quality is in the singable
 * subset (§3/§8 — caller shows an "adjust settings" message, same
 * convention as other builders). Root selection: uniform such that root +
 * the quality's highest tone stays inside `rootRange`, falling back to the
 * range's low end if it can't fit anywhere else — same convention as
 * buildSingingQuestion in question.ts.
 */
export function buildChordSingingQuestion(
  settings: ChordSingingSettings,
  rootRange: RootRangeWindow,
): ChordSingingQuestion | null {
  const pool = settings.enabledTypes.filter((id) => CHORD_SINGING_ALLOWED_IDS.includes(id));
  if (!pool.length) return null;

  const qualityId = pick(pool);
  const def = chordTypeById(qualityId);
  const recipe = CHORD_RECOGNITION_RECIPES[qualityId]!;
  const maxOffset = Math.max(...recipe);

  const dirMode = settings.direction === 'both' ? (random() < 0.5 ? 'up' : 'down') : settings.direction;

  const minRoot = rootRange.lowMidi;
  const maxRoot = rootRange.highMidi - maxOffset;
  const rootMidi = maxRoot >= minRoot ? minRoot + Math.floor(random() * (maxRoot - minRoot + 1)) : rootRange.lowMidi;

  const toneOffsets = dirMode === 'down' ? [...recipe].reverse() : [...recipe];

  return {
    rootMidi,
    qualityId,
    qualityLabel: def ? def.label : qualityId,
    toneOffsets,
    promptMode: settings.promptMode,
  };
}

export interface ArpeggioGradeResult {
  allCorrect: boolean;
  tones: SungGradeResult[];
}

/**
 * Grades a completed arpeggio attempt: one gradeSungInterval call per tone
 * offset, unchanged from Interval Singing (§1/§7's explicit reuse mandate).
 * `captures[i]` is the fractional-MIDI pitch captured for `toneOffsets[i]`;
 * callers only invoke this once every tone has been captured, so the two
 * arrays are always the same length. Delegates to the shared
 * gradeSungSequence (extracted in Phase 23 once Sight Singing needed the
 * identical shape for absolute-pitch melody grading) — no behavior change.
 */
export function gradeArpeggio(
  rootMidi: number,
  toneOffsets: number[],
  captures: number[],
  opts: SungGradeOptions,
): ArpeggioGradeResult {
  return gradeSungSequence(rootMidi, toneOffsets, captures, opts);
}
