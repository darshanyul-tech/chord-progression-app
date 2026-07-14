import { create } from 'zustand';

export interface TopicScore {
  correct: number;
  total: number;
}

const EMPTY_SCORE: TopicScore = { correct: 0, total: 0 };

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
