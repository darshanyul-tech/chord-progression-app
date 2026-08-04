import { describe, expect, it } from 'vitest';
import { accuracy, accuracyPct, applyEvent, emptyStats, hasAnyAttempts, mergeStats } from './aggregate';

describe('accuracy', () => {
  it('is 0 for an empty tally (never divides by zero)', () => {
    expect(accuracy({ correct: 0, total: 0 })).toBe(0);
    expect(accuracyPct({ correct: 0, total: 0 })).toBe(0);
  });
  it('rounds to a whole percentage', () => {
    expect(accuracyPct({ correct: 11, total: 19 })).toBe(58); // 57.9% → 58
  });
});

describe('applyEvent', () => {
  it('bumps the topic overall for a topic-only event', () => {
    let d = emptyStats();
    d = applyEvent(d, { topicId: 't', correct: true, ts: 1 });
    d = applyEvent(d, { topicId: 't', correct: false, ts: 2 });
    expect(d.topics.t.overall).toEqual({ correct: 1, total: 2 });
    expect(d.topics.t.items).toEqual({});
    expect(d.topics.t.lastPlayed).toBe(2);
  });

  it('bumps overall AND the item tally when itemKey is present', () => {
    let d = emptyStats();
    d = applyEvent(d, { topicId: 'iv', correct: true, itemKey: 'm6', itemLabel: 'Minor 6th', ts: 1 });
    d = applyEvent(d, { topicId: 'iv', correct: false, itemKey: 'm6', itemLabel: 'Minor 6th', ts: 2 });
    d = applyEvent(d, { topicId: 'iv', correct: true, itemKey: 'P5', itemLabel: 'Perfect 5th', ts: 3 });
    expect(d.topics.iv.overall).toEqual({ correct: 2, total: 3 });
    expect(d.topics.iv.items.m6.tally).toEqual({ correct: 1, total: 2 });
    expect(d.topics.iv.items.m6.label).toBe('Minor 6th');
    expect(d.topics.iv.items.P5.tally).toEqual({ correct: 1, total: 1 });
  });

  it('overall.total equals the sum of item totals when every attempt has an item', () => {
    let d = emptyStats();
    for (let i = 0; i < 5; i++) d = applyEvent(d, { topicId: 'x', correct: i % 2 === 0, itemKey: 'a' });
    for (let i = 0; i < 3; i++) d = applyEvent(d, { topicId: 'x', correct: true, itemKey: 'b' });
    const items = d.topics.x.items;
    expect(items.a.tally.total + items.b.tally.total).toBe(d.topics.x.overall.total);
  });

  it('does not mutate its input', () => {
    const d0 = emptyStats();
    const d1 = applyEvent(d0, { topicId: 't', correct: true });
    expect(d0.topics).toEqual({});
    expect(d1).not.toBe(d0);
  });
});

describe('mergeStats', () => {
  it('sums overall and per-item counters across two blobs', () => {
    let a = emptyStats();
    a = applyEvent(a, { topicId: 't', correct: true, itemKey: 'm6', itemLabel: 'Minor 6th' });
    let b = emptyStats();
    b = applyEvent(b, { topicId: 't', correct: false, itemKey: 'm6', itemLabel: 'Minor 6th' });
    b = applyEvent(b, { topicId: 'u', correct: true });

    const m = mergeStats(a, b);
    expect(m.topics.t.overall).toEqual({ correct: 1, total: 2 });
    expect(m.topics.t.items.m6.tally).toEqual({ correct: 1, total: 2 });
    expect(m.topics.u.overall).toEqual({ correct: 1, total: 1 });
  });
});

describe('hasAnyAttempts', () => {
  it('is false for empty, true once anything is recorded', () => {
    expect(hasAnyAttempts(emptyStats())).toBe(false);
    expect(hasAnyAttempts(applyEvent(emptyStats(), { topicId: 't', correct: false }))).toBe(true);
  });
});
