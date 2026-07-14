import { midiToNoteName, pick } from '../theory';

// Ported verbatim from legacy SCALE_RECOGNITION_* tables / functions
// (docs/05-topics/02-scales.md).
export interface ScaleGroupDef {
  id: string;
  title: string;
}

export const SCALE_RECOGNITION_GROUPS: ScaleGroupDef[] = [
  { id: 'majorModes', title: 'Major modes' },
  { id: 'melodicMinorModes', title: 'Melodic minor modes' },
  { id: 'minorScales', title: 'Minor scales' },
  { id: 'fiveSixNote', title: '5 & 6 note scales' },
  { id: 'eightNote', title: '8 note scales' },
];

export interface ScaleTypeDef {
  id: string;
  group: string;
  label: string;
  intervals: number[];
  default: boolean;
}

export const SCALE_RECOGNITION_TYPES: ScaleTypeDef[] = [
  { id: 'ionian', group: 'majorModes', label: 'Ionian (major)', intervals: [0, 2, 4, 5, 7, 9, 11], default: true },
  { id: 'dorian', group: 'majorModes', label: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10], default: true },
  { id: 'phrygian', group: 'majorModes', label: 'Phrygian', intervals: [0, 1, 3, 5, 7, 8, 10], default: false },
  { id: 'lydian', group: 'majorModes', label: 'Lydian', intervals: [0, 2, 4, 6, 7, 9, 11], default: false },
  { id: 'mixolydian', group: 'majorModes', label: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10], default: true },
  { id: 'aeolian', group: 'majorModes', label: 'Aeolian', intervals: [0, 2, 3, 5, 7, 8, 10], default: true },
  { id: 'locrian', group: 'majorModes', label: 'Locrian', intervals: [0, 1, 3, 5, 6, 8, 10], default: false },
  {
    id: 'locrianSharp2',
    group: 'melodicMinorModes',
    label: 'Locrian ♯2',
    intervals: [0, 2, 3, 5, 6, 8, 10],
    default: false,
  },
  {
    id: 'dorianFlat2',
    group: 'melodicMinorModes',
    label: 'Dorian ♭2',
    intervals: [0, 1, 3, 5, 7, 9, 10],
    default: false,
  },
  {
    id: 'altered',
    group: 'melodicMinorModes',
    label: 'Altered scale',
    intervals: [0, 1, 3, 4, 6, 8, 10],
    default: false,
  },
  {
    id: 'lydianDominant',
    group: 'melodicMinorModes',
    label: 'Lydian dominant',
    intervals: [0, 2, 4, 6, 7, 9, 10],
    default: false,
  },
  {
    id: 'mixolydianFlat6',
    group: 'melodicMinorModes',
    label: 'Mixolydian ♭6',
    intervals: [0, 2, 4, 5, 7, 8, 10],
    default: false,
  },
  { id: 'harmonicMinor', group: 'minorScales', label: 'Harmonic minor', intervals: [0, 2, 3, 5, 7, 8, 11], default: false },
  { id: 'jazzMinor', group: 'minorScales', label: 'Jazz minor', intervals: [0, 2, 3, 5, 7, 9, 11], default: false },
  { id: 'majPent', group: 'fiveSixNote', label: 'Major pentatonic', intervals: [0, 2, 4, 7, 9], default: false },
  { id: 'minPent', group: 'fiveSixNote', label: 'Minor pentatonic', intervals: [0, 3, 5, 7, 10], default: false },
  { id: 'blues', group: 'fiveSixNote', label: 'Blues scale', intervals: [0, 3, 5, 6, 7, 10], default: false },
  { id: 'majBebop', group: 'eightNote', label: 'Major bebop', intervals: [0, 2, 4, 5, 7, 8, 9, 11], default: false },
  {
    id: 'domBebop',
    group: 'eightNote',
    label: 'Dominant bebop',
    intervals: [0, 2, 4, 5, 7, 9, 10, 11],
    default: false,
  },
  { id: 'dom8', group: 'eightNote', label: 'Dominant 8-note', intervals: [0, 2, 4, 5, 7, 9, 10, 11], default: false },
  {
    id: 'diminished',
    group: 'eightNote',
    label: 'Diminished (whole–half)',
    intervals: [0, 2, 3, 5, 6, 8, 9, 11],
    default: false,
  },
];

