// Tier-1 builder for Theory Topic 02 — Key Signatures (docs/15-theory-topics/02).
import type { Clef } from '../melody/theory';
import { pick } from '../theory';
import { keysWithin, theoryKeyById, THEORY_KEYS, type KeyMode } from './keys';

// Structurally identical to components/ChoiceGrid's ChoiceDef — declared
// locally, not imported, since src/lib may not import from src/components
// (Tier-1 firewall, D15).
export interface KeySignatureChoice {
  id: string;
  label: string;
}

export type KeySignatureAskFor = 'major' | 'minor' | 'both';

export interface KeySignatureSettings extends Record<string, unknown> {
  askFor: KeySignatureAskFor;
  maxAccidentals: number;
  clefs: Clef[];
  autoAdvance: boolean;
}

export function defaultKeySignatureSettings(): KeySignatureSettings {
  return { askFor: 'both', maxAccidentals: 5, clefs: ['treble', 'bass'], autoAdvance: false };
}

export interface KeySignatureQuestion {
  clef: Clef;
  /** Always the major relative's spec — display is mode-independent (docs/15-theory-topics/02 §3). */
  vexKeySpec: string;
  askMode: KeyMode;
  answerId: string;
  accidentalCount: number;
  majorLabel: string;
  minorLabel: string;
}

export function buildKeySignatureQuestion(settings: KeySignatureSettings): KeySignatureQuestion | null {
  if (!settings.clefs.length) return null;
  const askMode: KeyMode = settings.askFor === 'both' ? pick<KeyMode>(['major', 'minor']) : settings.askFor;
  const pool = keysWithin(settings.maxAccidentals, askMode);
  if (!pool.length) return null;
  const key = pick(pool);
  const majorKey = key.mode === 'major' ? key : theoryKeyById(key.relativeId);
  const minorKey = key.mode === 'minor' ? key : theoryKeyById(key.relativeId);
  return {
    clef: pick(settings.clefs),
    vexKeySpec: majorKey.vexKeySpec,
    askMode,
    answerId: key.id,
    accidentalCount: key.accidentalCount,
    majorLabel: majorKey.label,
    minorLabel: minorKey.label,
  };
}

/** Fixed full grid of all 15 keys of the asked mode (docs §3) — the answer space never shrinks with the accidental-count slider. */
export function buildKeySignatureChoices(askMode: KeyMode): KeySignatureChoice[] {
  return THEORY_KEYS.filter((k) => k.mode === askMode).map((k) => ({ id: k.id, label: k.label }));
}
