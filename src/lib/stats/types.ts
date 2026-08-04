// Tier-1 stats model (framework-free). Persisted per profile; the same JSON
// shape is what the cPanel backend stores in MySQL, so the local and remote
// representations are identical (see docs/17-stats-and-profiles.md).

/** A single graded attempt, emitted from a topic's `finalize()`. */
export interface AttemptEvent {
  /** Registry topic id, e.g. 'interval-recognition'. */
  topicId: string;
  /** First-guess correctness (matches the existing session-score semantics). */
  correct: boolean;
  /** Granular sub-item, e.g. 'm6'. Omit for topics with no natural item axis. */
  itemKey?: string;
  /** Human label for the item, e.g. 'Minor 6th'. Only meaningful with itemKey. */
  itemLabel?: string;
  /** Epoch ms; defaults to Date.now() when applied. */
  ts?: number;
}

/** Cumulative counters — the atom of every accuracy figure. */
export interface Tally {
  correct: number;
  total: number;
}

export interface ItemStats {
  label: string;
  tally: Tally;
}

export interface TopicStats {
  overall: Tally;
  /** Keyed by itemKey; empty for overall-only topics. */
  items: Record<string, ItemStats>;
  /** Epoch ms of the most recent attempt in this topic. */
  lastPlayed: number;
}

export const STATS_VERSION = 1;

/** The whole persisted blob for one profile. */
export interface StatsData {
  version: number;
  topics: Record<string, TopicStats>;
  updatedAt: number;
}
