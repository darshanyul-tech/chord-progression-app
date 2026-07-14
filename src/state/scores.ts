import { create } from 'zustand';

export interface TopicScore {
  correct: number;
  total: number;
}

// Stable reference — selectors must never fall back to a fresh object literal
// (breaks useSyncExternalStore's reference-equality check -> infinite loop).
export const EMPTY_SCORE: TopicScore = { correct: 0, total: 0 };

interface ScoresState {
  scores: Record<string, TopicScore>;
  recordAttempt(topicId: string, correct: boolean): void;
  resetScore(topicId: string): void;
  getScore(topicId: string): TopicScore;
}

// Session scores — no persist middleware: survive topic switches, die on reload (D6).
export const useScoresStore = create<ScoresState>((set, get) => ({
  scores: {},
  recordAttempt: (topicId, correct) =>
    set((s) => {
      const prev = s.scores[topicId] ?? EMPTY_SCORE;
      return {
        scores: {
          ...s.scores,
          [topicId]: { correct: prev.correct + (correct ? 1 : 0), total: prev.total + 1 },
        },
      };
    }),
  resetScore: (topicId) =>
    set((s) => ({ scores: { ...s.scores, [topicId]: { ...EMPTY_SCORE } } })),
  getScore: (topicId) => get().scores[topicId] ?? EMPTY_SCORE,
}));

// Chord Progressions' granular tallies (overall/function/tonality) — ported
// from legacy state.sessionStats / renderSessionScore (docs/05-topics/06 §3).
// Separate shape from the generic single-score store above; still
// non-persisted (D6) and independent of every other topic's score.
export interface ProgressionSessionStats {
  overall: TopicScore;
  function: TopicScore;
  tonality: TopicScore;
}

const EMPTY_PROGRESSION_STATS: ProgressionSessionStats = {
  overall: EMPTY_SCORE,
  function: EMPTY_SCORE,
  tonality: EMPTY_SCORE,
};

interface ProgressionScoreState {
  stats: ProgressionSessionStats;
  recordBar(result: { overallOk: boolean; functionOk: boolean; tonalityOk: boolean }): void;
  reset(): void;
}

function bump(prev: TopicScore, ok: boolean): TopicScore {
  return { correct: prev.correct + (ok ? 1 : 0), total: prev.total + 1 };
}

export const useProgressionScoreStore = create<ProgressionScoreState>((set) => ({
  stats: EMPTY_PROGRESSION_STATS,
  recordBar: ({ overallOk, functionOk, tonalityOk }) =>
    set((s) => ({
      stats: {
        overall: bump(s.stats.overall, overallOk),
        function: bump(s.stats.function, functionOk),
        tonality: bump(s.stats.tonality, tonalityOk),
      },
    })),
  reset: () => set({ stats: EMPTY_PROGRESSION_STATS }),
}));
