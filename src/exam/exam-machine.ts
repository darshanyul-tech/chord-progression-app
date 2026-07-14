import { shuffle } from '../lib/theory';
import type {
  DictationExamQuestion,
  DictationGradedAnswer,
  ExamSettingsField,
  ExamTypeDefinition,
  GradedAnswer,
  RecognitionExamQuestion,
} from './types';

// Ported verbatim from legacy exam/ExamController machinery
// (docs/06-exam-mode.md §A): paper building, shared recognition grading,
// repetition/spacing sequencing, and results aggregation. Framework-free.
// Extended in Phase 8 (§B3/B4) with dictation-kind support and replay limits.

export const EXAM_ANSWER_LIMIT_SEC = 30;
export const EXAM_DICTATION_LIMIT_SEC = 120;

export const EXAM_RECOGNITION_SETTINGS_SCHEMA: ExamSettingsField[] = [
  { key: 'count', label: 'Number of questions', min: 1, max: 30, step: 1, default: 5 },
  { key: 'reps', label: 'Repetitions per question', min: 1, max: 5, step: 1, default: 2 },
  { key: 'spacingSec', label: 'Spacing between repetitions', min: 0, max: 15, step: 1, default: 3, suffix: 's' },
  { key: 'replays', label: 'Replays after hearings', min: 0, max: 3, step: 1, default: 0 },
];

export const EXAM_DICTATION_SETTINGS_SCHEMA: ExamSettingsField[] = [
  { key: 'count', label: 'Number of questions', min: 1, max: 10, step: 1, default: 2 },
  { key: 'replays', label: 'Replays allowed', min: 0, max: 5, step: 1, default: 2 },
];

export type RecognitionExamType = ExamTypeDefinition & { kind: 'recognition' };
export type DictationExamType = ExamTypeDefinition & { kind: 'dictation' };

// `kind` lives at the top level of these unions (not nested under `.type.kind`)
// so a single `if (entry.kind === 'recognition')` reliably narrows the whole
// union for TS — narrowing through a nested discriminant is unreliable.
export type EnabledExamType =
  | { kind: 'recognition'; type: RecognitionExamType; settings: Record<string, number> }
  | { kind: 'dictation'; type: DictationExamType; settings: Record<string, number> };

export type ExamPaperEntry =
  | { kind: 'recognition'; question: RecognitionExamQuestion; type: RecognitionExamType; typeSettings: Record<string, number> }
  | { kind: 'dictation'; question: DictationExamQuestion; type: DictationExamType; typeSettings: Record<string, number> };

/** Ported from legacy buildMixedExamPaper(): builds each enabled type's paper, merges, and shuffles. */
export function buildMixedExamPaper(enabled: EnabledExamType[]): ExamPaperEntry[] {
  const paper: ExamPaperEntry[] = [];
  enabled.forEach((entry) => {
    if (entry.kind === 'recognition') {
      entry.type.buildPaper(entry.settings).forEach((question) => {
        paper.push({ kind: 'recognition', question, type: entry.type, typeSettings: entry.settings });
      });
    } else {
      entry.type.buildPaper(entry.settings).forEach((question) => {
        paper.push({ kind: 'dictation', question, type: entry.type, typeSettings: entry.settings });
      });
    }
  });
  return shuffle(paper);
}

/** Ported from legacy gradeRecognitionSingle(): shared grading for single-choice-answer types. */
export function gradeRecognitionSingle(
  question: RecognitionExamQuestion,
  answer: { guessId: string | null; guessLabel: string } | null,
): GradedAnswer {
  const perfect = !!(answer && answer.guessId && answer.guessId === question.answerId);
  const yours = answer?.guessLabel ?? '(no answer)';
  return {
    correctUnits: perfect ? 1 : 0,
    totalUnits: 1,
    perfect,
    results: [{ bar: 1, ok: perfect, actual: String(question.answerLabel ?? ''), yours }],
  };
}

/** Ported from legacy delaySec(): polls every 200ms so an abort mid-wait returns promptly. */
export function delaySec(sec: number, aborted: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const end = Date.now() + sec * 1000;
    const tick = () => {
      if (aborted() || Date.now() >= end) {
        resolve();
        return;
      }
      window.setTimeout(tick, 200);
    };
    tick();
  });
}

/** Ported from legacy playExamRepetitions(): reps × spacing hearings, reporting phase text as it goes. */
export async function playRepetitions(
  playOnce: () => Promise<void>,
  reps: number,
  spacingSec: number,
  aborted: () => boolean,
  onPhase: (text: string) => void,
): Promise<void> {
  for (let r = 0; r < reps; r++) {
    if (aborted()) return;
    onPhase(
      `Listening — repetition ${r + 1} of ${reps}${reps - r > 1 ? '. Submit early to skip remaining hearings.' : '.'}`,
    );
    await playOnce();
    if (aborted()) return;
    if (r < reps - 1 && spacingSec > 0) {
      onPhase('Pause before next repetition… Submit early to answer now.');
      await delaySec(spacingSec, aborted);
    }
  }
}

export type ExamAnswerRecord =
  | {
      kind: 'recognition';
      question: RecognitionExamQuestion;
      type: RecognitionExamType;
      answer: unknown;
      graded: GradedAnswer;
      timedOut: boolean;
      submittedEarly: boolean;
    }
  | {
      kind: 'dictation';
      question: DictationExamQuestion;
      type: DictationExamType;
      answer: unknown;
      graded: DictationGradedAnswer;
      timedOut: boolean;
      submittedEarly: boolean;
    };

export interface ExamTypeSummary {
  label: string;
  perfect: number;
  total: number;
}

export interface ExamSummary {
  perfectQuestions: number;
  totalQuestions: number;
  qPct: number;
  byType: ExamTypeSummary[];
}

/**
 * Ported from legacy ExamController.showResults()'s stat-aggregation logic.
 * Only recognition-kind answers ever count toward these stats — dictation
 * results are never blended into recognition accuracy (§B3).
 */
export function summarizeExamResults(answers: ExamAnswerRecord[]): ExamSummary {
  const recognitionAnswers = answers.filter(
    (a): a is Extract<ExamAnswerRecord, { kind: 'recognition' }> => a.kind === 'recognition',
  );
  let perfectQuestions = 0;
  const byTypeMap: Record<string, ExamTypeSummary> = {};
  const order: string[] = [];
  recognitionAnswers.forEach((a) => {
    if (a.graded.perfect) perfectQuestions++;
    const tid = a.type.id;
    if (!byTypeMap[tid]) {
      byTypeMap[tid] = { label: a.type.label, perfect: 0, total: 0 };
      order.push(tid);
    }
    byTypeMap[tid]!.total++;
    if (a.graded.perfect) byTypeMap[tid]!.perfect++;
  });
  const totalQuestions = recognitionAnswers.length;
  const qPct = totalQuestions ? Math.round((100 * perfectQuestions) / totalQuestions) : 0;
  return { perfectQuestions, totalQuestions, qPct, byType: order.map((tid) => byTypeMap[tid]!) };
}

export interface DictationSummary {
  matched: number;
  total: number;
}

/** Separate summary for the results screen's "Dictation" section (§B3). */
export function summarizeDictationResults(answers: ExamAnswerRecord[]): DictationSummary {
  const dictationAnswers = answers.filter(
    (a): a is Extract<ExamAnswerRecord, { kind: 'dictation' }> => a.kind === 'dictation',
  );
  return { matched: dictationAnswers.filter((a) => a.graded.matched).length, total: dictationAnswers.length };
}
