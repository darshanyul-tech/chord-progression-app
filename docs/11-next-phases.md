# 11 — Next Phases (21–25): Remaining Visible Topics + Platform Backlog

Continuation of `10-next-phases.md`, which closed at v2.3.0 (Phase 20, Chord Singing).
This plan covers the four sections still showing "soon" in the syllabus menu — Tuning,
Dynamics & Articulation, Sight Singing, and Custom Topics — with full specs in
`docs/05-topics/11–14`, plus a named backlog for the platform items every previous plan
has deferred. After Phase 24 the visible front end has **no placeholder topics left**.

**Conventions carried forward (binding, unchanged):**
- Two-tier protocol (D15): new logic framework-free in `src/lib/`, unit-tested; React thin.
- Seedable randomness: every generator draws through `lib/theory.ts`'s `random()`/`pick()`.
- No co-author trailers in commit messages.
- Every phase ends with: `npx vitest run`, `npx tsc -b`, `npm run lint`, `npm run build`,
  `npm run test:coverage` (per-file ≥90% on `src/lib/`) all clean, live browser verification
  of the changed surface, commit + push, CI green.
- Verify claims against current code before acting — details below reflect v2.3.0
  (commit `f2e2b31`).

**Outstanding user-only items inherited from plan 10 (not blocking, but do them):**
- Phase 17.5 manual browser/mic matrix (Chrome/Firefox/Safari desktop + iOS Safari/Android
  Chrome) — never run.
- Phase 20 manual singer gate for Chord Singing (≥9/10) — **Phase 23 below is blocked on
  this one**, since Sight Singing stretches the same capture loop further.
- CI-on-PR proof (one PR through the `pull_request` trigger) — needs the user's GitHub
  credentials.

---

## Phase 21 — Tuning (S) — spec: `docs/05-topics/11-tuning.md`

The smallest remaining topic and the only one touching the audio layer's signature: no mic,
three fixed answer buttons, difficulty = detune magnitude.

1. Audio: extend `scheduleSamplerTrigger` to accept Hz values (or a sibling helper — spec §4)
   + a unit test that the Hz path round-trips through `centsBetween`.
2. Tier-1 `lib/recognition/tuning.ts` (builder, fixed choice defs) + tests (spec §7).
3. Tier-2 topic + settings + registry flip; exam type `tuning`; a11y suite entry; ExamSetup
   test count 9 → 10.

**Gate:** spec §8; hard difficulty spot-checked by ear; tag **v2.4.0**.

---

## Phase 22 — Dynamics & Articulation (M) — spec: `docs/05-topics/12-dynamics-articulation.md`

Unlocks the Musical Elements category. Comparative dynamics (never absolute — spec §1's
binding decision) + four articulations via velocity/duration only.

1. Tier-1 `lib/recognition/dynamicsArticulation.ts` (phrase walker, dynamics builder with
   reflect-not-clamp velocity placement, articulation table) + tests (spec §7).
2. Tier-2 topic with mode-switched answer buttons + settings + registry flip; exam type
   `dynamicsArticulation`; a11y entry; ExamSetup count 10 → 11.

**Gate:** spec §8 incl. the laptop-speaker spot-check; the Musical Elements category header
appears; tag **v2.5.0**.

---

## Phase 23 — Sight Singing (L, microphone) — spec: `docs/05-topics/13-sight-singing.md`

**Blocked on the Phase 20 manual singer gate** (user task above). Third mic topic: notated
melody displayed via the existing VexFlow display path, sung note-by-note through the Chord
Singing capture loop. Pitch only — no rhythm grading in v1 (spec §1's binding decision).

1. Tier-1 `lib/pitch/sightSinging.ts` (melody-to-target flattening, vocal-window clamping
   with transposition fallback, `gradeSungMelody`) + tests (spec §7).
2. If `gradeSungMelody` and Chord Singing's `gradeArpeggio` come out identical, extract the
   shared helper — separate mechanical commit (second-consumer rule at Tier-1).
3. Tier-2: settings store, `src/topics/sight-singing/` (read-only staff host, per-note
   highlight/tick/cross on the staff, `PitchMeter`, Chord Singing's round flow), registry
   flip (lazy chunk like the other mic topics). No exam type.
4. Manual singer gate (spec §8, ≥9/10) — user task, recorded like Phases 16/20.

**Gate:** spec §8 (item 4 user-only, recorded not blocking the tag); tag **v2.6.0**.

---

## Phase 24 — Custom Topics: settings presets (M) — spec: `docs/05-topics/14-custom-topics.md`

Presets, **not** authoring (spec §1's binding scope decision). Independent of Phases 21–23;
sequenced last only so its "Save as custom topic…" button lands on every topic at once.

1. Tier-1 `lib/custom/presets.ts` (CRUD, name validation, `sanitizePresets`) + tests
   (spec §5), incl. the schema-drift apply test.
2. `useCustomPresets` store + syllabus-menu section + management page (registry flip of
   `custom-topic`); "Save as custom topic…" shared button wired into every active topic's
   Settings card.
3. a11y entry for the management page. No exam contribution.

**Gate:** spec §6; after this phase the syllabus menu shows zero "soon" badges; tag
**v2.7.0**.

---

## Phase 25 — Platform backlog (unscheduled — pull items in deliberately, don't drift in)

Named so the standing deferrals live somewhere visible instead of only in old plans'
"explicitly not" lists. Each is its own decision when pulled:

- **PWA/offline** (self-hosted samples make this mostly a manifest + service-worker task,
  but cache invalidation across releases needs design).
- **Tone.js 15 upgrade** (pinned at 14.8.49 by D-series decision; revisit only with the
  `standardized-audio-context` worklet lesson from Phase 16 in hand — see project memory).
- **Exam types for the singing topics** (needs a timing/retry design of its own; three
  topics now share the deferral).
- **Inversion-aware chord comparison** (spec 09 §4 explicitly scoped it out).
- **Rhythm-graded singing** (spec 13 §1 scoped it out of Sight Singing).
- **Full custom-exercise authoring** (spec 14 §1 scoped it out of presets).

## Explicitly not in this plan (defer, do not build)

Everything on the hidden/parked topic list (jazz scales, cluster chords, rhythm comparison/
imitation/styles, two-part rhythm dictation, Nashville numbers, modulation, phrase structure,
jazz forms, pitch dictation, melodic comparison, note recognition, contour, repertoire,
tempo & texture) stays parked; unhiding any of them starts with its own spec doc, not code.

## Suggested order & sizing

| Phase | Size | Depends on |
|---|---|---|
| 21 Tuning | S | — (do first; smallest, touches audio signature) |
| 22 Dynamics & Articulation | M | — |
| 23 Sight Singing | L | Phase 20's manual singer gate (user task) |
| 24 Custom topic presets | M | — (last so the save button lands on all topics at once) |
| 25 Platform backlog | — | unscheduled |

Tag v2.4.0 / v2.5.0 / v2.6.0 / v2.7.0 after Phases 21 / 22 / 23 / 24 respectively. If
Phase 23 stays blocked on the singer gate, run Phase 24 ahead of it and swap the two tags —
the phases are independent.
