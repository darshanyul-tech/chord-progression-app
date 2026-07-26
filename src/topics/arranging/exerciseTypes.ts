// Shared contract for the schema-driven Arranging exercises.
// Each exercise is data + pure functions; ArrangingHost renders and grades it.

export type ArrSettings = Record<string, unknown>;

// ---- Options-panel schema (§4 controls) ----
export type OptionControl =
  | { kind: 'toggle'; key: string; label: string; note?: string }
  | { kind: 'select'; key: string; label: string; options: { value: string; label: string }[] }
  | { kind: 'multi'; key: string; label: string; options: { value: string; label: string }[]; note?: string }
  | { kind: 'stepper'; key: string; label: string; min: number; max: number }
  | { kind: 'range'; key: string; label: string; min: number; max: number };

// ---- Question shapes by input kind ----
export interface PromptSpec {
  text?: string;
  chordSymbol?: string;
  /** Voicing pitches (MIDI) to render on a staff and/or list, top-down. */
  staffPitches?: number[];
  /** A melodic fragment (MIDI sequence) to render/play. */
  melody?: number[];
  /** A second melody drawn after the first (ARR-16 before/after). */
  melody2?: number[];
  spelling?: 'sharp' | 'flat';
  clef?: 'treble' | 'bass';
}

export interface ChoiceDef {
  id: string;
  label: string;
}

export interface McQuestion {
  kind: 'mc';
  prompt: PromptSpec;
  choices: ChoiceDef[];
  answerIds: string[]; // accept any of these (single-answer → length 1)
  explanation: string;
  play?: number[];
  playMode?: 'block' | 'sequence';
}

export interface MultiQuestion {
  kind: 'multi';
  prompt: PromptSpec;
  choices: ChoiceDef[];
  correctIds: string[]; // exact-set match
  explanation: string;
  play?: number[];
  playCorrected?: number[];
}

export interface OrderQuestion {
  kind: 'order';
  prompt: PromptSpec;
  items: ChoiceDef[]; // presented shuffled
  correctOrder: string[]; // ids in correct top-to-bottom order
  explanation: string;
}

export interface StackedGrade {
  correct: boolean;
  message: string;
  /** Tier-2 rule feedback (named rules), if any. */
  violations?: string[];
  satisfied?: string[];
}

export interface StackedQuestion {
  kind: 'stacked';
  prompt: PromptSpec;
  chordSymbol: string;
  spelling: 'sharp' | 'flat';
  voiceCount: number;
  /** MIDI values pre-filled per row (index 0 = lead/top). null = user must fill. */
  prefill: (number | null)[];
  lockedRows: number[];
  grade: (userMidis: number[]) => StackedGrade;
  reveal: number[]; // a correct/example answer to show and play on reveal
  tier2: boolean;
}

export type ArrQuestion = McQuestion | MultiQuestion | OrderQuestion | StackedQuestion;

export interface ArrangingExercise {
  id: string;
  title: string;
  /** On-screen instruction blurb — the only explanatory text in the section (§6). */
  instruction: string;
  settingsSchema: OptionControl[];
  defaultSettings: ArrSettings;
  /** Extra one-line notice under the settings (e.g. provisional data, Tier-2 warning). */
  settingsNotice?: string;
  generate: (settings: ArrSettings) => ArrQuestion | null;
}
