import { describe, expect, it, vi } from 'vitest';
import {
  buildMixedExamPaper,
  delaySec,
  gradeRecognitionSingle,
  playRepetitions,
  summarizeExamResults,
  type EnabledExamType,
  type ExamAnswerRecord,
} from './exam-machine';
import type { ExamTypeDefinition, RecognitionExamQuestion } from './types';

function makeType(id: string, count: number): ExamTypeDefinition & { kind: 'recognition' } {
  return {
    kind: 'recognition',
    id,
    label: `${id} label`,
    originTopicId: id,
    settingsSchema: [],
    buildPaper: (settings) =>
      Array.from({ length: settings.count ?? count }, (_, i) => ({
        typeId: id,
        answerId: `${id}-${i}`,
        answerLabel: `${id}-${i}-label`,
      })),
    ChoicesComponent: () => null,
    playQuestion: async () => {},
    gradeQuestion: (question, answer) =>
      gradeRecognitionSingle(question, answer as { guessId: string | null; guessLabel: string } | null),
    formatQuestionTitle: (_q, i, total) => `Q${i + 1}/${total}`,
    formatResultHeading: (q) => String(q.answerLabel),
  };
}

describe('buildMixedExamPaper', () => {
  it('builds every enabled type paper and merges them', () => {
    const enabled: EnabledExamType[] = [
      { type: makeType('a', 3), settings: { count: 3 } },
      { type: makeType('b', 2), settings: { count: 2 } },
    ];
    const paper = buildMixedExamPaper(enabled);
    expect(paper).toHaveLength(5);
    expect(paper.filter((p) => p.type.id === 'a')).toHaveLength(3);
    expect(paper.filter((p) => p.type.id === 'b')).toHaveLength(2);
  });

  it('returns an empty paper when no types are enabled', () => {
    expect(buildMixedExamPaper([])).toEqual([]);
  });

  it('stamps each question with the type and settings that built it', () => {
    const type = makeType('a', 2);
    const paper = buildMixedExamPaper([{ type, settings: { count: 2 } }]);
    paper.forEach((entry) => {
      expect(entry.type).toBe(type);
      expect(entry.typeSettings).toEqual({ count: 2 });
    });
  });
});

describe('gradeRecognitionSingle', () => {
  const question: RecognitionExamQuestion = { typeId: 'x', answerId: 'q1', answerLabel: 'Correct answer' };

  it('grades a correct guess as perfect', () => {
    const graded = gradeRecognitionSingle(question, { guessId: 'q1', guessLabel: 'Correct answer' });
    expect(graded.perfect).toBe(true);
    expect(graded.correctUnits).toBe(1);
    expect(graded.results[0]).toEqual({ bar: 1, ok: true, actual: 'Correct answer', yours: 'Correct answer' });
  });

  it('grades a wrong guess as not perfect', () => {
    const graded = gradeRecognitionSingle(question, { guessId: 'wrong', guessLabel: 'Wrong answer' });
    expect(graded.perfect).toBe(false);
    expect(graded.correctUnits).toBe(0);
  });

  it('treats a null answer (timeout with no pick) as "(no answer)", not a crash', () => {
    const graded = gradeRecognitionSingle(question, null);
    expect(graded.perfect).toBe(false);
    expect(graded.results[0]!.yours).toBe('(no answer)');
  });
});

describe('summarizeExamResults', () => {
  function record(typeId: string, perfect: boolean): ExamAnswerRecord {
    return {
      question: { typeId },
      type: makeType(typeId, 1),
      graded: { correctUnits: perfect ? 1 : 0, totalUnits: 1, perfect, results: [] },
      timedOut: false,
      submittedEarly: false,
    };
  }

  it('aggregates overall and per-type stats, preserving first-seen type order', () => {
    const answers = [record('b', true), record('a', false), record('a', true)];
    const summary = summarizeExamResults(answers);
    expect(summary.totalQuestions).toBe(3);
    expect(summary.perfectQuestions).toBe(2);
    expect(summary.qPct).toBe(67);
    expect(summary.byType.map((t) => t.label)).toEqual(['b label', 'a label']);
    expect(summary.byType.find((t) => t.label === 'a label')).toEqual({ label: 'a label', perfect: 1, total: 2 });
  });

  it('handles an empty exam without dividing by zero', () => {
    const summary = summarizeExamResults([]);
    expect(summary).toEqual({ perfectQuestions: 0, totalQuestions: 0, qPct: 0, byType: [] });
  });
});

describe('playRepetitions', () => {
  it('calls playOnce exactly `reps` times when never aborted', async () => {
    const playOnce = vi.fn().mockResolvedValue(undefined);
    await playRepetitions(playOnce, 3, 0, () => false, () => {});
    expect(playOnce).toHaveBeenCalledTimes(3);
  });

  it('stops early once aborted() reports true', async () => {
    let calls = 0;
    const playOnce = vi.fn(async () => {
      calls++;
    });
    await playRepetitions(playOnce, 5, 0, () => calls >= 2, () => {});
    expect(calls).toBe(2);
  });
});

describe('delaySec', () => {
  it('resolves immediately once aborted() is already true', async () => {
    const start = Date.now();
    await delaySec(5, () => true);
    expect(Date.now() - start).toBeLessThan(100);
  });
});
