import { NOTE_NAMES, pick } from '../theory';
import { SCALES, type ScaleDef } from './theory';

// Persisted settings shape (docs/05-topics/06-chord-progressions.md §2 storage schema).
export interface ProgressionSettings extends Record<string, unknown> {
  randomKey: boolean;
  keyCenter: string;
  tonality: 'major' | 'minor';
  minorVm7: boolean;
  minorV7: boolean;
  extensions: number[];
  rootless: boolean;
  bouncingBass: boolean;
  diatonicOnly: boolean;
  allowSubdominant: boolean;
  chromatic: boolean;
  chromaticCount: number;
  cadence: boolean;
  tonicFirst: boolean;
  tempo: number;
  bars: number;
  inversions: boolean;
  customMode: boolean;
}

export function defaultProgressionSettings(): ProgressionSettings {
  return {
    randomKey: false,
    keyCenter: 'C',
    tonality: 'major',
    minorVm7: true,
    minorV7: false,
    extensions: [7],
    rootless: false,
    bouncingBass: false,
    diatonicOnly: true,
    allowSubdominant: true,
    chromatic: false,
    chromaticCount: 1,
    cadence: true,
    tonicFirst: false,
    tempo: 90,
    bars: 4,
    inversions: false,
    customMode: false,
  };
}

// Fully-resolved settings used by the generator/grader/player for one
// generate-or-play cycle (mirrors legacy getSettings(), which additionally
// resolves a concrete key each call when randomKey is on).
export interface ResolvedProgressionSettings {
  key: string;
  keyPc: number;
  tonality: 'major' | 'minor';
  scale: ScaleDef;
  minorVm7: boolean;
  minorV7: boolean;
  randomKey: boolean;
  tonicFirst: boolean;
  diatonicOnly: boolean;
  useSubdominant: boolean;
  cadenceEnd: boolean;
  chromaticism: boolean;
  chromaticCount: number;
  rootless: boolean;
  bouncingBass: boolean;
  inversions: boolean;
  bars: number;
  bpm: number;
  extensions: number[];
}

export function resolvePracticeSettings(settings: ProgressionSettings): ResolvedProgressionSettings {
  let extensions = settings.extensions.slice();
  if (!extensions.length) extensions = [3];

  const key = settings.randomKey ? pick(NOTE_NAMES) : settings.keyCenter;
  const diatonicOnly = settings.diatonicOnly;
  const chromaticism = !diatonicOnly && settings.chromatic;

  return {
    key,
    keyPc: NOTE_NAMES.indexOf(key),
    tonality: settings.tonality,
    scale: SCALES[settings.tonality],
    minorVm7: settings.tonality === 'minor' && settings.minorVm7,
    minorV7: settings.tonality === 'minor' && settings.minorV7,
    randomKey: settings.randomKey,
    tonicFirst: settings.tonicFirst,
    diatonicOnly,
    useSubdominant: diatonicOnly ? true : settings.allowSubdominant,
    cadenceEnd: settings.cadence,
    chromaticism,
    chromaticCount: chromaticism ? settings.chromaticCount : 0,
    rootless: settings.rootless,
    bouncingBass: settings.bouncingBass,
    inversions: settings.inversions,
    bars: settings.bars,
    bpm: settings.tempo,
    extensions,
  };
}

// The exact settings fields that, per legacy wiring, auto-regenerate a fresh
// progression when changed (everything except tempo and bouncing bass).
export const HARMONY_REGEN_KEYS: (keyof ProgressionSettings)[] = [
  'keyCenter',
  'tonality',
  'minorVm7',
  'minorV7',
  'tonicFirst',
  'diatonicOnly',
  'allowSubdominant',
  'cadence',
  'chromatic',
  'chromaticCount',
  'rootless',
  'inversions',
  'extensions',
  'randomKey',
];
