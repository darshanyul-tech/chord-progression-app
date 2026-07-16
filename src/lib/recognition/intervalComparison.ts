import { pick, random } from '../theory';
import { INTERVAL_TYPES, type IntervalType } from './intervals';

// New topic (docs/05-topics/08-interval-comparison.md) — no legacy source.
// Trains interval *size* perception directly: two intervals play in
// sequence and the user answers which is larger (or "same").

export type ComparisonDifficulty = 'easy' | 'medium' | 'hard';
export type ComparisonDirectionMode = 'asc' | 'desc' | 'both';
export type ComparisonRootRelationship = 'different' | 'same';
export type ComparisonAnswerId = 'first' | 'second' | 'same';

/** Minimum semitone gap between the two intervals in a question, per §2. */
export const DIFFICULTY_FLOORS: Record<ComparisonDifficulty, number> = {
  easy: 3,
  medium: 2,
  hard: 1,
};

/** Same fraction of "same interval type twice" questions when Allow Same is on (§3.2). */
const SAME_QUESTION_CHANCE = 0.25;

const ROOT_MIN = 48;
const ROOT_MAX = 72;

export interface IntervalComparisonSettings extends Record<string, unknown> {
  enabledIntervals: Record<string, boolean>;
  direction: ComparisonDirectionMode;
  difficulty: ComparisonDifficulty;
  allowSame: boolean;
  rootRelationship: ComparisonRootRelationship;
  noteLen: number;
  gapLen: number;
  pairPauseSec: number;
  autoAdvance: boolean;
}

export function defaultIntervalComparisonSettings(): IntervalComparisonSettings {
  const enabledIntervals: Record<string, boolean> = {};
  INTERVAL_TYPES.forEach((t) => {
    enabledIntervals[t.id] = t.semitones <= 7;
  });
  return {
    enabledIntervals,
    direction: 'both',
    difficulty: 'medium',
    allowSame: false,
    rootRelationship: 'different',
    noteLen: 0.55,
    gapLen: 0.12,
    pairPauseSec: 0.8,
    autoAdvance: false,
  };
}

export interface ComparisonChoiceDef {
  id: ComparisonAnswerId;
  label: string;
}

/** The fixed 2-3 answer buttons — independent of which interval types are enabled (§5). */
export function getIntervalComparisonChoiceDefs(
  settings: Pick<IntervalComparisonSettings, 'allowSame'>,
): ComparisonChoiceDef[] {
  const defs: ComparisonChoiceDef[] = [
    { id: 'first', label: 'First is larger' },
    { id: 'second', label: 'Second is larger' },
  ];
  if (settings.allowSame) defs.push({ id: 'same', label: 'Same' });
  return defs;
}

export interface ComparisonMember {
  typeId: string;
  label: string;
  semitones: number;
  rootMidi: number;
}

export interface IntervalComparisonQuestion {
  first: ComparisonMember;
  second: ComparisonMember;
  direction: 'asc' | 'desc';
  answerId: ComparisonAnswerId;
  choiceDefs: ComparisonChoiceDef[];
}

function enabledPool(settings: IntervalComparisonSettings): IntervalType[] {
  return INTERVAL_TYPES.filter((t) => settings.enabledIntervals[t.id]);
}

function resolveDirection(mode: ComparisonDirectionMode): 'asc' | 'desc' {
  if (mode === 'both') return random() < 0.5 ? 'asc' : 'desc';
  return mode;
}

function pickRoot(semitones: number): number {
  const maxRoot = ROOT_MAX - semitones;
  return ROOT_MIN + Math.floor(random() * (maxRoot - ROOT_MIN + 1));
}

function pickRoots(
  typeFirst: IntervalType,
  typeSecond: IntervalType,
  rootRelationship: ComparisonRootRelationship,
): [number, number] {
  if (rootRelationship === 'same') {
    const root = pickRoot(Math.max(typeFirst.semitones, typeSecond.semitones));
    return [root, root];
  }
  return [pickRoot(typeFirst.semitones), pickRoot(typeSecond.semitones)];
}

/**
 * Builds one comparison question, or null when the enabled pool can't
 * satisfy the difficulty floor (§1/§8 — same convention as other builders:
 * caller shows an "adjust settings" message rather than throwing).
 */
export function buildIntervalComparisonQuestion(
  settings: IntervalComparisonSettings,
): IntervalComparisonQuestion | null {
  const pool = enabledPool(settings);
  const floor = DIFFICULTY_FLOORS[settings.difficulty];

  // Only types with at least one valid partner at this floor may anchor a
  // "different" question — a pool can satisfy the floor overall while its
  // middle-valued members (e.g. {3, 5, 7} at floor 3: only 3↔7 qualifies)
  // have no partner of their own.
  const eligibleFirst = pool.filter((t) =>
    pool.some((u) => u.id !== t.id && Math.abs(u.semitones - t.semitones) >= floor),
  );
  if (!eligibleFirst.length) return null;

  const direction = resolveDirection(settings.direction);
  const rollSame = settings.allowSame && random() < SAME_QUESTION_CHANCE;

  let typeFirst: IntervalType;
  let typeSecond: IntervalType;
  let answerId: ComparisonAnswerId;

  if (rollSame) {
    typeFirst = pick(pool);
    typeSecond = typeFirst;
    answerId = 'same';
  } else {
    const anchor = pick(eligibleFirst);
    const partners = pool.filter((t) => t.id !== anchor.id && Math.abs(t.semitones - anchor.semitones) >= floor);
    const partner = pick(partners);
    // Coin-flip which of the pair plays first so the larger interval's
    // position never correlates with the answer.
    if (random() < 0.5) {
      typeFirst = anchor;
      typeSecond = partner;
    } else {
      typeFirst = partner;
      typeSecond = anchor;
    }
    answerId = typeFirst.semitones > typeSecond.semitones ? 'first' : 'second';
  }

  const [rootFirst, rootSecond] = pickRoots(typeFirst, typeSecond, settings.rootRelationship);

  return {
    first: { typeId: typeFirst.id, label: typeFirst.label, semitones: typeFirst.semitones, rootMidi: rootFirst },
    second: { typeId: typeSecond.id, label: typeSecond.label, semitones: typeSecond.semitones, rootMidi: rootSecond },
    direction,
    answerId,
    choiceDefs: getIntervalComparisonChoiceDefs(settings),
  };
}

/** Playback notes for one member of the pair, reusing intervalPlaybackNotes' asc/desc convention. */
export function comparisonMemberNotes(member: ComparisonMember, direction: 'asc' | 'desc'): [number, number] {
  const low = member.rootMidi;
  const high = member.rootMidi + member.semitones;
  return direction === 'asc' ? [low, high] : [high, low];
}
