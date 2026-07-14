import { midiToNoteName, pick } from '../theory';

// Ported verbatim from legacy CHORD_RECOGNITION_* tables / functions
// (docs/05-topics/03-chord-recognition.md). "Do not confuse with the
// progression trainer's chord machinery."
export const CHORD_RECOGNITION_RECIPES: Record<string, number[]> = {
  maj: [0, 4, 7],
  m: [0, 3, 7],
  aug: [0, 4, 8],
  dim: [0, 3, 6],
  sus4: [0, 5, 7],
  sus2: [0, 2, 7], // NEW: added per topic doc §2 (not in legacy) — expansion, not a regression
  maj6: [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  '7': [0, 4, 7, 10],
  dim7: [0, 3, 6, 9],
  '7sus4': [0, 5, 7, 10],
  mMaj7: [0, 3, 7, 11],
  m7b5: [0, 3, 6, 10],
  maj7s5: [0, 4, 8, 11],
  maj7b5: [0, 4, 6, 11],
  '7s5': [0, 4, 8, 10],
  '7b5': [0, 4, 6, 10],
  '7s9': [0, 4, 7, 10, 15],
  '7b9': [0, 4, 7, 10, 13],
  '7alt': [0, 4, 8, 10, 13, 15],
  '7sus4b9': [0, 5, 7, 10, 13],
  maj9: [0, 4, 7, 11, 14],
  m9: [0, 3, 7, 10, 14],
  '9': [0, 4, 7, 10, 14],
  '9sus4': [0, 5, 7, 10, 14],
  maj69: [0, 4, 7, 9, 14],
  m69: [0, 3, 7, 9, 14],
  majadd9: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14],
  m9b5: [0, 3, 6, 10, 14],
  '13': [0, 4, 7, 10, 14, 21],
};

export interface ChordGroupDef {
  id: string;
  title: string;
}

export const CHORD_RECOGNITION_GROUPS: ChordGroupDef[] = [
  { id: 'triads', title: 'Triads' },
  { id: 'sixths', title: 'Sixths' },
  { id: 'sevenths', title: 'Sevenths' },
  { id: 'altered', title: 'Altered & sus dominants' },
  { id: 'ninths', title: 'Ninths & extensions' },
];

export interface ChordTypeDef {
  id: string;
  group: string;
  label: string;
  quality: string;
  default: boolean;
}

export const CHORD_RECOGNITION_TYPES: ChordTypeDef[] = [
  { id: 'maj', group: 'triads', label: 'Major triad', quality: 'maj', default: true },
  { id: 'm', group: 'triads', label: 'Minor triad', quality: 'm', default: true },
  { id: 'aug', group: 'triads', label: 'Augmented', quality: 'aug', default: false },
  { id: 'dim', group: 'triads', label: 'Diminished', quality: 'dim', default: false },
  { id: 'sus4', group: 'triads', label: 'Sus4', quality: 'sus4', default: false },
  { id: 'sus2', group: 'triads', label: 'Sus2', quality: 'sus2', default: false },
  { id: 'maj6', group: 'sixths', label: 'Major 6', quality: 'maj6', default: false },
  { id: 'm6', group: 'sixths', label: 'Minor 6', quality: 'm6', default: false },
  { id: 'maj69', group: 'sixths', label: 'Major 6/9', quality: 'maj69', default: false },
  { id: 'm69', group: 'sixths', label: 'Minor 6/9', quality: 'm69', default: false },
  { id: 'maj7', group: 'sevenths', label: 'Major 7', quality: 'maj7', default: true },
  { id: 'm7', group: 'sevenths', label: 'Minor 7', quality: 'm7', default: true },
  { id: '7', group: 'sevenths', label: 'Dominant 7', quality: '7', default: true },
  { id: 'dim7', group: 'sevenths', label: 'Diminished 7', quality: 'dim7', default: false },
  { id: 'mMaj7', group: 'sevenths', label: 'Minor–major 7', quality: 'mMaj7', default: false },
  { id: 'm7b5', group: 'sevenths', label: 'Minor 7 ♭5', quality: 'm7b5', default: false },
  { id: '7sus4', group: 'altered', label: 'Dominant 7 sus4', quality: '7sus4', default: false },
  { id: 'maj7s5', group: 'altered', label: 'Major 7 ♯5', quality: 'maj7s5', default: false },
  { id: 'maj7b5', group: 'altered', label: 'Major 7 ♭5', quality: 'maj7b5', default: false },
  { id: '7s5', group: 'altered', label: 'Dominant 7 ♯5', quality: '7s5', default: false },
  { id: '7b5', group: 'altered', label: 'Dominant 7 ♭5', quality: '7b5', default: false },
  { id: '7s9', group: 'altered', label: 'Dominant 7 ♯9', quality: '7s9', default: false },
  { id: '7b9', group: 'altered', label: 'Dominant 7 ♭9', quality: '7b9', default: false },
  { id: '7alt', group: 'altered', label: 'Dominant 7 alt', quality: '7alt', default: false },
  { id: '7sus4b9', group: 'altered', label: '7 sus4 ♭9', quality: '7sus4b9', default: false },
  { id: 'maj9', group: 'ninths', label: 'Major 9', quality: 'maj9', default: false },
  { id: 'm9', group: 'ninths', label: 'Minor 9', quality: 'm9', default: false },
  { id: '9', group: 'ninths', label: 'Dominant 9', quality: '9', default: false },
  { id: '9sus4', group: 'ninths', label: 'Dominant 9 sus4', quality: '9sus4', default: false },
  { id: 'majadd9', group: 'ninths', label: 'Major add9', quality: 'majadd9', default: false },
  { id: 'madd9', group: 'ninths', label: 'Minor add9', quality: 'madd9', default: false },
  { id: 'm9b5', group: 'ninths', label: 'Minor 9 ♭5', quality: 'm9b5', default: false },
  { id: '13', group: 'ninths', label: 'Dominant 13', quality: '13', default: false },
];

