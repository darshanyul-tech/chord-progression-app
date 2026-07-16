import { pick, random } from '../theory';

// New topic (docs/05-topics/12-dynamics-articulation.md) — no legacy
// source. Two sub-modes sharing one phrase engine and answer frame:
// dynamics (comparative loudness — never absolute, since judging pp/mf/ff
// over an unknown speaker/system volume is unreliable) and articulation
// (staccato/legato/accented/tenuto, expressed purely via note length and
// velocity — no new playback primitives needed).

export type DAMode = 'dynamics' | 'articulation';
export type DADifficulty = 'easy' | 'medium' | 'hard';
export type ArticulationId = 'staccato' | 'legato' | 'accented' | 'tenuto';
export type DynamicsAnswerId = 'louder' | 'softer' | 'same';

/** Fixed velocity gap per difficulty (§2) — every "different" dynamics question at a level uses exactly this gap. */
export const DA_VELOCITY_GAP: Record<DADifficulty, number> = {
  easy: 0.3,
  medium: 0.18,
  hard: 0.1,
};

const VELOCITY_MIN = 0.15;
const VELOCITY_MAX = 0.95;
/** Base velocity range for the first hearing — wide enough that the easy gap (0.30) can require the reflect-not-clamp placement below. */
const BASE_VELOCITY_MIN = 0.35;
const BASE_VELOCITY_MAX = 0.75;

/** Fixed base rate (§2 — not a setting, same reasoning as Tuning's in-tune ratio). */
const SAME_CHANCE = 1 / 3;

export interface ArticulationDef {
  id: ArticulationId;
  label: string;
  description: string;
  /** Fraction of the beat length each note sounds for (>1 = notes overlap slightly, i.e. legato). */
  noteLenFraction: number;
  velocity: number;
}

export const ARTICULATION_TABLE: ArticulationDef[] = [
  { id: 'staccato', label: 'Staccato', description: 'Short, detached notes.', noteLenFraction: 0.25, velocity: 0.6 },
  { id: 'legato', label: 'Legato', description: 'Smooth, connected notes.', noteLenFraction: 1.05, velocity: 0.6 },
  { id: 'accented', label: 'Accented', description: 'Every note struck hard.', noteLenFraction: 0.7, velocity: 0.9 },
  { id: 'tenuto', label: 'Tenuto', description: 'Held the full written value.', noteLenFraction: 0.95, velocity: 0.6 },
];

export function articulationById(id: ArticulationId): ArticulationDef | undefined {
  return ARTICULATION_TABLE.find((a) => a.id === id);
}

export interface DASettings extends Record<string, unknown> {
  mode: DAMode;
  difficulty: DADifficulty;
  enabledArticulations: ArticulationId[];
  phraseLen: number;
  tempo: number;
  autoAdvance: boolean;
}

export function defaultDynamicsArticulationSettings(): DASettings {
  return {
    mode: 'dynamics',
    difficulty: 'easy',
    enabledArticulations: ['staccato', 'legato', 'accented', 'tenuto'],
    phraseLen: 4,
    tempo: 96,
    autoAdvance: false,
  };
}

const MAJOR_SCALE_STEPS = [0, 2, 4, 5, 7, 9, 11];
const PHRASE_ROOT_MIN = 48; // C3
const PHRASE_ROOT_MAX = 60; // C4

function degreeToMidi(rootMidi: number, degreeIndex: number): number {
  const octaveOffset = Math.floor(degreeIndex / 7);
  const stepInOctave = ((degreeIndex % 7) + 7) % 7;
  return rootMidi + octaveOffset * 12 + MAJOR_SCALE_STEPS[stepInOctave]!;
}

/**
 * A bland, deliberately uninteresting stepwise phrase (§3.1) — a carrier for
 * the loudness/articulation judgment, not something to listen to for its
 * own sake. Walks a major scale by ±1 step, with at most one ±2-step leap
 * (a third) allowed anywhere in the phrase.
 */
