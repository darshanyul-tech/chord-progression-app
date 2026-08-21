import { midiToNoteName, pick, random } from '../theory';
import { lowIntervalLimitMidi } from './lowIntervalLimit';

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
  mMaj9: [0, 3, 7, 11, 14], // Min(maj9)
  '7s5b9': [0, 4, 8, 10, 13], // Dom7(#5 b9)
  '7s5s9': [0, 4, 8, 10, 15], // Dom7(#5 #9)
  m11: [0, 3, 7, 10, 14, 17], // Minor 11
  dom11: [0, 5, 7, 10, 14], // Dominant 11 — voiced as Dom9sus4 (3rd omitted so it doesn't clash with the 11)
  maj9s11: [0, 4, 7, 11, 14, 18], // Maj9(#11)
  '9s11': [0, 4, 7, 10, 14, 18], // Dom9(#11)
};

export interface ChordGroupDef {
  id: string;
  title: string;
}

export const CHORD_RECOGNITION_GROUPS: ChordGroupDef[] = [
  { id: 'triads', title: 'Triads' },
  { id: 'sixths', title: '6th Chords' },
  { id: 'sevenths', title: '7th Chords' },
  { id: 'varied7', title: 'Varied 7th Chords' },
  { id: 'ninths', title: '9th Chords' },
  { id: 'varied9', title: 'Varied 9th Chords' },
  { id: 'elevenths', title: '11th Chords' },
  { id: 'varied11', title: 'Varied 11th Chords' },
];

export interface ChordTypeDef {
  id: string;
  group: string;
  label: string;
  quality: string;
  default: boolean;
  // When true, a thin divider is drawn before this chord within its group —
  // used to set the extra chords apart from the requested taxonomy.
  dividerBefore?: boolean;
}

export const CHORD_RECOGNITION_TYPES: ChordTypeDef[] = [
  // Triads
  { id: 'maj', group: 'triads', label: 'Major triad', quality: 'maj', default: true },
  { id: 'm', group: 'triads', label: 'Minor triad', quality: 'm', default: true },
  { id: 'aug', group: 'triads', label: 'Augmented', quality: 'aug', default: false },
  { id: 'dim', group: 'triads', label: 'Diminished', quality: 'dim', default: false },
  { id: 'sus4', group: 'triads', label: 'Suspended', quality: 'sus4', default: false },
  // Extra beyond the requested set — sus2 also lives in Triads.
  { id: 'sus2', group: 'triads', label: 'Sus2', quality: 'sus2', default: false, dividerBefore: true },
  // 6th Chords
  { id: 'maj6', group: 'sixths', label: 'Major 6', quality: 'maj6', default: false },
  { id: 'm6', group: 'sixths', label: 'Minor 6', quality: 'm6', default: false },
  // 7th Chords
  { id: 'maj7', group: 'sevenths', label: 'Major 7', quality: 'maj7', default: true },
  { id: 'm7', group: 'sevenths', label: 'Minor 7', quality: 'm7', default: true },
  { id: '7', group: 'sevenths', label: 'Dominant 7', quality: '7', default: true },
  { id: 'dim7', group: 'sevenths', label: 'Diminished 7', quality: 'dim7', default: false },
  { id: '7sus4', group: 'sevenths', label: 'Dominant 7 sus4', quality: '7sus4', default: false },
  { id: 'mMaj7', group: 'sevenths', label: 'Minor–major 7', quality: 'mMaj7', default: false },
  // Varied 7th Chords
  { id: 'm7b5', group: 'varied7', label: 'Minor 7 ♭5', quality: 'm7b5', default: false },
  { id: 'maj7s5', group: 'varied7', label: 'Major 7 ♯5', quality: 'maj7s5', default: false },
  { id: 'maj7b5', group: 'varied7', label: 'Major 7 ♭5', quality: 'maj7b5', default: false },
  { id: '7s5', group: 'varied7', label: 'Dominant 7 ♯5 (aug 7)', quality: '7s5', default: false },
  { id: '7b5', group: 'varied7', label: 'Dominant 7 ♭5', quality: '7b5', default: false },
  // 9th Chords
  { id: 'majadd9', group: 'ninths', label: 'Major add9', quality: 'majadd9', default: false },
  { id: 'madd9', group: 'ninths', label: 'Minor add9', quality: 'madd9', default: false },
  { id: 'maj9', group: 'ninths', label: 'Major 9', quality: 'maj9', default: false },
  { id: 'm9', group: 'ninths', label: 'Minor 9', quality: 'm9', default: false },
  { id: '9', group: 'ninths', label: 'Dominant 9', quality: '9', default: false },
  { id: '9sus4', group: 'ninths', label: 'Dominant 9 sus4', quality: '9sus4', default: false },
  { id: 'mMaj9', group: 'ninths', label: 'Minor–major 9', quality: 'mMaj9', default: false },
  { id: 'maj69', group: 'ninths', label: 'Major 6/9', quality: 'maj69', default: false },
  { id: 'm69', group: 'ninths', label: 'Minor 6/9', quality: 'm69', default: false },
  // Varied 9th Chords
  { id: '7s9', group: 'varied9', label: 'Dominant 7 ♯9', quality: '7s9', default: false },
  { id: '7b9', group: 'varied9', label: 'Dominant 7 ♭9', quality: '7b9', default: false },
  { id: '7s5b9', group: 'varied9', label: 'Dominant 7 ♯5 ♭9', quality: '7s5b9', default: false },
  { id: '7s5s9', group: 'varied9', label: 'Dominant 7 ♯5 ♯9', quality: '7s5s9', default: false },
  { id: '7sus4b9', group: 'varied9', label: 'Dominant 7 sus4 ♭9', quality: '7sus4b9', default: false },
  // Extras beyond the requested set — other varied dominant/ninth colours.
  { id: '7alt', group: 'varied9', label: 'Dominant 7 alt', quality: '7alt', default: false, dividerBefore: true },
  { id: 'm9b5', group: 'varied9', label: 'Minor 9 ♭5', quality: 'm9b5', default: false },
  // 11th Chords
  { id: 'm11', group: 'elevenths', label: 'Minor 11', quality: 'm11', default: false },
  { id: 'dom11', group: 'elevenths', label: 'Dominant 11 (9sus4)', quality: 'dom11', default: false },
  // Extra beyond the requested set — Dominant 13.
  { id: '13', group: 'elevenths', label: 'Dominant 13', quality: '13', default: false, dividerBefore: true },
  // Varied 11th Chords
  { id: 'maj9s11', group: 'varied11', label: 'Major 9 ♯11', quality: 'maj9s11', default: false },
  { id: '9s11', group: 'varied11', label: 'Dominant 9 ♯11', quality: '9s11', default: false },
];

