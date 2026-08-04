import {
  STATS_VERSION,
  type AttemptEvent,
  type StatsData,
  type Tally,
  type TopicStats,
} from './types';

export function emptyStats(): StatsData {
  return { version: STATS_VERSION, topics: {}, updatedAt: 0 };
}

function emptyTopic(): TopicStats {
  return { overall: { correct: 0, total: 0 }, items: {}, lastPlayed: 0 };
}

function bump(tally: Tally, correct: boolean): Tally {
  return { correct: tally.correct + (correct ? 1 : 0), total: tally.total + 1 };
}

/** Accuracy as a 0..1 ratio; 0 when nothing has been attempted. */
export function accuracy(tally: Tally): number {
  return tally.total === 0 ? 0 : tally.correct / tally.total;
}

/** Accuracy as a rounded whole-number percentage (0..100). */
export function accuracyPct(tally: Tally): number {
  return Math.round(accuracy(tally) * 100);
}

/**
 * Immutably apply one attempt to the stats blob. Bumps the topic overall and,
 * when an itemKey is present, the per-item tally too. Never mutates its input.
 */
export function applyEvent(data: StatsData, event: AttemptEvent): StatsData {
  const ts = event.ts ?? Date.now();
  const prevTopic = data.topics[event.topicId] ?? emptyTopic();

  const nextItems = { ...prevTopic.items };
  if (event.itemKey) {
    const prevItem = prevTopic.items[event.itemKey];
    nextItems[event.itemKey] = {
      label: event.itemLabel ?? prevItem?.label ?? event.itemKey,
      tally: bump(prevItem?.tally ?? { correct: 0, total: 0 }, event.correct),
    };
  }

  const nextTopic: TopicStats = {
    overall: bump(prevTopic.overall, event.correct),
    items: nextItems,
    lastPlayed: Math.max(prevTopic.lastPlayed, ts),
  };

  return {
    version: STATS_VERSION,
    topics: { ...data.topics, [event.topicId]: nextTopic },
    updatedAt: ts,
  };
}

function addTally(a: Tally, b: Tally): Tally {
  return { correct: a.correct + b.correct, total: a.total + b.total };
}

/**
 * Sum two stats blobs (e.g. importing guest progress into a signed-in profile).
 * Overall and per-item counters add; labels prefer `b`, then `a`.
 */
export function mergeStats(a: StatsData, b: StatsData): StatsData {
  const topics: Record<string, TopicStats> = {};
  const topicIds = new Set([...Object.keys(a.topics), ...Object.keys(b.topics)]);

  for (const id of topicIds) {
    const ta = a.topics[id];
    const tb = b.topics[id];
    if (!ta) {
      topics[id] = tb;
      continue;
    }
    if (!tb) {
      topics[id] = ta;
      continue;
    }
    const items: Record<string, TopicStats['items'][string]> = {};
    const itemKeys = new Set([...Object.keys(ta.items), ...Object.keys(tb.items)]);
    for (const key of itemKeys) {
      const ia = ta.items[key];
      const ib = tb.items[key];
      items[key] = {
        label: ib?.label ?? ia?.label ?? key,
        tally: addTally(ia?.tally ?? { correct: 0, total: 0 }, ib?.tally ?? { correct: 0, total: 0 }),
      };
    }
    topics[id] = {
      overall: addTally(ta.overall, tb.overall),
      items,
      lastPlayed: Math.max(ta.lastPlayed, tb.lastPlayed),
    };
  }

  return {
    version: STATS_VERSION,
    topics,
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
  };
}

/** True when a profile has recorded at least one attempt anywhere. */
export function hasAnyAttempts(data: StatsData): boolean {
  return Object.values(data.topics).some((t) => t.overall.total > 0);
}
