import { pick, random } from '../theory';
import {
  CHORD_RECOGNITION_TYPES,
  CHORD_ROOT_MIDI_MAX,
  CHORD_ROOT_MIDI_MIN,
  chordTypeById,
  pickChordRootMidi,
} from './chords';

// New topic (docs/05-topics/09-chord-comparison.md) — no legacy source.
// Trains quality *discrimination* (same/different) rather than naming — the
// stepping stone before Chord Recognition's full identification. "Different"
// pairs come from hand-curated confusion tiers (§2), not random pairs:
// random quality pairs are usually trivially distinguishable.

export interface ChordConfusionPair {
  a: string;
  b: string;
}

export const CHORD_CONFUSION_TIER_1: ChordConfusionPair[] = [
  { a: 'maj', b: 'm' },
  { a: 'maj', b: 'dim' },
  { a: 'm', b: 'aug' },
  { a: 'maj7', b: 'm7' },
  { a: '7', b: 'm7' },
  { a: 'maj', b: 'sus4' },
];

export const CHORD_CONFUSION_TIER_2: ChordConfusionPair[] = [
  { a: 'maj', b: 'maj7' },
  { a: 'maj7', b: 'maj9' },
  { a: 'm7', b: 'm9' },
  { a: '7', b: '9' },
  { a: 'maj', b: 'maj6' },
  { a: 'm', b: 'm6' },
  { a: '7', b: '13' },
  { a: 'sus4', b: 'sus2' },
  { a: 'maj7', b: '7' },
  { a: 'm7', b: 'mMaj7' },
];

export const CHORD_CONFUSION_TIER_3: ChordConfusionPair[] = [
  { a: '7s5', b: '7b5' },
  { a: 'maj7s5', b: 'maj7' },
  { a: '7s9', b: '7b9' },
  { a: 'm7b5', b: 'dim7' },
  { a: 'm7b5', b: 'm7' },
  { a: '7sus4', b: '7sus4b9' },
  { a: 'maj7b5', b: 'maj7' },
  { a: 'm9', b: 'm9b5' },
  { a: '9', b: '9sus4' },
  { a: '7alt', b: '7s9' },
];

export type ChordComparisonDifficulty = 1 | 2 | 3;
export type ChordComparisonRootRelationship = 'same' | 'transposed';
export type ChordComparisonAnswerId = 'same' | 'different';

/** Max transposition offset (semitones) for the "transposed" root relationship (§4.3). */
const MAX_TRANSPOSE_OFFSET = 5;

/**
 * The topic exposes only one length slider (§3's storage schema has just
 * `holdLen`, no separate arp fields) — in arpeggio mode, holdLen doubles as
 * the per-note length, with this small fixed gap between notes.
 */
export const CHORD_COMPARISON_ARP_GAP = 0.08;

export interface ChordComparisonSettings extends Record<string, unknown> {
  enabledTypes: string[];
  difficulty: ChordComparisonDifficulty;
  rootRelationship: ChordComparisonRootRelationship;
  playbackStyle: 'block' | 'arp';
  holdLen: number;
  pairPauseSec: number;
  autoAdvance: boolean;
}

export function defaultChordComparisonSettings(): ChordComparisonSettings {
  return {
    enabledTypes: CHORD_RECOGNITION_TYPES.filter((t) => t.default).map((t) => t.id),
    difficulty: 1,
    rootRelationship: 'same',
    playbackStyle: 'block',
    holdLen: 1.4,
    pairPauseSec: 0.8,
    autoAdvance: false,
  };
}

export interface ChordComparisonChoiceDef {
  id: ChordComparisonAnswerId;
  label: string;
}

export function getChordComparisonChoiceDefs(): ChordComparisonChoiceDef[] {
  return [
    { id: 'same', label: 'Same' },
    { id: 'different', label: 'Different' },
  ];
}

/** Tiers up to and including `difficulty` — higher tiers cumulatively include lower ones (§3). */
function tiersUpTo(difficulty: ChordComparisonDifficulty): ChordConfusionPair[][] {
  const all = [CHORD_CONFUSION_TIER_1, CHORD_CONFUSION_TIER_2, CHORD_CONFUSION_TIER_3];
  return all.slice(0, difficulty);
}