// --- Inversion chords (separate "Inversions" section of the topic) ---
// The learner names both the quality and the inversion. Each base chord can be
// played root position up to a max inversion (7th chords → 2nd, 9th chords →
// 3rd), and the user ticks which inversions are in play per subsection.
export type InversionSubsection = 'sevenths' | 'ninths';

export interface InversionChordDef {
  id: string;
  label: string;
  quality: string;
  subsection: InversionSubsection;
}

export const INVERSION_CHORDS: InversionChordDef[] = [
  { id: 'maj7', label: 'Maj7', quality: 'maj7', subsection: 'sevenths' },
  { id: 'm7', label: 'Min7', quality: 'm7', subsection: 'sevenths' },
  { id: '7', label: 'Dom7', quality: '7', subsection: 'sevenths' },
  { id: 'maj9', label: 'Maj9', quality: 'maj9', subsection: 'ninths' },
  { id: 'm9', label: 'Min9', quality: 'm9', subsection: 'ninths' },
  { id: '9', label: 'Dom9', quality: '9', subsection: 'ninths' },
];

// Root position (0) plus every inversion each subsection reaches.
export const SEVENTH_INVERSIONS = [0, 1, 2];
export const NINTH_INVERSIONS = [0, 1, 2, 3];
export const INVERSION_LABELS = ['Root', '1st inv', '2nd inv', '3rd inv'];

export function inversionsForSubsection(sub: InversionSubsection): number[] {
  return sub === 'sevenths' ? SEVENTH_INVERSIONS : NINTH_INVERSIONS;
}

// The enabled inversion chords (quality chips), in section order.
export function enabledInversionQualities(inversionChords: string[]): InversionChordDef[] {
  return INVERSION_CHORDS.filter((c) => inversionChords.includes(c.id));
}

