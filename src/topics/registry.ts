import { lazy, type ComponentType } from 'react';
import type { ExamTypeDefinition } from '../exam/types';
import { ChordComparisonTopic } from './chord-comparison/ChordComparisonTopic';
import { ChordTopic } from './chord/ChordTopic';
import { IntervalComparisonTopic } from './interval-comparison/IntervalComparisonTopic';
import { IntervalTopic } from './interval/IntervalTopic';
import { MeterTopic } from './meter/MeterTopic';
import { ProgressionTopic } from './progression/ProgressionTopic';
import { ScaleTopic } from './scale/ScaleTopic';
import { TuningTopic } from './tuning/TuningTopic';

// Splits each topic's Tier-2 UI (React/CSS) into its own chunk.
const MelodicDictationTopic = lazy(() =>
  import('./melodic-dictation/MelodicDictationTopic').then((m) => ({ default: m.MelodicDictationTopic })),
);
const RhythmDictationTopic = lazy(() =>
  import('./rhythm-dictation/RhythmDictationTopic').then((m) => ({ default: m.RhythmDictationTopic })),
);
const IntervalSingingTopic = lazy(() =>
  import('./interval-singing/IntervalSingingTopic').then((m) => ({ default: m.IntervalSingingTopic })),
);
const ChordSingingTopic = lazy(() =>
  import('./chord-singing/ChordSingingTopic').then((m) => ({ default: m.ChordSingingTopic })),
);

// examTypes is a loader, not a static array (Phase 13 §1) — every
// examType.ts module was previously imported eagerly here purely so
// ExamSetup could read registry.examTypes synchronously, which pulled
// VexFlow (via rhythm/melodic dictation's exam Answer/Result components)
// into the main bundle regardless of whether those topics' own Components
// were lazy. ExamSetup now resolves these with Promise.all behind a small
// loading state; useExamMachine is unaffected since it only ever sees the
// already-resolved EnabledExamType[].
const intervalExamTypes = () => import('./interval/examType').then((m) => [m.IntervalRecognitionExam]);
const intervalComparisonExamTypes = () =>
  import('./interval-comparison/examType').then((m) => [m.IntervalComparisonExam]);
const scaleExamTypes = () => import('./scale/examType').then((m) => [m.ScaleRecognitionExam]);
const tuningExamTypes = () => import('./tuning/examType').then((m) => [m.TuningExam]);
const chordExamTypes = () => import('./chord/examType').then((m) => [m.ChordRecognitionExam]);
const chordComparisonExamTypes = () => import('./chord-comparison/examType').then((m) => [m.ChordComparisonExam]);
const meterExamTypes = () => import('./meter/examType').then((m) => [m.MeterRecognitionExam]);
const rhythmDictationExamTypes = () => import('./rhythm-dictation/examType').then((m) => [m.RhythmDictationExam]);
const progressionExamTypes = () => import('./progression/examType').then((m) => [m.ProgressionRecognitionExam]);
const melodicDictationExamTypes = () => import('./melodic-dictation/examType').then((m) => [m.MelodicDictationExam]);

export type CategoryId =
  | 'intervals-scales'
  | 'chords'
  | 'rhythm'
  | 'harmony-form'
  | 'pitch-melody'
  | 'repertoire'
  | 'musical-elements'
  | 'custom';

export const CATEGORY_TITLES: Record<CategoryId, string> = {
  'intervals-scales': 'Intervals & Scales',
  chords: 'Chords',
  rhythm: 'Rhythm',
  'harmony-form': 'Harmony & Form',
  'pitch-melody': 'Pitch & Melody',
  repertoire: 'Repertoire',
  'musical-elements': 'Musical Elements',
  custom: 'Custom Topics',
};

// Category display order (02-ui-shell-and-navigation.md §3)
export const CATEGORY_ORDER: CategoryId[] = [
  'intervals-scales',
  'chords',
  'rhythm',
  'harmony-form',
  'pitch-melody',
  'repertoire',
  'musical-elements',
  'custom',
];

export interface TopicDefinition {
  id: string;
  title: string;
  category: CategoryId;
  status: 'active' | 'placeholder';
  theme?: 'light' | 'dark';
  Component?: ComponentType;
  examTypes?: () => Promise<ExamTypeDefinition[]>;
  /** Overrides the generic placeholder copy (02-ui-shell §4). */
  placeholderCopy?: string;
  /**
   * Parked topics: kept in the inventory (ids, categories, and any future
   * code stay valid) but removed from the visible front end — the syllabus
   * menu skips them and their routes redirect to the default topic. To
   * bring one back, just delete this flag from its entry.
   */
  hidden?: boolean;
}

