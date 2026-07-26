// Arranging engine — taxonomies and reference lists (ARR spec §5.6).

export const TEXTURES = [
  { id: 'monophonic', label: 'Monophonic', definition: 'Solo, unison, or unison octaves.' },
  { id: 'homophonic', label: 'Homophonic', definition: 'Mono-rhythmic harmony — melody harmonised in 3rds or 6ths, or a drop-2 voicing.' },
  { id: 'polyphonic', label: 'Polyphonic', definition: 'Countermelody and independent lines.' },
] as const;
export type TextureId = (typeof TEXTURES)[number]['id'];

export const APPROACH_NOTE_TYPES = [
  { id: 'chromatic', label: 'Chromatic', definition: 'A half step to the target.' },
  { id: 'scale', label: 'Scale', definition: 'Diatonically, from the chord scale.' },
  { id: 'double-chromatic', label: 'Double chromatic', definition: 'Two consecutive chromatic steps.' },
  { id: 'indirect', label: 'Indirect', definition: 'From both sides / via an intervening note.' },
] as const;
export type ApproachNoteType = (typeof APPROACH_NOTE_TYPES)[number]['id'];

export const REHARMONISATION_TECHNIQUES = [
  { id: 'diatonic', label: 'Diatonic', definition: 'Harmonise approach tones with notes from the target/tonal-centre chord scales.' },
  { id: 'dominant', label: 'Dominant', definition: 'Harmonise from the chord scale of a (secondary) dominant to the target; combinable with tritone sub.' },
  { id: 'diminished', label: 'Diminished', definition: 'Build a diminished 7th chord downward from the melody note. Almost always works.' },
  { id: 'parallel', label: 'Parallel', definition: 'Move the target voicing backward/forward in parallel motion (half/whole-step planing).' },
  { id: 'free', label: 'Free', definition: 'Any available chord, without diatonic or dominant harmony, as long as it sounds good.' },
] as const;
export type ReharmTechnique = (typeof REHARMONISATION_TECHNIQUES)[number]['id'];

// Compatibility matrix (§5.6): chromatic reharmonisation is a type of parallel
// reharmonisation, and chromatic approaches idiomatically use parallel. Encodes
// which technique/approach pairings ARR-14 should offer.
export const REHARM_COMPATIBILITY: Record<ApproachNoteType, ReharmTechnique[]> = {
  chromatic: ['parallel', 'diminished', 'dominant', 'free'],
  scale: ['diatonic', 'diminished', 'dominant', 'free'],
  'double-chromatic': ['parallel', 'diminished', 'free'],
  indirect: ['diatonic', 'parallel', 'diminished', 'free'],
};

export function isCompatible(approach: ApproachNoteType, technique: ReharmTechnique): boolean {
  return REHARM_COMPATIBILITY[approach].includes(technique);
}

export const MANIPULATION_OPERATIONS = [
  { id: 'inflection', label: 'Inflection', definition: 'Change mode.' },
  { id: 'transposition', label: 'Transposition', definition: 'Exact or inexact transposition.' },
  { id: 'retrograde', label: 'Retrograde', definition: 'Reverse the pitch order.' },
  { id: 'inversion', label: 'Inversion', definition: 'Invert the intervals.' },
  { id: 'rhythmic', label: 'Rhythmic transformation', definition: 'Displacement, diminution, or augmentation.' },
  { id: 'reiteration', label: 'Reiteration', definition: 'Repeat material.' },
  { id: 'addition-subtraction', label: 'Addition & subtraction', definition: 'Add or remove notes.' },
  { id: 'context', label: 'Context', definition: 'Change feel, harmony, or orchestration.' },
  { id: 'subfiguration', label: 'Subfiguration', definition: 'Elaborate a figure.' },
] as const;
export type ManipulationOp = (typeof MANIPULATION_OPERATIONS)[number]['id'];

// Slash-chord "why use one" reasons (ARR-10 question type 4).
export const SLASH_CHORD_REASONS = [
  'Smooth the bass line',
  'Notate an exact sound',
  'Simplify a complex structure',
] as const;

export const THREE_FUNDAMENTAL_QUALITIES = ['major', 'minor', 'dominant'] as const;
export const FULLY_EXTENDED_DEGREES = [1, 3, 5, 7, 9, 11, 13] as const;