// The inversions actually reachable per subsection (the subsection's cap ∩ the
// user's ticks), for the two-part guess picker.
export function enabledInversionsBySubsection(
  seventhInversions: number[],
  ninthInversions: number[],
): { sevenths: number[]; ninths: number[] } {
  const clamp = (sub: InversionSubsection, ticked: number[]) =>
    inversionsForSubsection(sub).filter((n) => ticked.includes(n));
  return { sevenths: clamp('sevenths', seventhInversions), ninths: clamp('ninths', ninthInversions) };
}

export interface InversionCombo {
  id: string; // e.g. "inv:maj7:2"
  quality: string;
  inversion: number;
  label: string; // e.g. "Maj7 · 2nd inv"
  subsection: InversionSubsection;
}

// Every enabled (chord × inversion) pair, in section order (7ths then 9ths).
export function enabledInversionCombos(settings: ChordRecognitionSettings): InversionCombo[] {
  const out: InversionCombo[] = [];
  INVERSION_CHORDS.forEach((chord) => {
    if (!settings.inversionChords.includes(chord.id)) return;
    const enabled = chord.subsection === 'sevenths' ? settings.seventhInversions : settings.ninthInversions;
    inversionsForSubsection(chord.subsection).forEach((inv) => {
      if (!enabled.includes(inv)) return;
      out.push({
        id: `inv:${chord.quality}:${inv}`,
        quality: chord.quality,
        inversion: inv,
        label: `${chord.label} · ${INVERSION_LABELS[inv]}`,
        subsection: chord.subsection,
      });
    });
  });
  return out;
}

export const RECOGNITION_MAX_GUESSES = 3;
export const RECOGNITION_AUTO_ADVANCE_MS = 450;

export const CHORD_ROOT_MIDI_MIN = 36; // C2
export const CHORD_ROOT_MIDI_MAX = 72; // C5

export function chordTypeById(id: string): ChordTypeDef | undefined {
  return CHORD_RECOGNITION_TYPES.find((t) => t.id === id);
}

export function pickChordRootMidi(pitchClass: number, minMidi: number = CHORD_ROOT_MIDI_MIN): number {
  const pc = ((pitchClass % 12) + 12) % 12;
  const lo = Math.max(CHORD_ROOT_MIDI_MIN, minMidi);
  const choices: number[] = [];
  for (let m = lo; m <= CHORD_ROOT_MIDI_MAX; m++) {
    if (((m % 12) + 12) % 12 === pc) choices.push(m);
  }
  return choices.length ? pick(choices) : lo;
}

// The lowest root at which this chord (in this inversion) clears the low
// interval limit of its BOTTOM interval — so nothing is voiced low enough to
// turn muddy. Bottom interval and bass offset are transposition-invariant, so
// the reference root cancels out. Callers pass the result as the floor to
// pickChordRootMidi, which keeps a chord no lower than it should sound while
// still letting wide-bottomed chords (e.g. major triads) sit lower than tight
// ones (e.g. sus2). See lowIntervalLimit.ts.
export function minRootForChord(quality: string, inversion = 0): number {
  const ref = 60;
  const midis = getChordRecognitionMidis(ref, quality, inversion);
  if (midis.length < 2) return CHORD_ROOT_MIDI_MIN;
  const bottomInterval = midis[1]! - midis[0]!;
  const bassOffset = midis[0]! - ref; // 0 in root position, >0 for inversions
  const min = lowIntervalLimitMidi(bottomInterval) - bassOffset;
  return Math.max(CHORD_ROOT_MIDI_MIN, min);
}

export function getChordRecognitionMidis(rootMidi: number, quality: string, inversion = 0): number[] {
  const recipe = CHORD_RECOGNITION_RECIPES[quality] ?? CHORD_RECOGNITION_RECIPES.maj7!;
  const midis = recipe.map((iv) => rootMidi + iv).sort((a, b) => a - b);
  // Nth inversion: lift the lowest N chord tones up an octave, so the bass note
  // becomes the (N+1)th chord tone (1st inv → 3rd in bass, 2nd → 5th, 3rd → 7th).
  for (let i = 0; i < inversion; i++) {
    const low = midis.shift()!;
    midis.push(low + 12);
    midis.sort((a, b) => a - b);
  }
  return midis;
}

export function buildChordRecognitionVoicing(rootMidi: number, quality: string): { chord: string[]; bass: null } {
  const midis = getChordRecognitionMidis(rootMidi, quality);
  return { chord: midis.map(midiToNoteName), bass: null };
}

// --- Settings -> question (replaces legacy's DOM-reading chordEl lookups) ---

