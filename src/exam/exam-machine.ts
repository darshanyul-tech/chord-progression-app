import { shuffle } from '../lib/theory';
import type { ExamSettingsField, ExamTypeDefinition, GradedAnswer, RecognitionExamQuestion } from './types';

// Ported verbatim from legacy exam/ExamController machinery
// (docs/06-exam-mode.md §A): paper building, shared recognition grading,
// repetition/spacing sequencing, and results aggregation. Framework-free.

export const EXAM_ANSWER_LIMIT_SEC = 30;

export const EXAM_RECOGNITION_SETTINGS_SCHEMA: ExamSettingsField[] = [
  { key: 'count', label: 'Number of questions', min: 1, max: 30, step: 1, default: 5 },
  { key: 'reps', label: 'Repetitions per question', min: 1, max: 5, step: 1, default: 2 },
  { key: 'spacingSec', label: 'Spacing between repetitions', min: 0, max: 15, step: 1, default: 3, suffix: 's' },
];

export interface EnabledExamType {
  type: ExamTypeDefinition & { kind: 'recognition' };
  settings: Record<string, number>;
}

export interface ExamPaperQuestion {
  question: RecognitionExamQuestion;
  type: ExamTypeDefinition & { kind: 'recognition' };
  typeSettings: Record<string, number>;
}

/** Ported from legacy buildMixedExamPaper(): builds each enabled type's paper, merges, and shuffles. */
export function buildMixedExamPaper(enabled: EnabledExamType[]): ExamPaperQuestion[] {
  const paper: ExamPaperQuestion[] = [];
  enabled.forEach(({ type, settings }) => {
    const qs = type.buildPaper(settings);
    qs.forEach((question) => paper.push({ question, type, typeSettings: settings }));
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

export interface ExamAnswerRecord {
  question: RecognitionExamQuestion;
  type: ExamTypeDefinition & { kind: 'recognition' };
  graded: GradedAnswer;
  timedOut: boolean;
  submittedEarly: boolean;
}

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

/** Ported from legacy ExamController.showResults()'s stat-aggregation logic. */
export function summarizeExamResults(answers: ExamAnswerRecord[]): ExamSummary {
  let perfectQuestions = 0;
  const byTypeMap: Record<string, ExamTypeSummary> = {};
  const order: string[] = [];
  answers.forEach((a) => {
    if (a.graded.perfect) perfectQuestions++;
    const tid = a.type.id;
    if (!byTypeMap[tid]) {
      byTypeMap[tid] = { label: a.type.label, perfect: 0, total: 0 };
      order.push(tid);
    }
    byTypeMap[tid]!.total++;
    if (a.graded.perfect) byTypeMap[tid]!.perfect++;
  });
  const totalQuestions = answers.length;
  const qPct = totalQuestions ? Math.round((100 * perfectQuestions) / totalQuestions) : 0;
  return { perfectQuestions, totalQuestions, qPct, byType: order.map((tid) => byTypeMap[tid]!) };
}
