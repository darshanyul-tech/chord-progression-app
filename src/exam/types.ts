import type { ComponentType } from 'react';

// Stub shapes for the registry to compile against in early phases.
// Fleshed out in Phase 5 per docs/06-exam-mode.md §B1 (exam-machine.ts, ExamOverlay).
export interface RecognitionExamQuestion {
  prompt: unknown;
  correctAnswer: unknown;
  choices: unknown[];
}

export interface DictationExamQuestion {
  pattern: unknown;
  play(): void;
}

export interface ExamChoicesProps {
  question: RecognitionExamQuestion;
  onAnswer(answer: unknown): void;
}

export interface ExamDictationProps {
  question: DictationExamQuestion;
  onChange(answer: unknown): void;
}

export type ExamTypeDefinition =
  | {
      kind: 'recognition';
      id: string;
      label: string;
      buildQuestion(): RecognitionExamQuestion;
      ChoicesComponent: ComponentType<ExamChoicesProps>;
    }
  | {
      kind: 'dictation';
      id: string;
      label: string;
      buildQuestion(): DictationExamQuestion;
      AnswerComponent: ComponentType<ExamDictationProps>;
    };