/** Confusion pairs where both qualities are in the enabled pool (§4.1). */
export function eligibleConfusionPairs(
  difficulty: ChordComparisonDifficulty,
  enabledTypes: string[],
): ChordConfusionPair[] {
  const enabled = new Set(enabledTypes);
  const pairs: ChordConfusionPair[] = [];
  tiersUpTo(difficulty).forEach((tier) => {
    tier.forEach((p) => {
      if (enabled.has(p.a) && enabled.has(p.b)) pairs.push(p);
    });
  });
  return pairs;
}

/** Uniform nonzero integer in [-maxAbs, -1] ∪ [1, maxAbs]. */
function randomNonzeroOffset(maxAbs: number): number {
  const n = Math.floor(random() * (2 * maxAbs));
  return n < maxAbs ? n - maxAbs : n - maxAbs + 1;
}

/**
 * Root B for the "transposed" relationship: offset by 1-5 semitones from
 * root A, reflected (not clamped) if it would leave the register window —
 * clamping alone can silently collapse to offset 0 when root A sits near an
 * edge, which would corrupt the "root B !== root A" guarantee.
 */
function transposedRoot(rootMidiA: number): number {
  const offset = randomNonzeroOffset(MAX_TRANSPOSE_OFFSET);
  let rootMidiB = rootMidiA + offset;
  if (rootMidiB > CHORD_ROOT_MIDI_MAX || rootMidiB < CHORD_ROOT_MIDI_MIN) {
    rootMidiB = rootMidiA - offset;
  }
  return rootMidiB;
}

export interface ChordComparisonMember {
  typeId: string;
  label: string;
  rootMidi: number;
}

export interface ChordComparisonQuestion {
  first: ChordComparisonMember;
  second: ChordComparisonMember;
  answerId: ChordComparisonAnswerId;
  choiceDefs: ChordComparisonChoiceDef[];
}

/**
 * Builds one comparison question, or null when no confusion pair is
 * eligible at the current difficulty/pool (§4/§8 — caller shows an "adjust
 * settings" message, same convention as other builders).
 */
export function buildChordComparisonQuestion(settings: ChordComparisonSettings): ChordComparisonQuestion | null {
  const pairs = eligibleConfusionPairs(settings.difficulty, settings.enabledTypes);
  if (!pairs.length) return null;

  const rollSame = random() < 0.5;
  let qualityFirst: string;
  let qualitySecond: string;
  let answerId: ChordComparisonAnswerId;

  if (rollSame) {
    // Keep the "same" pool coherent with the difficulty setting: only
    // qualities that actually appear in an eligible pair, not the whole
    // enabled pool (which may include unrelated qualities at a low tier).
    const connected = Array.from(new Set(pairs.flatMap((p) => [p.a, p.b])));
    const quality = pick(connected);
    qualityFirst = quality;
    qualitySecond = quality;
    answerId = 'same';
  } else {
    const chosenPair = pick(pairs);
    if (random() < 0.5) {
      qualityFirst = chosenPair.a;
      qualitySecond = chosenPair.b;
    } else {
      qualityFirst = chosenPair.b;
      qualitySecond = chosenPair.a;
    }
    answerId = 'different';
  }

  const rootPcA = Math.floor(random() * 12);
  const rootMidiA = pickChordRootMidi(rootPcA);
  const rootMidiB = settings.rootRelationship === 'same' ? rootMidiA : transposedRoot(rootMidiA);

  const firstDef = chordTypeById(qualityFirst)!;
  const secondDef = chordTypeById(qualitySecond)!;

  return {
    first: { typeId: qualityFirst, label: firstDef.label, rootMidi: rootMidiA },
    second: { typeId: qualitySecond, label: secondDef.label, rootMidi: rootMidiB },
    answerId,
    choiceDefs: getChordComparisonChoiceDefs(),
  };
}