export function buildPhrase(phraseLen: number): number[] {
  const rootMidi = PHRASE_ROOT_MIN + Math.floor(random() * (PHRASE_ROOT_MAX - PHRASE_ROOT_MIN + 1));
  let degreeIndex = Math.floor(random() * 7);
  const degrees = [degreeIndex];
  let leapUsed = false;
  for (let i = 1; i < phraseLen; i++) {
    let step: number;
    if (!leapUsed && random() < 0.2) {
      step = random() < 0.5 ? 2 : -2;
      leapUsed = true;
    } else {
      step = random() < 0.5 ? 1 : -1;
    }
    degreeIndex += step;
    degrees.push(degreeIndex);
  }
  return degrees.map((d) => degreeToMidi(rootMidi, d));
}

export interface DynamicsQuestion {
  mode: 'dynamics';
  phraseMidis: number[];
  velocityA: number;
  velocityB: number;
  answerId: DynamicsAnswerId;
  choiceDefs: { id: DynamicsAnswerId; label: string }[];
}

function getDynamicsChoiceDefs(): { id: DynamicsAnswerId; label: string }[] {
  return [
    { id: 'louder', label: 'Second louder' },
    { id: 'softer', label: 'Second softer' },
    { id: 'same', label: 'Same' },
  ];
}

/**
 * Places the second hearing's velocity by reflecting (not clamping) when
 * the difficulty's gap would leave the comfortable velocity window — a
 * plain clamp could silently shrink the gap below what the difficulty
 * promises whenever the base sits near an edge (same trick as chord
 * comparison's transposed-root placement).
 */
function placeVelocityB(base: number, gap: number): { velocityB: number; louder: boolean } {
  let louder = random() < 0.5;
  let velocityB = base + (louder ? gap : -gap);
  if (velocityB > VELOCITY_MAX || velocityB < VELOCITY_MIN) {
    louder = !louder;
    velocityB = base + (louder ? gap : -gap);
  }
  return { velocityB, louder };
}

function buildDynamicsQuestion(settings: DASettings): DynamicsQuestion {
  const phraseMidis = buildPhrase(settings.phraseLen);
  const velocityA = BASE_VELOCITY_MIN + random() * (BASE_VELOCITY_MAX - BASE_VELOCITY_MIN);

  if (random() < SAME_CHANCE) {
    return {
      mode: 'dynamics',
      phraseMidis,
      velocityA,
      velocityB: velocityA,
      answerId: 'same',
      choiceDefs: getDynamicsChoiceDefs(),
    };
  }

  const gap = DA_VELOCITY_GAP[settings.difficulty];
  const { velocityB, louder } = placeVelocityB(velocityA, gap);
  return {
    mode: 'dynamics',
    phraseMidis,
    velocityA,
    velocityB,
    answerId: louder ? 'louder' : 'softer',
    choiceDefs: getDynamicsChoiceDefs(),
  };
}

export interface ArticulationQuestion {
  mode: 'articulation';
  phraseMidis: number[];
  articulationId: ArticulationId;
  answerId: ArticulationId;
  choiceDefs: { id: ArticulationId; label: string }[];
}

function getArticulationChoiceDefs(enabledIds: ArticulationId[]): { id: ArticulationId; label: string }[] {
  return ARTICULATION_TABLE.filter((a) => enabledIds.includes(a.id)).map((a) => ({ id: a.id, label: a.label }));
}

function buildArticulationQuestion(settings: DASettings): ArticulationQuestion | null {
  const pool = ARTICULATION_TABLE.filter((a) => settings.enabledArticulations.includes(a.id));
  if (pool.length < 2) return null;
  const def = pick(pool);
  return {
    mode: 'articulation',
    phraseMidis: buildPhrase(settings.phraseLen),
    articulationId: def.id,
    answerId: def.id,
    choiceDefs: getArticulationChoiceDefs(settings.enabledArticulations),
  };
}

export type DAQuestion = DynamicsQuestion | ArticulationQuestion;

/**
 * Builds one question for the topic's current mode, or null when
 * articulation mode has fewer than 2 enabled articulations (§6 — per-type
 * empty-paper message convention). Dynamics can never return null — the
 * "Same" base rate and choice set don't depend on any pool.
 */
export function buildDynamicsArticulationQuestion(settings: DASettings): DAQuestion | null {
  if (settings.mode === 'dynamics') return buildDynamicsQuestion(settings);
  return buildArticulationQuestion(settings);
}
