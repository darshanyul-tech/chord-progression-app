// Scale-degree naming (docs/14-theory-engine.md §5) — mode-aware: degree 7 is
// the leading note in major (a semitone below the tonic) but the subtonic in
// natural minor (a whole tone below), a deliberate teaching detail.

import type { KeyMode } from './keys';

const COMMON_NAMES = ['Tonic', 'Supertonic', 'Mediant', 'Subdominant', 'Dominant', 'Submediant'];

export function DEGREE_NAMES(mode: KeyMode): string[] {
  return [...COMMON_NAMES, mode === 'major' ? 'Leading note' : 'Subtonic'];
}