export const RECOGNITION_MAX_GUESSES = 3;
export const RECOGNITION_AUTO_ADVANCE_MS = 450;
export const RECOGNITION_ROOT_MIDI_MIN = 36; // C2
export const RECOGNITION_ROOT_MIDI_MAX = 72; // C5
export const RECOGNITION_MAX_TOP_MIDI = 84; // keep scale tops below ~C6

export function scaleTypeById(id: string): ScaleTypeDef | undefined {
  return SCALE_RECOGNITION_TYPES.find((t) => t.id === id);
}

export function scaleIntervalsWithOctave(intervals: number[]): number[] {
  const steps = intervals.slice();
  if (steps[steps.length - 1] !== 12) steps.push(12);
  return steps;
}

export function buildScalePlaybackMidis(rootMidi: number, intervals: number[], descend: boolean): number[] {
  const steps = scaleIntervalsWithOctave(intervals);
  const up = steps.map((iv) => rootMidi + iv);
  if (!descend) return up;
  const down: number[] = [];
  for (let i = up.length - 2; i >= 0; i--) down.push(up[i]!);
  return up.concat(down);
}

export function pickScaleRootMidi(intervals: number[]): number {
  const steps = scaleIntervalsWithOctave(intervals);
  const span = steps[steps.length - 1]!;
  const maxRoot = Math.min(RECOGNITION_ROOT_MIDI_MAX, RECOGNITION_MAX_TOP_MIDI - span);
  const choices: number[] = [];
  for (let m = RECOGNITION_ROOT_MIDI_MIN; m <= maxRoot; m++) choices.push(m);
  return choices.length ? pick(choices) : RECOGNITION_ROOT_MIDI_MIN;
}

// --- Settings -> question (replaces legacy's DOM-reading scaleEl lookups) ---

export interface ScaleRecognitionSettings extends Record<string, unknown> {
  enabledScales: string[];
  descend: boolean;
  noteLen: number;
  noteGap: number;
  autoAdvance: boolean;
}

export function defaultScaleRecognitionSettings(): ScaleRecognitionSettings {
  return {
    enabledScales: SCALE_RECOGNITION_TYPES.filter((t) => t.default).map((t) => t.id),
    descend: false,
    noteLen: 0.4,
    noteGap: 0.08,
    autoAdvance: false,
  };
}

export interface ScaleChoiceItem {
  id: string;
  label: string;
  btnClass: string;
}

export interface ScaleChoiceGroup {
  title: string;
  items: ScaleChoiceItem[];
}

export function buildScaleExamChoiceGrouped(enabledIds: string[]): ScaleChoiceGroup[] {
  const grouped: ScaleChoiceGroup[] = [];
  SCALE_RECOGNITION_GROUPS.forEach((grp) => {
    const types = SCALE_RECOGNITION_TYPES.filter((t) => t.group === grp.id && enabledIds.indexOf(t.id) >= 0);
    if (!types.length) return;
    grouped.push({
      title: grp.title,
      items: types.map((def) => ({ id: def.id, label: def.label, btnClass: 'chord-choice' })),
    });
  });
  return grouped;
}

export interface ScaleQuestion {
  id: string;
  label: string;
  intervals: number[];
  rootMidi: number;
  rootName: string;
  answerId: string;
  answerLabel: string;
  choiceGrouped: ScaleChoiceGroup[];
  playback: { noteLen: number; gap: number; descend: boolean };
  promptDetail: string;
}

export function buildScaleQuestion(settings: ScaleRecognitionSettings): ScaleQuestion | null {
  const ids = settings.enabledScales;
  if (!ids.length) return null;
  const id = pick(ids);
  const def = scaleTypeById(id);
  if (!def) return null;
  const rootMidi = pickScaleRootMidi(def.intervals);
  return {
    id: def.id,
    label: def.label,
    intervals: def.intervals,
    rootMidi,
    rootName: midiToNoteName(rootMidi),
    answerId: def.id,
    answerLabel: def.label,
    choiceGrouped: buildScaleExamChoiceGrouped(ids),
    playback: { noteLen: settings.noteLen, gap: settings.noteGap, descend: settings.descend },
    promptDetail: def.label,
  };
}

export function pickScaleQuestion(settings: ScaleRecognitionSettings): ScaleQuestion | null {
  if (!settings.enabledScales.length) return null;
  return buildScaleQuestion(settings);
}
