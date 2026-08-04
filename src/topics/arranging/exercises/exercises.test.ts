import { describe, expect, it } from 'vitest';
import { ARRANGING_EXERCISE_LIST } from './index';

// Spec §9 determinism / integrity sweep: for every exercise, generating many
// questions with default settings must always yield a well-formed question, and
// the graded answer key must be internally consistent.
describe('Arranging exercises — integrity sweep', () => {
  for (const exercise of ARRANGING_EXERCISE_LIST) {
    it(`${exercise.id} generates consistent questions`, () => {
      for (let i = 0; i < 300; i++) {
        const q = exercise.generate(exercise.defaultSettings);
        expect(q, `${exercise.id} returned null with default settings`).not.toBeNull();
        if (!q) continue;
        if (q.kind === 'mc') {
          const ids = new Set(q.choices.map((c) => c.id));
          expect(q.answerIds.length, `${exercise.id} has no answer`).toBeGreaterThan(0);
          for (const a of q.answerIds) expect(ids.has(a), `${exercise.id}: answer '${a}' not among choices`).toBe(true);
        } else if (q.kind === 'multi') {
          const ids = new Set(q.choices.map((c) => c.id));
          for (const a of q.correctIds) expect(ids.has(a), `${exercise.id}: correct '${a}' not among choices`).toBe(true);
        } else if (q.kind === 'order') {
          expect([...q.correctOrder].sort()).toEqual(q.items.map((i2) => i2.id).sort());
        } else if (q.kind === 'stacked') {
          // The example/reveal answer must itself pass the grader.
          const graded = q.grade(q.reveal);
          expect(graded.correct, `${exercise.id}: reveal answer failed its own grader — ${graded.message}`).toBe(true);
          expect(q.prefill.length).toBe(q.voiceCount);
        }
      }
    });
  }
});