export const RECOGNITION_MAX_GUESSES = 3;
export const RECOGNITION_AUTO_ADVANCE_MS = 450;

export const CHORD_ROOT_MIDI_MIN = 36; // C2
export const CHORD_ROOT_MIDI_MAX = 72; // C5

export function chordTypeById(id: string): ChordTypeDef | undefined {
  return CHORD_RECOGNITION_TYPES.find((t) => t.id === id);
}

export function pickChordRootMidi(pitchClass: number): number {
  const pc = ((pitchClass % 12) + 12) % 12;
  const choices: number[] = [];
  for (let m = CHORD_ROOT_MIDI_MIN; m <= CHORD_ROOT_MIDI_MAX; m++) {
    if (((m % 12) + 12) % 12 === pc) choices.push(m);
  }
  return choices.length ? pick(choices) : 48;
}

export function getChordRecognitionMidis(rootMidi: number, quality: string): number[] {
  const recipe = CHORD_RECOGNITION_RECIPES[quality] ?? CHORD_RECOGNITION_RECIPES.maj7!;
  return recipe.map((iv) => rootMidi + iv).sort((a, b) => a - b);
}

export function buildChordRecognitionVoicing(rootMidi: number, quality: string): { chord: string[]; bass: null } {
  const midis = getChordRecognitionMidis(rootMidi, quality);
  return { chord: midis.map(midiToNoteName), bass: null };
}

// --- Settings -> question (replaces legacy's DOM-reading chordEl lookups) ---

export interface ChordRecognitionSettings extends Record<string, unknown> {
  enabledTypes: string[];
  playbackStyle: 'block' | 'arp';
  holdLen: number;
  arpNoteLen: number;
  arpGap: number;
  autoAdvance: boolean;
}

export function defaultChordRecognitionSettings(): ChordRecognitionSettings {
  return {
    enabledTypes: CHORD_RECOGNITION_TYPES.filter((t) => t.default).map((t) => t.id),
    playbackStyle: 'block',
    holdLen: 1.4,
    arpNoteLen: 0.45,
    arpGap: 0.1,
    autoAdvance: false,
  };
}

export interface ChordChoiceItem {
  id: string;
  label: string;
  btnClass: string;
}

export interface ChordChoiceGroup {
  title: string;
  items: ChordChoiceItem[];
}

export function buildChordExamChoiceGrouped(enabledIds: string[]): ChordChoiceGroup[] {
  const grouped: ChordChoiceGroup[] = [];
  CHORD_RECOGNITION_GROUPS.forEach((grp) => {
    const types = CHORD_RECOGNITION_TYPES.filter((t) => t.group === grp.id && enabledIds.indexOf(t.id) >= 0);
    if (!types.length) return;
    grouped.push({
      title: grp.title,
      items: types.map((def) => ({ id: def.id, label: def.label, btnClass: 'chord-choice' })),
    });
  });
  return grouped;
}

export interface ChordQuestion {
  id: string;
  label: string;
  quality: string;
  rootPc: number;
  rootMidi: number;
  rootName: string;
  answerId: string;
  answerLabel: string;
  choiceGrouped: ChordChoiceGroup[];
  playback: { style: 'block' | 'arp'; holdLen: number; arpNoteLen: number; arpGap: number };
  promptDetail: string;
}

export function buildChordQuestion(settings: ChordRecognitionSettings): ChordQuestion | null {
  const ids = settings.enabledTypes;
  if (!ids.length) return null;
  const id = pick(ids);
  const def = chordTypeById(id);
  if (!def) return null;
  const rootPc = Math.floor(Math.random() * 12);
  const rootMidi = pickChordRootMidi(rootPc);
  return {
    id: def.id,
    label: def.label,
    quality: def.quality,
    rootPc,
    rootMidi,
    rootName: midiToNoteName(rootMidi),
    answerId: def.id,
    answerLabel: def.label,
    choiceGrouped: buildChordExamChoiceGrouped(ids),
    playback: {
      style: settings.playbackStyle,
      holdLen: settings.holdLen,
      arpNoteLen: settings.arpNoteLen,
      arpGap: settings.arpGap,
    },
    promptDetail: def.label,
  };
}

export function pickChordQuestion(settings: ChordRecognitionSettings): ChordQuestion | null {
  if (!settings.enabledTypes.length) return null;
  return buildChordQuestion(settings);
}
