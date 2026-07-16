# 10 — Next Phases (17–20): Singing Hardening + Comparison Topics + Chord Singing

Continuation of `09-improvement-plan.md`, which closed at v2.0.0 (Phase 16, Interval
Singing). This plan hardens the new microphone surface, clears the loose ends found in the
post-v2.0.0 audit of Phases 10–16, then unparks three "soon" topics with full specs in
`docs/05-topics/08–10`.

**Conventions carried forward (binding, unchanged):**
- Two-tier protocol (D15): new logic framework-free in `src/lib/`, unit-tested; React thin.
- Seedable randomness: every generator draws through `lib/theory.ts`'s `random()`/`pick()`.
- No co-author trailers in commit messages.
- Every phase ends with: `npx vitest run`, `npx tsc -b`, `npm run lint`, `npm run build`,
  `npm run test:coverage` (per-file ≥90% on `src/lib/`) all clean, live browser verification
  of the changed surface, commit + push, CI green.
- Verify claims against current code before acting — details below reflect v2.0.0
  (commit `31f02f0`).

---

## Phase 17 — Interval Singing hardening & audit loose ends (S–M)

Everything found in the phases 10–16 audit that is worth closing. Items 1–3 are real
defects; the rest are small gaps between plan text and what shipped. Land as separate
commits.

