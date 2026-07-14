import type { ComponentType } from 'react';
import type { ExamPlaybackChannel } from './playback';

// Fleshed out per docs/06-exam-mode.md §A/§B1. Phase 5 implements the
// "recognition" arm fully (the four legacy types); "dictation" is a forward
// -compatible stub for Phase 8 (rhythm/melodic dictation exam types, D14).

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
  pattern: unknown;
  play(): void;
}

export interface ExamChoicesProps {
  question: RecognitionExamQuestion;
  answer: unknown;
  onAnswer(answer: unknown): void;
  disabled: boolean;
}

export interface ExamDictationProps {
  question: DictationExamQuestion;
  onChange(answer: unknown): void;
}

/** Everything a recognition type's playQuestion() needs to schedule hearings on the exam's shared channel. */
export interface ExamPlayContext {
  typeConfig: Record<string, number>;
  channel: ExamPlaybackChannel;
  aborted(): boolean;
  onPhase(text: string): void;
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
      playQuestion(question: RecognitionExamQuestion, ctx: ExamPlayContext): Promise<void>;
      gradeQuestion(question: RecognitionExamQuestion, answer: unknown): GradedAnswer;
      formatQuestionTitle(question: RecognitionExamQuestion, index: number, total: number): string;
      formatResultHeading(question: RecognitionExamQuestion): string;
    }
  | {
      kind: 'dictation';
      id: string;
      label: string;
      originTopicId: string;
      buildQuestion(): DictationExamQuestion;
      AnswerComponent: ComponentType<ExamDictationProps>;
    };
