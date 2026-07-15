import type { ComponentType } from 'react';
import type { ExamPlaybackChannel } from './playback';

// Fleshed out per docs/06-exam-mode.md §A/§B1/§B3. Both "recognition" (Phase
// 5/6) and "dictation" (Phase 8) kinds are now fully specified.

export interface ExamSettingsField {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  suffix?: string;
}

export interface ExamBarResult {
  bar: number;
  ok: boolean;
  actual: string;
  yours: string;
}

export interface GradedAnswer {
  correctUnits: number;
  totalUnits: number;
  perfect: boolean;
  results: ExamBarResult[];
}

export interface DictationGradedAnswer {
  matched: boolean;
}

/**
 * Opaque per-question bag stamped with the type that built it — each
 * ExamTypeDefinition's own functions know the concrete shape they put on it
 * (mirrors legacy's untyped question objects; see 06-exam-mode.md §B1).
 */
export interface RecognitionExamQuestion {
  typeId: string;
  [key: string]: unknown;
}

export interface DictationExamQuestion {
  typeId: string;
  [key: string]: unknown;
}

export interface ExamChoicesProps {
  question: RecognitionExamQuestion;
  answer: unknown;
  onAnswer(answer: unknown): void;
  disabled: boolean;
  /** Bar/index currently sounding during a hearing (progression recognition only); null when idle. */
  activeBarIndex?: number | 'ref' | null;
}

export interface ExamDictationProps {
  question: DictationExamQuestion;
  answer: unknown;
  onAnswer(answer: unknown): void;
  disabled: boolean;
}

export interface ExamDictationResultProps {
  question: DictationExamQuestion;
  answer: unknown;
  matched: boolean;
}

/** Everything a type's playQuestion()/replayQuestion() needs to schedule hearings on the exam's shared channel. */
export interface ExamPlayContext {
  typeConfig: Record<string, number>;
  channel: ExamPlaybackChannel;
  aborted(): boolean;
  onPhase(text: string): void;
  /** Optional per-bar/per-item highlight during a hearing (progression recognition's bar-by-bar playback). */
  onProgress?(index: number | 'ref' | null): void;
}

export type ExamTypeDefinition =
  | {
      kind: 'recognition';
      id: string;
      label: string;
      /** Topic whose Settings/enabled-list feeds this type (legacy EXAM_SECTION_MODES); also used to pre-enable this type when Exam mode is opened from that topic. */
      originTopicId: string;
      settingsSchema: ExamSettingsField[];
      setupHelp?: string;
      buildPaper(settings: Record<string, number>): RecognitionExamQuestion[];
      ChoicesComponent: ComponentType<ExamChoicesProps>;
      /** Initial hearing(s) — reps × spacing for recognition types. */
      playQuestion(question: RecognitionExamQuestion, ctx: ExamPlayContext): Promise<void>;
      /** A single on-demand re-hearing during the answer window (§B4) — never repeats reps/spacing. */
      replayQuestion(question: RecognitionExamQuestion, ctx: ExamPlayContext): Promise<void>;
      gradeQuestion(question: RecognitionExamQuestion, answer: unknown): GradedAnswer;
      formatQuestionTitle(question: RecognitionExamQuestion, index: number, total: number): string;
      formatResultHeading(question: RecognitionExamQuestion): string;
    }
  | {
      kind: 'dictation';
      id: string;
      label: string;
      originTopicId: string;
      settingsSchema: ExamSettingsField[];
      setupHelp?: string;
      buildPaper(settings: Record<string, number>): DictationExamQuestion[];
      AnswerComponent: ComponentType<ExamDictationProps>;
      ResultComponent: ComponentType<ExamDictationResultProps>;
      /** Single initial hearing (§B3 — dictation questions play once automatically). */
      playQuestion(question: DictationExamQuestion, ctx: ExamPlayContext): Promise<void>;
      /** A single on-demand re-hearing during the answer window, limited by the "replays" setting. */
      replayQuestion(question: DictationExamQuestion, ctx: ExamPlayContext): Promise<void>;
      gradeQuestion(question: DictationExamQuestion, answer: unknown): DictationGradedAnswer;
      formatQuestionTitle(question: DictationExamQuestion, index: number, total: number): string;
    };
