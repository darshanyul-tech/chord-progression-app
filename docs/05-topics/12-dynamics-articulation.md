# Topic 12 — Dynamics & Articulation (`dynamics-articulation`) — NEW

**Status:** new build (no legacy source). Category: Musical Elements (unlocks the category — it currently renders only because this topic is visible). Theme: light.
**Reuse mandate (D13/D15):** playback via the shared sampler + `lib/audio/playback.ts` (`scheduleSamplerTrigger` already takes per-note `velocity` and `duration` — those two parameters are the entire audio surface this topic needs); scale math from `lib/theory.ts`; recognition scoring frame; settings via `createPersistedSettingsStore`. New logic framework-free in `src/lib/recognition/dynamicsArticulation.ts`, unit-tested.

## 1. Exercise

Two sub-modes, selected in settings (one topic, not two — they share the phrase engine and frame):

- **Dynamics (comparative):** a short phrase plays twice at different velocities; answer **"Second louder", "Second softer", or "Same"**. Comparative, *not* absolute (pp/mf/ff labels), because absolute loudness judgment over unknown speakers/system volume is unreliable — relative comparison is robust to it. This is the binding design decision of the topic.
- **Articulation:** one phrase plays with a single articulation applied throughout; answer **staccato / legato / accented / tenuto**.

Up to 3 attempts, first-guess-only scoring, reveal names the actual answer, optional auto-advance — the standard frame.

## 2. Settings

| Setting | Control | Values / default |
|---|---|---|
| Mode | select | dynamics✓ / articulation |
| Difficulty (dynamics) | select | easy (velocity gap 0.30)✓ / medium (0.18) / hard (0.10) |
| Articulations to include | checkboxes (articulation mode) | all four✓; at least 2 required |
| "Same" ratio (dynamics) | fixed ~1/3 (same base-rate reasoning as Tuning) | — |
| Phrase length | select | 3 notes / 4 notes✓ / 5 notes |
| Tempo | slider | 60–140 BPM, default 96 |
| Auto-advance | toggle | off✓ |

**Storage schema** (`eartrainer.v1.settings.dynamics-articulation`):
`{ mode, difficulty, enabledArticulations: string[], phraseLen, tempo, autoAdvance }`

## 3. Question generation (Tier-1, `lib/recognition/dynamicsArticulation.ts`)

1. **Phrase:** a random stepwise diatonic fragment — pick a major-scale root (C3–C5 window), then `phraseLen` scale degrees walking by ±1 step with one allowed leap of a third. Deliberately bland: the phrase is a *carrier*, and melodic interest would distract from the loudness/length judgment. No reuse of `lib/melody/generator.ts` — it generates notated, rhythm-bearing measures and drags VexFlow concerns in; this needs six lines of scale walking.
2. **Dynamics question:** base velocity uniform in 0.45–0.65; roll same-vs-different (~1/3 same); different: second phrase's velocity = base ± the difficulty's gap (coin-flip louder/softer, clamped to 0.15–0.95). Output `{ phraseMidis, velocityA, velocityB, answerId: 'louder' | 'softer' | 'same' }`.
3. **Articulation question:** pick from the enabled pool. Articulation table (exported constant so tests can assert coverage):
   - `staccato`: note length 25% of the beat, velocity 0.6
   - `legato`: note length 105% of the beat (slight overlap), velocity 0.6
   - `accented`: note length 70%, velocity 0.9 on every note
   - `tenuto`: note length 95% (full value, no overlap), velocity 0.6
   Output `{ phraseMidis, articulationId, answerId }`.

Seedable randomness throughout.

## 4. Playback

Beat length = 60/tempo. Dynamics: phrase at `velocityA`, pause (1 beat), phrase at `velocityB` — identical notes, identical timing, only velocity differs (assert this in tests: the schedule differs in nothing else). Articulation: one phrase with the table's duration/velocity applied per note. Standard channel cancellation, identical Replay, Replay-disabled-while-sounding.

## 5. Transport / feedback / score

Standard recognition pattern. Answer buttons come from the mode: three fixed for dynamics, the enabled articulation subset for articulation. Reveal for dynamics states the direction ("Second was softer"); for articulation names it with a one-line description ("Staccato — short, detached notes"). Session score + reset (one shared score for the topic, not per mode — switching modes mid-session is a settings change and clears the in-progress question, standard convention).

## 6. Exam contribution

Registers recognition exam type `dynamicsArticulation` (shared schema). `buildPaper` uses the topic's persisted settings including its current mode. Per-type empty-paper message when articulation mode has <2 enabled articulations (Phase 12.6 convention).

## 7. Unit tests

- Phrase generator: length matches `phraseLen`; all notes diatonic to the chosen scale; steps except at most one third.
- Dynamics builder: 500 seeded questions — same/louder/softer frequencies within bounds; velocity gap exactly the difficulty's value; velocities always inside 0.15–0.95 (the clamp must not silently produce a gap smaller than the difficulty promises — reflect, don't clamp, when the base is too close to an edge, same trick as chord comparison's transposed root).
- Articulation builder: only enabled articulations appear; disabling below 2 → null; table integrity (every id has duration + velocity).

## 8. Acceptance criteria

- Dynamics at hard difficulty is subtle but audible on laptop speakers (manual spot-check); "Same" questions are truly identical schedules.
- Articulation: staccato and legato are unmistakable; accented vs tenuto is the intended hard pair.
- Standard recognition checklist (docs/08 §3): scoring, reveal, persistence, exam integration.
- The Musical Elements category header appears in the syllabus menu with this topic active.
