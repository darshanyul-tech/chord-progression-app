// Shared constants/helpers for Arranging exercise generators.
import { midiToDisplay, type Spelling } from '../../lib/arranging/pitch';

export interface RootDef {
  pc: number;
  name: string;
  spelling: Spelling;
}

export const ROOTS: RootDef[] = [
  { pc: 0, name: 'C', spelling: 'sharp' },
  { pc: 1, name: 'D♭', spelling: 'flat' },
  { pc: 2, name: 'D', spelling: 'sharp' },
  { pc: 3, name: 'E♭', spelling: 'flat' },
  { pc: 4, name: 'E', spelling: 'sharp' },
  { pc: 5, name: 'F', spelling: 'flat' },
  { pc: 6, name: 'G♭', spelling: 'flat' },
  { pc: 7, name: 'G', spelling: 'sharp' },
  { pc: 8, name: 'A♭', spelling: 'flat' },
  { pc: 9, name: 'A', spelling: 'sharp' },
  { pc: 10, name: 'B♭', spelling: 'flat' },
  { pc: 11, name: 'B', spelling: 'sharp' },
];

export function rootByPc(pc: number): RootDef {
  return ROOTS.find((r) => r.pc === ((pc % 12) + 12) % 12)!;
}

// Chord-quality option definitions. `suffix` is appended to a root name to form a
// symbol the parser understands; `label` is the settings-panel label.
export interface QualityDef {
  value: string;
  label: string;
  suffix: string;
}

export const QUALITIES: QualityDef[] = [
  { value: 'maj7', label: 'maj7', suffix: 'ma7' },
  { value: 'mi7', label: 'mi7', suffix: 'mi7' },
  { value: 'dom7', label: 'dom7', suffix: '7' },
  { value: 'mi7b5', label: 'mi7♭5', suffix: 'mi7b5' },
  { value: 'ext-dom', label: 'extended dominant', suffix: '13' },
  { value: 'alt-dom', label: 'altered dominant', suffix: '7(♯9)' },
];

export function qualityDef(value: string): QualityDef | undefined {
  return QUALITIES.find((q) => q.value === value);
}

export function chordSymbol(root: RootDef, qualitySuffix: string): string {
  return `${root.name}${qualitySuffix}`;
}

/** "top to bottom: G4, E♭4, C4, B♭3" for a top-down pitch array. */
export function formatVoicingList(pitchesTopDown: number[], spelling: Spelling): string {
  return pitchesTopDown.map((m) => midiToDisplay(m, spelling)).join(', ');
}

export function midisMultisetEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}
