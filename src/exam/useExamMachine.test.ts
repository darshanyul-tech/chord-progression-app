import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useExamMachine } from './useExamMachine';
import type { DictationExamType, EnabledExamType } from './exam-machine';
import { EXAM_ANSWER_LIMIT_SEC } from './exam-machine';
import type { RecognitionExamType } from './exam-machine';

// RTL coverage for the exam machine (09-improvement-plan.md §15.2) —
// previously zero component/hook tests existed for exam mode beyond the
// framework-free exam-machine.ts logic. Types here have instant
// playQuestion/replayQuestion (no real hearings/timers) so begin() resolves
// synchronously-ish, keeping these tests fast and deterministic.

vi.mock('../lib/audio/engine', () => ({
  audio: {
    status: 'ready',
    sampler: { triggerAttackRelease: vi.fn(), releaseAll: vi.fn() },
    lastError: null,
    initAudio: vi.fn().mockResolvedValue(undefined),
    subscribe: () => () => {},
    now: () => 0,
    rawContext: () => ({ currentTime: 0 }),
  },
}));

function fakeRecognitionType(id: string, correctAnswer: string): RecognitionExamType {
  return {
    kind: 'recognition',
    id,
    label: id,
    originTopicId: id,
    settingsSchema: [],
    buildPaper: (settings) => Array.from({ length: settings.count ?? 1 }, (_, i) => ({ typeId: id, i })),
    ChoicesComponent: () => null,
    playQuestion: async () => {},
    replayQuestion: async () => {},
    gradeQuestion: (_q, answer) => ({
      correctUnits: answer === correctAnswer ? 1 : 0,
      totalUnits: 1,
      perfect: answer === correctAnswer,
      results: [],
    }),
    formatQuestionTitle: (_q, i, total) => `Q${i + 1}/${total}`,
    formatResultHeading: () => id,
  };
}

function fakeDictationType(id: string): DictationExamType {
  return {
    kind: 'dictation',
    id,
    label: id,
    originTopicId: id,
    settingsSchema: [],
    buildPaper: (settings) => Array.from({ length: settings.count ?? 1 }, () => ({ typeId: id })),
    AnswerComponent: () => null,
    ResultComponent: () => null,
    playQuestion: async () => {},
    replayQuestion: async () => {},
    gradeQuestion: (_q, answer) => ({ matched: answer === 'match' }),
    formatQuestionTitle: (_q, i, total) => `Q${i + 1}/${total}`,
  };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('useExamMachine — begin -> answer -> results', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs a scripted recognition exam and computes summary math', async () => {
    const type = fakeRecognitionType('rec', 'yes');
    const enabled: EnabledExamType[] = [
      { kind: 'recognition', type, settings: { count: 2, reps: 1, spacingSec: 0, replays: 0 } },
    ];
    const { result } = renderHook(() => useExamMachine());

    await act(async () => {
      await result.current.begin(enabled);
    });
    expect(result.current.phase).toBe('active');
    expect(result.current.paper).toHaveLength(2);
    expect(result.current.currentIndex).toBe(0);

    act(() => result.current.setAnswer('yes'));
    act(() => result.current.submitAnswer());
    await flush();
    expect(result.current.currentIndex).toBe(1);
    expect(result.current.phase).toBe('active');

    act(() => result.current.setAnswer('no'));
    act(() => result.current.submitAnswer());
    await flush();

    expect(result.current.phase).toBe('results');
    expect(result.current.summary).toEqual({
      perfectQuestions: 1,
      totalQuestions: 2,
      qPct: 50,
      byType: [{ label: 'rec', perfect: 1, total: 2 }],
    });
    expect(result.current.answers.map((a) => (a.kind === 'recognition' ? a.graded.perfect : null))).toEqual([
      true,
      false,
    ]);
  });

  it('routes dictation answers to a separate summary, excluded from the recognition summary', async () => {
    const type = fakeDictationType('dict');
    const enabled: EnabledExamType[] = [{ kind: 'dictation', type, settings: { count: 1, replays: 0 } }];
    const { result } = renderHook(() => useExamMachine());

    await act(async () => {
      await result.current.begin(enabled);
    });
    act(() => result.current.setAnswer('match'));
    act(() => result.current.submitAnswer());
    await flush();

    expect(result.current.phase).toBe('results');
    expect(result.current.summary).toEqual({ perfectQuestions: 0, totalQuestions: 0, qPct: 0, byType: [] });
    expect(result.current.dictationSummary).toEqual({ matched: 1, total: 1 });
    expect(result.current.answers[0]!.kind).toBe('dictation');
  });

  it('replay budget decrements and disables (no-ops) at 0', async () => {
    const type = fakeRecognitionType('rec2', 'x');
    const enabled: EnabledExamType[] = [
      { kind: 'recognition', type, settings: { count: 1, reps: 1, spacingSec: 0, replays: 2 } },
    ];
    const { result } = renderHook(() => useExamMachine());

    await act(async () => {
      await result.current.begin(enabled);
    });
    expect(result.current.remainingReplays).toBe(2);

    await act(async () => {
      await result.current.replay();
    });
    expect(result.current.remainingReplays).toBe(1);

    await act(async () => {
      await result.current.replay();
    });
    expect(result.current.remainingReplays).toBe(0);

    // Guarded no-op once the budget is spent (exam-machine.ts's
    // `if (remainingReplays <= 0 ...) return;`).
    await act(async () => {
      await result.current.replay();
    });
    expect(result.current.remainingReplays).toBe(0);
  });

  it('the answer countdown times out under vi.useFakeTimers and auto-finalizes as timedOut', async () => {
    vi.useFakeTimers();
    try {
      const type = fakeRecognitionType('rec3', 'z');
      const enabled: EnabledExamType[] = [
        { kind: 'recognition', type, settings: { count: 1, reps: 1, spacingSec: 0, replays: 0 } },
      ];
      const { result } = renderHook(() => useExamMachine());

      await act(async () => {
        await result.current.begin(enabled);
      });
      expect(result.current.remainingSec).toBe(EXAM_ANSWER_LIMIT_SEC);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(EXAM_ANSWER_LIMIT_SEC * 1000);
      });

      expect(result.current.phase).toBe('results');
      expect(result.current.answers[0]!.timedOut).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
