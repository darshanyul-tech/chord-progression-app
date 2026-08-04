import { create } from 'zustand';
import { useStatsStore } from './statsStore';

export interface TopicScore {
  correct: number;
  total: number;
}

/** Granular sub-item for persistent stats, e.g. { key: 'm6', label: 'Minor 6th' }. */
export interface AttemptItem {
  key: string;
  label: string;
}

// Stable reference — selectors must never fall back to a fresh object literal
// (breaks useSyncExternalStore's reference-equality check -> infinite loop).
export const EMPTY_SCORE: TopicScore = { correct: 0, total: 0 };

interface ScoresState {
  scores: Record<string, TopicScore>;
  recordAttempt(topicId: string, correct: boolean, item?: AttemptItem): void;
  resetScore(topicId: string): void;
  getScore(topicId: string): TopicScore;
}

// Session scores — no persist middleware: survive topic switches, die on reload (D6).
// The same call also feeds the PERSISTENT stats store (statsStore): every topic
// gets overall accuracy for free, and the topics that pass an `item` get a
// per-item breakdown too. The `item` arg is optional so all existing call sites
// keep working unchanged.
export const useScoresStore = create<ScoresState>((set, get) => ({
  scores: {},
  recordAttempt: (topicId, correct, item) => {
    useStatsStore.getState().record({
      topicId,
      correct,
      itemKey: item?.key,
      itemLabel: item?.label,
    });
    set((s) => {
      const prev = s.scores[topicId] ?? EMPTY_SCORE;
      return {
        scores: {
          ...s.scores,
          [topicId]: { correct: prev.correct + (correct ? 1 : 0), total: prev.total + 1 },
        },
      };
    });
  },
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

const PROGRESSION_TOPIC_ID = 'chord-progressions';

export const useProgressionScoreStore = create<ProgressionScoreState>((set) => ({
  stats: EMPTY_PROGRESSION_STATS,
  recordBar: ({ overallOk, functionOk, tonalityOk }) => {
    // Persistent stats get one attempt per bar (overall). The granular
    // function/tonality split stays in this topic's own session UI —
    // emitting them as separate events here would double-count overall.
    useStatsStore.getState().record({ topicId: PROGRESSION_TOPIC_ID, correct: overallOk });
    return set((s) => ({
      stats: {
        overall: bump(s.stats.overall, overallOk),
        function: bump(s.stats.function, functionOk),
        tonality: bump(s.stats.tonality, tonalityOk),
      },
    }));
  },
  reset: () => set({ stats: EMPTY_PROGRESSION_STATS }),
}));
