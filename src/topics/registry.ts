import type { ComponentType } from 'react';
import type { ExamTypeDefinition } from '../exam/types';
import { IntervalTopic } from './interval/IntervalTopic';

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
  examTypes?: ExamTypeDefinition[];
  /** Overrides the generic placeholder copy (02-ui-shell §4). */
  placeholderCopy?: string;
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
  },
  { id: 'scales', title: 'Scales', category: 'intervals-scales', status: 'placeholder' },
  { id: 'interval-comparison', title: 'Interval Comparison', category: 'intervals-scales', status: 'placeholder' },
  { id: 'interval-singing', title: 'Interval Singing', category: 'intervals-scales', status: 'placeholder' },
  { id: 'jazz-scales', title: 'Jazz Scales', category: 'intervals-scales', status: 'placeholder' },
  { id: 'tuning', title: 'Tuning', category: 'intervals-scales', status: 'placeholder' },

  // Chords
  { id: 'chord-recognition', title: 'Chord Recognition', category: 'chords', status: 'placeholder' },
  { id: 'chord-comparison', title: 'Chord Comparison', category: 'chords', status: 'placeholder' },
  { id: 'cluster-chords', title: 'Cluster Chords', category: 'chords', status: 'placeholder' },
  { id: 'jazz-chords', title: 'Jazz Chords', category: 'chords', status: 'placeholder' },
  { id: 'chord-singing', title: 'Chord Singing', category: 'chords', status: 'placeholder' },

  // Rhythm
  { id: 'meter-recognition', title: 'Meter Recognition', category: 'rhythm', status: 'placeholder', theme: 'light' },
  { id: 'rhythm-dictation', title: 'Rhythm Dictation', category: 'rhythm', status: 'placeholder', theme: 'dark' },
  { id: 'rhythm-comparison', title: 'Rhythm Comparison', category: 'rhythm', status: 'placeholder' },
  { id: 'rhythm-imitation', title: 'Rhythm Imitation', category: 'rhythm', status: 'placeholder' },
  { id: 'rhythm-styles', title: 'Rhythm Styles', category: 'rhythm', status: 'placeholder' },
  { id: 'two-part-rhythm-dictation', title: 'Two-Part Rhythm Dictation', category: 'rhythm', status: 'placeholder' },

  // Harmony & Form
  { id: 'chord-progressions', title: 'Chord Progressions', category: 'harmony-form', status: 'placeholder' },
  { id: 'nashville-numbers', title: 'Nashville Numbers', category: 'harmony-form', status: 'placeholder' },
  { id: 'modulation', title: 'Modulation', category: 'harmony-form', status: 'placeholder' },
  { id: 'phrase-structure-form', title: 'Phrase Structure & Form', category: 'harmony-form', status: 'placeholder' },
  { id: 'jazz-forms', title: 'Jazz Forms', category: 'harmony-form', status: 'placeholder' },

  // Pitch & Melody
  { id: 'melodic-dictation', title: 'Melodic Dictation', category: 'pitch-melody', status: 'placeholder', theme: 'light' },
  { id: 'pitch-dictation', title: 'Pitch Dictation', category: 'pitch-melody', status: 'placeholder' },
  { id: 'melodic-comparison', title: 'Melodic Comparison', category: 'pitch-melody', status: 'placeholder' },
  { id: 'note-recognition', title: 'Note Recognition', category: 'pitch-melody', status: 'placeholder' },
  { id: 'sight-singing', title: 'Sight Singing', category: 'pitch-melody', status: 'placeholder' },
  { id: 'contour', title: 'Contour', category: 'pitch-melody', status: 'placeholder' },

  // Repertoire
  { id: 'repertoire-listening', title: 'Repertoire Listening', category: 'repertoire', status: 'placeholder' },

  // Musical Elements
  { id: 'dynamics-articulation', title: 'Dynamics & Articulation', category: 'musical-elements', status: 'placeholder' },
  { id: 'tempo-texture', title: 'Tempo & Texture', category: 'musical-elements', status: 'placeholder' },

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