### 17.1 Release the microphone on topic deactivate (defect — privacy-adjacent)
`mic.stopMic()` is never called from any topic or hook: leave Interval Singing and the
mic stream stays open — the browser tab's recording indicator stays lit indefinitely,
directly undercutting the "audio never leaves the device" trust message. Fix: call
`mic.stopMic()` from the deactivation path in `interval-singing/usePractice.ts` (extend the
`useStopOnDeactivate` pattern or a parallel `useEffect` on `useIsActiveTopic`), and on
unmount. Re-arming after returning to the topic must go through the Enable-microphone
gesture again (acceptable; permission is remembered by the browser so it's one click).
Verify: recording indicator disappears on topic switch; returning + re-enabling works.

### 17.2 Wire or delete the dead `autoAdvance` setting (defect — dead code)
`IntervalSingingSettings.autoAdvance` exists (default false) but has no Settings toggle and
no behavior. **Recommendation: wire it** — after a correct capture (phase `done`), start the
next question after `RECOGNITION_AUTO_ADVANCE_MS`, matching every recognition topic; add the
standard toggle to `Settings.tsx`. Deleting it instead is acceptable but wiring is ~15 lines.

### 17.3 Ambient-noise RMS calibration (deferred §16.4 mitigation)
The tracker uses a fixed `rmsThreshold: 0.01`. The plan's mitigation list called for
calibrating against a ~2 s ambient sample when the mic opens (laptop fans/room noise vary by
an order of magnitude). Implement in `mic.ts` or the practice hook: after `requestMic()`
resolves, collect RMS over the first ~2 s of frames (UI: "calibrating…"), set the round's
threshold to `max(0.01, ambientMedian × 3)`. Tier-1 helper (`calibrateRmsThreshold(frames)`)
with unit tests; store nothing (recalibrate per mic open).

### 17.4 Small plan-vs-shipped gaps (one cleanup commit)
- **Favicon PNG fallback** (11.2 specced "SVG + PNG"; only `favicon.svg` shipped): done —
  added `favicon-192.png` / `favicon-512.png` (rendered from `favicon.svg`) plus
  `<link rel="icon">` and `apple-touch-icon` tags in `index.html`.
- **Title**: plan said "Ear Trainer — ECU", shipped "Ear Trainer". Done — kept "Ear Trainer"
  and amended 09-improvement-plan.md §11.2 to match (branding in a tab title buys nothing).
- **Progression dead code** flagged in the Phase 15 coverage commit: `makeTritoneSub` was
  exported+tested but unreachable from `buildBarChord`'s colour branch. Done — wired in as a
  `'tritonesub'` colour choice gated behind `s.chromaticism`, reusing secdom's target
  selection (it's the same harmonic slot, resolved a half-step above instead of a fourth
  below); `generator.test.ts` now reaches it via `generateProgression` directly. Also removed
  the unreachable subdominant-fallback guard in `buildBarChord` (the `candidates` filter
  already excludes `'subdominant'` whenever `!s.useSubdominant`, so `fnName` could never
  equal `'subdominant'` there).
- **CI-on-PR proof**: the Phase 15 gate said "CI green on a PR"; all runs so far were
  push-triggered. Partially done — pushed this phase's commit on a branch
  (`phase17-ci-pr-proof`) intending to open a PR, but `gh` isn't authenticated in this
  environment and PR creation needs the user's GitHub credentials, so the branch was
  fast-forward-merged to `main` directly instead (both `CI` and `Azure Static Web Apps
  CI/CD` came back green on push, confirmed via the public API). Opening an actual PR to
  exercise the `pull_request` trigger specifically is still open — a user task.

### 17.5 Manual browser matrix for the mic surface (user task — cannot be automated here)
§16.4's matrix was never run: Chrome, Firefox, Safari (desktop) + iOS Safari and Android
Chrome. Checklist per browser: Initialize Audio → Enable microphone → complete one round →
deny-permission path. Known risk to watch on iOS: the AudioContext must resume from the same
gesture that grants the mic. Record results in the phase's closing commit message; file
fixes as they surface.

**Gate:** mic indicator provably clears on topic switch; calibration visibly adapts the
threshold (log or debug read-out during verification); all four 17.4 items closed; matrix
results recorded (or explicitly deferred with reasons per browser).

---

## Phase 18 — Interval Comparison (M) — spec: `docs/05-topics/08-interval-comparison.md`

Build order (one commit per step, same rhythm as previous topic builds):
1. Tier-1 `lib/recognition/intervalComparison.ts` (settings type + defaults, question
   builder with difficulty floors / same-question rolls / shared-direction rule) + unit
   tests (seeded distribution checks per the spec §7).
2. Tier-2: settings store, `src/topics/interval-comparison/` (Settings, usePractice on the
   standard recognition frame, topic component with `ChoiceGrid` of 2–3 answers), registry
   flip to active.
3. Exam type `intervalComparison` + per-type empty-paper message; a11y pass (axe suite
   gains the topic automatically via `a11y.test.tsx` — add it there).

**Gate:** spec §8 acceptance criteria; full standard topic checklist (docs/08 §3); tag
**v2.1.0**.

---

## Phase 19 — Chord Comparison (M) — spec: `docs/05-topics/09-chord-comparison.md`

1. Tier-1 `lib/recognition/chordComparison.ts`: the three confusion-tier tables (the core
   design — reviewed by ear before coding the builder), builder with 50/50 same/different,
   eligibility filtering, transposed-root mode + tests (spec §7 incl. table-integrity
   assertions).
2. Tier-2 topic + settings + registry flip; reuse chord recognition's grouped-pool settings
   layout.
3. Exam type `chordComparison`; a11y suite entry.

**Gate:** spec §8; a musician spot-checks tier 3 pairs actually sound hard; tag **v2.2.0**.

---

## Phase 20 — Chord Singing (M–L) — spec: `docs/05-topics/10-chord-singing.md`

Depends on Phase 17 (mic release + calibration land first — this topic inherits them).

1. Tier-1 `lib/pitch/chordSinging.ts` (singable-subset assertion, question builder,
   `gradeArpeggio` pure helper) + tests (spec §7).
2. **Extract `PitchMeter` to `src/components/PitchMeter.tsx`** (second consumer rule) —
   separate commit touching interval-singing only mechanically.
3. Tier-2: settings store, `src/topics/chord-singing/` (usePractice with the sequential
   tone-capture round flow of spec §4, tone-progress strip, echo/construction modes),
   registry flip. No exam type (documented deferral, same as Interval Singing).
4. Manual gate with a singer (spec §8) — same ≥9/10 bar as Phase 16.

**Gate:** spec §8 in full; all existing tests still green; tag **v2.3.0**.

---

## Explicitly not in this plan (defer, do not build)

Sight Singing (needs melodic prompt + notation display + the pitch stack — plan it after
Chord Singing proves multi-tone capture), Tuning, Dynamics & Articulation, custom topic
authoring, exam types for singing topics, inversion-aware chord comparison, PWA/offline,
Tone.js 15 upgrade.

## Suggested order & sizing

| Phase | Size | Depends on |
|---|---|---|
| 17 singing hardening | S–M | — (do first; 20 inherits it) |
| 18 interval comparison | M | — |
| 19 chord comparison | M | 18 only for shared review rhythm (technically independent) |
| 20 chord singing | M–L | 17 |

Tag v2.1.0 / v2.2.0 / v2.3.0 after Phases 18 / 19 / 20 respectively; Phase 17 rides into
the v2.1.0 tag (no separate release).