// Exact inventory: 02-ui-shell-and-navigation.md §3.
// Topics flip from "placeholder" to "active" (and gain a Component) as their
// implementation phase completes — see docs/08-implementation-plan.md.
export const TOPICS: TopicDefinition[] = [
  // Intervals & Scales
  {
    id: 'interval-recognition',
    title: 'Interval Recognition',
    category: 'intervals-scales',
    status: 'active',
    Component: IntervalTopic,
    examTypes: intervalExamTypes,
  },
  {
    id: 'scales',
    title: 'Scales',
    category: 'intervals-scales',
    status: 'active',
    Component: ScaleTopic,
    examTypes: scaleExamTypes,
  },
  {
    id: 'interval-comparison',
    title: 'Interval Comparison',
    category: 'intervals-scales',
    status: 'active',
    Component: IntervalComparisonTopic,
    examTypes: intervalComparisonExamTypes,
  },
  {
    id: 'interval-singing',
    title: 'Interval Singing',
    category: 'intervals-scales',
    status: 'active',
    Component: IntervalSingingTopic,
    // No exam type this phase — singing under exam timers is a different
    // design problem, deferred (09-improvement-plan.md §16.3).
  },
  { id: 'jazz-scales', title: 'Jazz Scales', category: 'intervals-scales', status: 'placeholder', hidden: true },
  {
    id: 'tuning',
    title: 'Tuning',
    category: 'intervals-scales',
    status: 'active',
    Component: TuningTopic,
    examTypes: tuningExamTypes,
  },

  // Chords
  {
    id: 'chord-recognition',
    title: 'Chord Recognition',
    category: 'chords',
    status: 'active',
    Component: ChordTopic,
    examTypes: chordExamTypes,
  },
  {
    id: 'chord-comparison',
    title: 'Chord Comparison',
    category: 'chords',
    status: 'active',
    Component: ChordComparisonTopic,
    examTypes: chordComparisonExamTypes,
  },
  { id: 'cluster-chords', title: 'Cluster Chords', category: 'chords', status: 'placeholder', hidden: true },
  { id: 'jazz-chords', title: 'Jazz Chords', category: 'chords', status: 'placeholder', hidden: true },
  {
    id: 'chord-singing',
    title: 'Chord Singing',
    category: 'chords',
    status: 'active',
    Component: ChordSingingTopic,
    // No exam type this phase — same deferral as Interval Singing (singing
    // under exam timers is a different design problem, docs/09 §16.3).
  },

  // Rhythm
  {
    id: 'meter-recognition',
    title: 'Meter Recognition',
    category: 'rhythm',
    status: 'active',
    Component: MeterTopic,
    examTypes: meterExamTypes,
  },
  {
    id: 'rhythm-dictation',
    title: 'Rhythm Dictation',
    category: 'rhythm',
    status: 'active',
    theme: 'dark',
    Component: RhythmDictationTopic,
    examTypes: rhythmDictationExamTypes,
  },
  { id: 'rhythm-comparison', title: 'Rhythm Comparison', category: 'rhythm', status: 'placeholder', hidden: true },
  { id: 'rhythm-imitation', title: 'Rhythm Imitation', category: 'rhythm', status: 'placeholder', hidden: true },
  { id: 'rhythm-styles', title: 'Rhythm Styles', category: 'rhythm', status: 'placeholder', hidden: true },
  {
    id: 'two-part-rhythm-dictation',
    title: 'Two-Part Rhythm Dictation',
    category: 'rhythm',
    status: 'placeholder',
    hidden: true,
  },

  // Harmony & Form
  {
    id: 'chord-progressions',
    title: 'Chord Progressions',
    category: 'harmony-form',
    status: 'active',
    Component: ProgressionTopic,
    examTypes: progressionExamTypes,
  },
  { id: 'nashville-numbers', title: 'Nashville Numbers', category: 'harmony-form', status: 'placeholder', hidden: true },
  { id: 'modulation', title: 'Modulation', category: 'harmony-form', status: 'placeholder', hidden: true },
  {
    id: 'phrase-structure-form',
    title: 'Phrase Structure & Form',
    category: 'harmony-form',
    status: 'placeholder',
    hidden: true,
  },
  { id: 'jazz-forms', title: 'Jazz Forms', category: 'harmony-form', status: 'placeholder', hidden: true },

  // Pitch & Melody
  {
    id: 'melodic-dictation',
    title: 'Melodic Dictation',
    category: 'pitch-melody',
    status: 'active',
    Component: MelodicDictationTopic,
    examTypes: melodicDictationExamTypes,
  },
  { id: 'pitch-dictation', title: 'Pitch Dictation', category: 'pitch-melody', status: 'placeholder', hidden: true },
  { id: 'melodic-comparison', title: 'Melodic Comparison', category: 'pitch-melody', status: 'placeholder', hidden: true },
  { id: 'note-recognition', title: 'Note Recognition', category: 'pitch-melody', status: 'placeholder', hidden: true },
  { id: 'sight-singing', title: 'Sight Singing', category: 'pitch-melody', status: 'placeholder' },
  { id: 'contour', title: 'Contour', category: 'pitch-melody', status: 'placeholder', hidden: true },

  // Repertoire (whole category parked — SyllabusMenu drops categories with no
  // visible topics, so hiding its only entry hides the section heading too)
  { id: 'repertoire-listening', title: 'Repertoire Listening', category: 'repertoire', status: 'placeholder', hidden: true },

  // Musical Elements
  { id: 'dynamics-articulation', title: 'Dynamics & Articulation', category: 'musical-elements', status: 'placeholder' },
  { id: 'tempo-texture', title: 'Tempo & Texture', category: 'musical-elements', status: 'placeholder', hidden: true },

  // Custom Topics
  {
    id: 'custom-topic',
    title: 'Create a custom topic',
    category: 'custom',
    status: 'placeholder',
    placeholderCopy: 'Your own exercises will live here.',
  },
];

// Default route on first load (matches legacy default tab, 02-ui-shell §3).
export const DEFAULT_TOPIC_ID = 'chord-progressions';

export function getTopic(id: string): TopicDefinition | undefined {
  return TOPICS.find((t) => t.id === id);
}