export interface ChordRecognitionSettings extends Record<string, unknown> {
  enabledTypes: string[];
  // Inversions section: which base chords are in play, and which inversions are
  // ticked for each subsection (7ths reach 2nd, 9ths reach 3rd; 0 = root).
  inversionChords: string[];
  seventhInversions: number[];
  ninthInversions: number[];
  playbackStyle: 'block' | 'arp';
  holdLen: number;
  arpNoteLen: number;
  arpGap: number;
  autoAdvance: boolean;
}

export function defaultChordRecognitionSettings(): ChordRecognitionSettings {
  return {
    enabledTypes: CHORD_RECOGNITION_TYPES.filter((t) => t.default).map((t) => t.id),
    inversionChords: [],
    seventhInversions: [1, 2],
    ninthInversions: [1, 2, 3],
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
  dividerBefore?: boolean;
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
      items: types.map((def, i) => ({
        id: def.id,
        label: def.label,
        btnClass: 'chord-choice',
        // Only carry the divider when something enabled precedes it in this
        // group — a leading divider would look stray.
        dividerBefore: def.dividerBefore && i > 0,
      })),
    });
  });
  return grouped;
}

// Full answer set for the topic: the plain quality groups plus an "Inversion
// chords" group of every enabled quality×inversion combo (7ths, a divider, 9ths).
export function buildChordChoiceGroups(settings: ChordRecognitionSettings): ChordChoiceGroup[] {
  const grouped = buildChordExamChoiceGrouped(settings.enabledTypes);
  const combos = enabledInversionCombos(settings);
  if (combos.length) {
    const firstNinthIdx = combos.findIndex((c) => c.subsection === 'ninths');
    grouped.push({
      title: 'Inversion chords',
      items: combos.map((c, i) => ({
        id: c.id,
        label: c.label,
        btnClass: 'chord-choice',
        // Divider splits the 7th-chord inversions from the 9th-chord ones.
        dividerBefore: i === firstNinthIdx && firstNinthIdx > 0,
      })),
    });
  }
  return grouped;
}

export interface ChordQuestion {
  id: string;
  label: string;
  quality: string;
  // 0 for the plain quality groups; ≥1 when the question is an inversion.
  inversion: number;
  rootPc: number;
  rootMidi: number;
  rootName: string;
  answerId: string;
  answerLabel: string;
  choiceGrouped: ChordChoiceGroup[];
  playback: { style: 'block' | 'arp'; holdLen: number; arpNoteLen: number; arpGap: number };
  promptDetail: string;
}

// One entry per pickable answer — a plain quality or a quality×inversion combo.
interface ChordPoolEntry {
  id: string;
  label: string;
  quality: string;
  inversion: number;
}

export function chordQuestionPool(settings: ChordRecognitionSettings): ChordPoolEntry[] {
  const plain: ChordPoolEntry[] = settings.enabledTypes
    .map((id) => chordTypeById(id))
    .filter((d): d is ChordTypeDef => !!d)
    .map((d) => ({ id: d.id, label: d.label, quality: d.quality, inversion: 0 }));
  const inverted: ChordPoolEntry[] = enabledInversionCombos(settings).map((c) => ({
    id: c.id,
    label: c.label,
    quality: c.quality,
    inversion: c.inversion,
  }));
  return [...plain, ...inverted];
}

export function buildChordQuestion(settings: ChordRecognitionSettings): ChordQuestion | null {
  const pool = chordQuestionPool(settings);
  if (!pool.length) return null;
  const picked = pick(pool);
  const rootPc = Math.floor(random() * 12);
  const rootMidi = pickChordRootMidi(rootPc, minRootForChord(picked.quality, picked.inversion));
  return {
    id: picked.id,
    label: picked.label,
    quality: picked.quality,
    inversion: picked.inversion,
    rootPc,
    rootMidi,
    rootName: midiToNoteName(rootMidi),
    answerId: picked.id,
    answerLabel: picked.label,
    choiceGrouped: buildChordChoiceGroups(settings),
    playback: {
      style: settings.playbackStyle,
      holdLen: settings.holdLen,
      arpNoteLen: settings.arpNoteLen,
      arpGap: settings.arpGap,
    },
    promptDetail: picked.label,
  };
}

export function pickChordQuestion(settings: ChordRecognitionSettings): ChordQuestion | null {
  return buildChordQuestion(settings);
}
