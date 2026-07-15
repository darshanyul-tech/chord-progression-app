# Topic 08 — Interval Comparison (`interval-comparison`) — NEW

**Status:** new build (no legacy source — the legacy file never implemented this). Category: Intervals & Scales. Theme: light.
**Reuse mandate (D13/D15):** interval table from `lib/recognition/intervals.ts` (`INTERVAL_TYPES`); playback via the shared sampler + `lib/audio/playback.ts` channel pattern; recognition scoring frame (`useScoresStore`, `TransportRow`, `StatusLine`, `SessionScoreLine`, `ChoiceGrid`); settings via `createPersistedSettingsStore`. All new logic framework-free in `src/lib/recognition/intervalComparison.ts`, unit-tested.

## 1. Exercise

Two intervals play in sequence (pair A, pause, pair B); the user answers **which interval is larger** — "First", "Second", or (when enabled) "Same". Up to 3 attempts (`RECOGNITION_MAX_GUESSES`); only the first counts toward the session score. Reveal names both intervals ("First: Perfect 4th · Second: Minor 6th"); optional auto-advance (`RECOGNITION_AUTO_ADVANCE_MS`).

This trains interval *size* perception directly, complementing Interval Recognition's *identity* training — the standard companion exercise in ear-training curricula.

## 2. Settings

| Setting | Control | Values / default |
|---|---|---|
| Included intervals | per-interval checkbox list (reuse the pool concept; a single on/off per type — no direction axis) | the 14 `INTERVAL_TYPES`; default m2–P5 on (matches recognition's default band) |
| Direction | select | ascending✓ / descending / both (resolved per pair; both intervals in a question share one direction so size is the only variable) |
| Difficulty | select | easy (≥3 semitones apart) / medium (≥2)✓ / hard (adjacent sizes allowed, ≥1) |
| Allow "Same" | toggle | off✓; when on, ~25% of questions play the same interval type twice (different roots) and "Same" joins the answers |
| Root relationship | select | different roots✓ / same root (same-root pairs are easier — pure size comparison; different roots force abstraction) |
| Note length | slider | 0.25–1.2 s, default 0.55 (match interval recognition) |
| Gap between notes | slider | 0–0.5 s, default 0.12 |
| Pause between intervals | slider | 0.3–2.0 s, default 0.8 |
| Auto-advance | toggle | off✓ |

**Storage schema** (`eartrainer.v1.settings.interval-comparison`):
`{ enabledIntervals: Record<id, boolean>, direction, difficulty, allowSame, rootRelationship, noteLen, gapLen, pairPauseSec, autoAdvance }`

## 3. Question generation (Tier-1, `lib/recognition/intervalComparison.ts`)

1. Filter `INTERVAL_TYPES` to the enabled pool; require ≥2 enabled types whose semitone difference satisfies the difficulty floor (else return null → "adjust settings" message, same convention as other builders).
2. If "Same" is enabled, first roll same-vs-different (25% same). Same: pick one type, two roots.
3. Different: pick the first type uniformly, then pick the second uniformly from enabled types whose |semitones − first.semitones| ≥ difficulty floor. Coin-flip which of the pair plays first (the larger one must not correlate with position).
4. Roots: uniform in the recognition root window (`48–72` minus the interval span, same clamp as `buildIntervalExamQuestion`); "same root" setting forces root B = root A.
5. Resolve one shared direction per question when the setting is "both".
6. Output: `{ first: {typeId, semitones, rootMidi}, second: {…}, direction, answerId: 'first' | 'second' | 'same' }`.

All randomness through `lib/theory.ts`'s `random()`/`pick()` (seedable, Phase 15 convention).

## 4. Playback

Four sampler notes: interval A (two notes, noteLen/gap), pause (`pairPauseSec`), interval B. Standard channel cancellation; Replay replays the identical pair; Stop halts mid-sequence. Replay disabled while the hearing is still sounding (`scheduleChannelDone` + `replayDisabled`, Phase 12.1 convention).

## 5. Transport / feedback / score

Standard recognition pattern: Initialize audio → Play pair → Replay → Stop → answer buttons ("First is larger" / "Second is larger" / "Same") → Next. First-guess-only scoring; correct answer highlighted at reveal with both interval names in the prompt line. Session score + reset.

## 6. Exam contribution

Registers recognition exam type `intervalComparison` (shared count/reps/spacing/replays schema). `buildPaper` uses the topic's persisted settings; per-type empty-paper message when the pool can't satisfy the difficulty floor (Phase 12.6 convention). Choices are the same 2–3 buttons.

## 7. Unit tests

- Builder: 500 questions per difficulty — semitone gap always ≥ floor; larger interval's position ~50/50 (chi-square sanity bounds, seeded); "same" appears only when enabled and within frequency bounds; null when pool can't satisfy the floor.
- Same-root setting: root B === root A in all generated questions.
- Direction: both intervals of a pair always share it.

## 8. Acceptance criteria

- With only m2+M2 enabled at hard difficulty, questions still generate (gap 1); at easy difficulty the builder returns null and the UI explains why.
- First-guess-only scoring verified (wrong→right = total+1, correct+0).
- Replay reproduces the identical pair (same types, roots, direction).
- Settings persist across reload; score does not; exam type appears in exam setup and runs end-to-end.
