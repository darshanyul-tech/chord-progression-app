# 09 — Post-v1.0.0 Improvement Plan (Phases 10–16)

Continuation of `08-implementation-plan.md`. v1.0.0 shipped all seven active topics plus exam
mode; this plan brings each of those to a professional standard, then adds the first
microphone-based topic (Interval Singing). Phases are ordered so that every phase leaves the
app shippable, same discipline as Phases 0–9.

**Conventions carried forward (binding):**
- Two-tier protocol (D15): all new logic (pitch detection, scoring) is framework-free in
  `src/lib/`, unit-tested; React components stay thin.
- No co-author trailers in commit messages.
- Every phase ends with: `npx vitest run` clean, `npx tsc -b` clean, `npm run lint` clean,
  `npm run build` clean, live browser verification of the changed surface, commit + push.
- Verify claims in this doc against the current code before acting on them — file paths and
  line-level details reflect the state at v1.0.0 (commit `54dc46e` + the Phase 10 commit).

---

## Phase 10 — Front-end de-clutter (DONE in the same session this doc was written)

Parked 17 topics off the visible front end while keeping them trivially restorable:

- **Mechanism:** `TopicDefinition.hidden?: boolean` flag in `src/topics/registry.ts`.
  `SyllabusMenu` filters `!t.hidden` and drops category headings with no visible topics
  (which removes the whole Repertoire section); `TopicRoute` in `App.tsx` redirects direct
  URLs for hidden topics to the default topic. **Restore = delete the flag** from the entry.
- **Parked:** Jazz Scales, Cluster Chords, Jazz Chords, Rhythm Comparison, Rhythm Imitation,
  Rhythm Styles, Two-Part Rhythm Dictation, Nashville Numbers, Modulation, Phrase Structure &
  Form, Jazz Forms, Pitch Dictation, Melodic Comparison, Note Recognition, Contour,
  Repertoire Listening (+ its category), Tempo & Texture.
- **Still visible as "soon":** Interval Comparison, Interval Singing (Phase 16 builds it),
  Tuning, Chord Comparison, Chord Singing, Sight Singing, Dynamics & Articulation,
  Create a custom topic.

---

## Phase 11 — Professional polish: cross-cutting app quality

Fixes that apply to the whole shell, before per-topic passes. Each item is independent;
land them as separate commits within the phase.

### 11.1 Error containment
- Add a top-level React `ErrorBoundary` (new `src/shell/ErrorBoundary.tsx`) wrapping
  `<RouterProvider>` in `App.tsx`, and a per-topic boundary inside `TopicHost`'s
  `.topic-view` wrapper so one topic crashing (e.g. a VexFlow render throw) shows an inline
  "This exercise hit an error — Reload topic" card instead of white-screening the app.
  The per-topic boundary needs a `key={t.id}` reset button that remounts the topic subtree.
- Audio failure path: `audio.initAudio()` failures currently surface only as a status line
  in some topics. Standardize: every topic's Initialize button shows the error state and a
  Retry affordance (the engine already exposes `lastError`).

### 11.2 App identity & metadata
- `index.html`: proper `<title>` ("Ear Trainer"), meta description, theme-color,
  favicon set (SVG + PNG fallbacks; a simple treble-clef or tuning-fork mark), Open Graph
  tags. Currently the Vite default favicon ships.

  (Amended 2026-07-16, Phase 17.4: shipped title is "Ear Trainer" without the "— ECU"
  suffix — branding in a browser tab title buys nothing, so the doc is aligned to what
  shipped rather than the reverse.)
- Version display: read `package.json` version via Vite `define` and show it in the footer
  (`v1.0.0`), so bug reports can name a build. Bump `package.json` version each phase.
- `README.md` at repo root: what the app is, dev commands (`npm run dev/test/lint/build`),
  architecture pointer to `docs/`, deployment note (Azure SWA).

### 11.3 Feedback & status consistency audit
Each topic evolved its own microcopy. Normalize:
- One canonical status vocabulary: "Loading samples…", "Audio ready.", "Listening…",
  "Stopped.", "Correct! +1", "Incorrect — …". Sweep every `setStatusText` call site.
- `StatusLine` should be `aria-live="polite"` (screen readers currently miss status
  changes). One-line change in `src/components/StatusLine.tsx`, verify no double-announce.
- Session-score lines: unify format ("Session: N / M (first-guess correct)" vs rhythm's
  bare "N / M") via the shared `SessionScoreLine` everywhere (rhythm/melodic dictation
  currently hand-roll theirs).

### 11.4 Known cosmetic debt (from Phases 4–8 commit notes — fix all)
1. **Progression exam panel**: no per-bar highlight during hearings. Legacy highlighted the
   sounding bar. Wire `schedulePlayback`'s existing `onBarActive` hook into
   `ProgressionExamAnswer` via a callback prop threaded through `ExamPlayContext.onPhase`-style
   channel or a small event emitter on the question object. Keep the exam interface generic:
   add an optional `onProgress?: (payload: unknown) => void` to `ExamPlayContext` that
   `ExamActive` forwards into the answer component as a prop.
2. **Melodic dictation staff**: (a) no playback-position indication — add a cursor line like
   the rhythm staff's `playbackFraction` (the model/render split already supports adding a
   `playbackFraction: number | null` to `MelodyStaffModel`; drive it from `usePractice`'s
   playback scheduling with a rAF loop mirroring rhythm-dictation's); (b) no invalid-placement
   flash — port the `flashMeasure` mechanic (state + 280 ms timeout + a red stave style in
   `buildVexScore`, same convention as `render.ts`'s `flashMeasure`); (c) no capacity hint —
   reuse rhythm dictation's `capacityHint` computation (`maxNotesOfDuration` per active
   duration) under the staff.
3. **Exam dictation answer palettes** (`src/topics/*/ExamAnswer.tsx`): currently text
   buttons ("1", "2", …) with `secondary`/`ghost` classes. Upgrade to the same
   `NoteGlyphIcon`/`RestGlyphIcon` glyph buttons and armed/disabled styling the practice
   topics use, plus dot/backspace/clear parity and the keyboard map (1–8/R/D/S/F/Backspace).
   Extract the palette into a shared component (`src/components/NotePalette.tsx`) consumed
   by both practice topics and both exam answer components so it can't drift again — this
   also clears the two standing `react-refresh/only-export-components` lint warnings by
   reorganizing those files.
4. **`interval-choice-grid` quirk**: interval questions in exam mode set
   `choiceLayoutClass: 'interval-choice-grid'` — a class with no CSS rule (verbatim legacy
   bug). `ExamChoicePicker` currently ignores layout classes entirely (always
   `chord-choice-grid`), which accidentally fixed the layout; delete the dead
   `choiceLayoutClass` field from `IntervalQuestion` and the builder to remove the trap.
5. **Rhythm dictation count-in dots**: `#rd-countin-dots { display:none }` was ported
   verbatim. Decide: either delete the dead DOM + state (`countinLit`) or un-hide the dots
   as a visible count-in indicator. Recommendation: un-hide — it's already fully wired and
   a visible count-in is better UX; just remove the `display:none` rule and style the dots.
6. **"Dotted half = 2.5 beats" legacy mislabel** (`DUR_LABELS`, `vexDurationFor`): keep the
   verbatim behavior (grading depends on it) but rename the *label* shown to users from
   "Dotted half" to something honest, or migrate the value to 3.0 with a settings migration.
   Recommendation: migrate to a true 3-beat dotted half (update `DUR_LABELS`, settings
   default migration in the persisted store's `merge`, `vexDurationFor` mapping, and the
   palette `H.` button), since nothing external depends on 2.5. This is the one deliberate
   behavior change in the phase — call it out in the commit.

### 11.5 Mobile pass (real-device)
- Manual check on a phone: drawer open/close (the automated browser showed a
  transition-related rendering quirk — confirm it's environment-only), staff touch
  placement accuracy on both staves, palette button hit targets (≥44px), exam flow.
- Fix anything found; add `touch-action: manipulation` on palette/staff to kill 300 ms
  delays and double-tap zoom on rapid note entry.

**Gate:** all six 11.4 items closed; error boundary demonstrably catches a thrown render
(temporarily throw in a topic to verify); mobile checklist done on at least one real device.

---

## Phase 12 — Professional polish: per-topic deep pass

One commit per topic. For each: play 10+ questions end-to-end, fix everything on its list,
and leave a short "known-good" note in the commit message.

### 12.1 Interval Recognition / Scales / Chord Recognition (mature — light pass)
- Verify auto-advance timing feels right (450 ms constant) and Replay is disabled while
  unanswered question audio is still playing rather than restarting mid-note.
- Chord Recognition: block vs arpeggio settings visibility toggle (`settings-hidden`) —
  confirm it doesn't collapse layout jarringly; animate height or reserve space.
- Scales: descend toggle + 8-note scales at fast tempi — check note scheduling doesn't
  overlap-release (Sampler releaseAll timing).

### 12.2 Meter Recognition
- Sound-mode "melodic" currently uses the percussion engine's fixed sine pitches — dull for
  long excerpts. Improvement: route melodic mode through the piano sampler with a repeated
  tonic (keeps D12 reuse; ~20 lines in `useMeterPractice.playQuestion`).
- Add a "listen again" affordance mid-question distinct from Replay-after-answer (currently
  Replay exists — verify it replays the identical excerpt; it does, assert it in a test).
- Guard rail: if user un-checks down to 2 signatures and both are near-ambiguous (2/4+4/4)
  with neutral emphasis, surface the existing help text more prominently (inline warning
  under the answer grid, not just in settings).

### 12.3 Rhythm Dictation
- Reveal readability: user notes and correct notes overlap at the same y — offset the reveal
  voice slightly or render user-wrong notes greyed under the red correct voice (design
  decision; pick one, document in the commit).
- Per-measure ✓/✗ result badges above each measure post-submit (the checkmark exists for
  correct — add the ✗ for wrong for symmetry).
- Keyboard: `6` (triplet eighth) arm fails when triplets are disabled — make it flash the
  palette instead of silently doing nothing.

### 12.4 Chord Progressions
- The custom-mode + random-key interaction has the most microcopy; walk every combination
  (custom on/off × randomKey on/off × inversions on/off) and fix any stale status text.
- Reveal state: `bar-meta` line wraps badly at 11+ bars on smaller screens — cap bars per
  row / allow horizontal scroll within `.bars`.

### 12.5 Melodic Dictation (newest — heaviest pass)
- Everything in 11.4.2 (cursor, flash, capacity hint) if not already landed.
- Click-to-place pitch accuracy at the extremes: wide range + bass clef puts notes on many
  ledger lines; verify y→pitch inversion beyond ±4 ledger lines and clamp to the range
  window (currently unclamped — a click far above the staff places an absurd pitch; clamp
  to `resolveRangeWindow` bounds and flash when clamped).
- Preview-on-place: play the placed note's pitch on the sampler (single short note) so the
  user hears what they wrote — matches every serious dictation tool. Settings toggle,
  default on, off during exam mode.
- ArrowUp/Down nudge should respell + re-render immediately (it does) *and* audition the new
  pitch (same preview path).
- Rest handling: rests in melodic dictation questions are rare but placement UI supports
  them — verify grading + reveal render rest-vs-note mismatches legibly.

### 12.6 Exam mode
- Setup screen: per-type validation messages ("Melodic dictation needs at least one time
  signature enabled on its topic") surfaced next to the type block, not just the generic
  bottom error. The `recognitionExamPaperEmptyMessage` legacy concept was dropped in the
  port — reintroduce per-type empty-paper messages.
- Mid-exam progress: "Question 3 of 12" is there; add a thin progress bar under it.
- Results: per-question replay button on the results screen (play the question's audio from
  the results card) — the question objects retain everything needed; wire through each
  type's `replayQuestion` with a local channel.
- Repeat test currently rebuilds a **new** paper (legacy behavior was also a rebuild via
  `begin()`); rename the button "New test (same setup)" to stop implying identical questions.

**Gate:** full regression checklist (docs/08 §3) re-run for all seven topics + exam, desktop
and one phone.

---

## Phase 13 — Performance & bundle discipline

Current: single 1.78 MB (893 KB gz) main chunk + two small lazy topic chunks. Targets:
main chunk < 500 KB gz, topic interaction < 100 ms input latency.

1. **Async exam types.** The blocker keeping VexFlow in the main bundle: `registry.examTypes`
   is a synchronous array, so both dictation exam types (→ `VexStaffHost`/`RhythmStaffHost`
   → vexflow) are eagerly imported. Change the registry field to
   `examTypes?: () => Promise<ExamTypeDefinition[]>` (or an id+loader pair), make `ExamSetup`
   `await Promise.all(...)` behind a small loading state, and keep `useExamMachine` unchanged
   (it already receives resolved `EnabledExamType[]`). This alone should split vexflow
   (~450 KB) and the dictation exam code out of the main chunk.
2. **Manual vendor chunks.** `build.rollupOptions.output.manualChunks`: `tone` (~700 KB) into
   its own chunk (it's needed at Initialize-Audio time, not first paint), `react`+`react-dom`
   +`react-router-dom` as `vendor`. First paint should then load only shell + registry code.
3. **Measure, don't guess:** add `rollup-plugin-visualizer` as a dev dependency, commit the
   npm script (`npm run build:analyze`), record before/after sizes in the commit message.
4. **Lighthouse pass** on the production build (`npm run preview`): fix anything scoring
   red — likely candidates: missing meta description (Phase 11.2 fixes), image-less LCP is
   fine, unused CSS from parked topics is negligible.
5. **Sample loading:** the Salamander samples (17 mp3s) load on Initialize Audio. Verify SWA
   serves them with long-lived cache headers (`staticwebapp.config.json` route for
   `/samples/*` with `cache-control`), confirm second-visit cache hit (regression checklist
   already names this).

**Gate:** main chunk < 500 KB gz with `npm run build` output pasted in the commit; exam
setup still opens < 300 ms on a cold load (loading state acceptable); Lighthouse
performance ≥ 90 desktop.

---

## Phase 14 — Accessibility

1. **Keyboard completeness:** every interactive flow reachable without a mouse *except*
   staff clicks (docs 07 §9 already accepts that exception). Add for both staves a
   documented keyboard placement fallback: arrow keys move an insertion cursor by grid
   step, Enter places the armed duration (melodic: Up/Down select staff line before Enter).
   This is the largest a11y item — Tier-1 cursor state in the topic hooks, rendered as a
   highlight in both notation engines.
2. **ARIA:** `aria-live` status lines (11.3), `aria-pressed` on armed palette/mod buttons,
   `role="timer"` on the exam countdown, labelled sliders in settings (several rely on
   visual proximity only — associate via `htmlFor`/`id`).
3. **Focus management:** opening exam mode moves focus to the setup heading; submitting a
   question moves focus to the next question's panel; drawer close returns focus to the
   hamburger (partially done — verify).
4. **Contrast audit:** `--muted` on white and the teal accent on `--ecu-teal-light` chips —
   run all tokens through a contrast checker at both font sizes, adjust tokens (not
   call sites) where < 4.5:1.
5. **Reduced motion:** wrap the drawer transition and playback cursor rAF updates in
   `prefers-reduced-motion` guards (cursor can update at 4 Hz instead of 60).

**Gate:** axe-core (via `vitest-axe` or manual devtools run) reports no serious/critical
violations on each topic view and all three exam phases; full keyboard walkthrough recorded
in the commit message.

---

## Phase 15 — Test hardening & CI

1. **Seedable RNG (docs 06 §C, deferred since Phase 5).** `src/lib/theory.ts`'s
   `pick`/`shuffle` and every `Math.random()` call site in generators get an injectable RNG:
   module-level `let rng = Math.random` + `setRng(fn)` test hook (lowest-churn approach —
   avoid threading a parameter through every ported signature; document the test-only
   mutation clearly). Then:
   - Generator tests become deterministic (current 1000-iteration probabilistic tests stay
     as smoke tests but key invariants also get fixed-seed exact-output cases).
   - Paper-builder shuffle becomes assertable ("stable-seedable for tests").
2. **RTL coverage for the exam machine:** currently zero component tests for exam mode.
   Add: setup renders all 7 types with persisted settings round-trip; a scripted
   recognition exam (mock the exam types with instant `playQuestion`) runs
   begin→answer→results and asserts summary math; dictation answers route to the separate
   section; replay budget decrements and disables at 0; timers driven by
   `vi.useFakeTimers()`.
3. **Topic hook tests:** `useMelodicPractice` and `useRhythmPractice` get renderHook tests
   for the placement/undo/clear/grade state machine (pure logic already tested; the hook
   glue is not).
4. **CI:** GitHub Actions workflow (`.github/workflows/ci.yml`): install → lint → tsc →
   vitest → build, on push + PR. The Azure SWA workflow already builds; CI adds the
   test/lint gate the SWA workflow lacks.
5. **Optional (time-boxed):** one Playwright smoke spec — load app, initialize audio
   mocked, answer one interval question — as scaffolding for future E2E, only if it doesn't
   fight the audio APIs; otherwise skip and note why.

**Gate:** coverage report shows every `src/lib/` module ≥ 90% lines; CI green on a PR.

---

## Phase 16 — Interval Singing (microphone topic) — NEW BUILD

**Feasibility: yes, fully client-side, no server needed.** Modern browsers expose the mic
via `navigator.mediaDevices.getUserMedia({ audio })` (HTTPS-only — Azure SWA and localhost
both qualify), and monophonic pitch detection on a voice is a solved problem at the
accuracy this exercise needs (±10 cents is achievable; we only need ±50).

### 16.1 Exercise design
A root note plays on the piano sampler; the prompt names an interval ("sing a major 3rd
above"). The user sings; the app detects the sustained pitch, converts to cents relative
to the root, and grades against the target interval. 3 attempts, first-attempt scoring,
reveal plays root+target together — identical scoring frame to the other recognition
topics, so `useScoresStore`, `TransportRow`, `StatusLine`, `SessionScoreLine` all reuse.

Settings (`…settings.interval-singing`): interval pool (reuse the interval-recognition
matrix component), direction (above/below/both), root range (comfortable male/female/auto
presets mapping to MIDI windows), tolerance (±50¢ default / ±30¢ strict / ±75¢ relaxed),
octave-equivalence toggle (accept the right pitch class in any octave — singers octave-shift
constantly; default ON), hold time required (0.5 s default).

### 16.2 Tier-1: `src/lib/pitch/` (framework-free, unit-tested)
- `detect.ts` — pitch detector. Implement **MPM (McLeod Pitch Method)** or **YIN** over
  2048-sample windows at the context sample rate: normalized autocorrelation → peak picking
  → parabolic interpolation for sub-bin accuracy → clarity/confidence value. ~120 lines,
  no dependencies (D15-style ownership; the `pitchy` npm package is an acceptable fallback
  if hand-rolled accuracy disappoints, but write ours first — it's very testable).
  Unit tests: synthesized sine/sawtooth Float32Arrays at known f0s (110–880 Hz sweep) →
  detected f0 within ±5 cents; white-noise input → confidence below threshold; silence →
  null.
- `analysis.ts` — `midiFromF0`, cents math, and a **sustained-pitch tracker**: a small state
  machine over successive detector frames (`idle → voicing → held(f0) → captured`), requiring
  N consecutive frames within ±30¢ of a running median and above the confidence + RMS
  gates before "capturing" the sung pitch. Unit tests drive it with scripted frame
  sequences (wobbly attack then stable hold; scooped entry; octave jump).
- `grading.ts` — `gradeSungInterval(rootMidi, targetSemitones, capturedMidiFloat, {toleranceCents, octaveEquivalence})`
  → `{ correct, centsOff, sungLabel }`. Trivial, but unit-tested for the octave-equivalence
  and direction edge cases.

### 16.3 Tier-2: mic plumbing + UI
- `src/lib/audio/mic.ts` — singleton mirroring `engine.ts`'s shape: `requestMic()` (behind a
  user gesture, D4 applies to input too), `status: idle|requesting|ready|denied|error`,
  an `AudioWorkletNode` (fallback: `ScriptProcessorNode` for old Safari) posting Float32
  frames to the detector on the main thread — at 20–30 fps analysis this is cheap; no need
  to run detection inside the worklet for v1. `getUserMedia` constraints:
  `{ echoCancellation: false, noiseSuppression: false, autoGainControl: false }` (voice
  processing distorts pitch). **Privacy note surfaced in the UI: audio never leaves the
  device — no recording, no upload.**
- `src/topics/interval-singing/` — `usePractice.ts` (question builder reuses the interval
  pool from `lib/recognition/intervals.ts`; round flow: play root → arm listening → tracker
  captures → grade → feedback), `Settings.tsx`, `IntervalSingingTopic.tsx` with a live pitch
  meter (a simple horizontal cents-offset bar centered on the target — render from tracker
  frames via rAF; no notation engine needed).
- Registry: flip `interval-singing` to active. **No exam type in this phase** (singing under
  exam timers is a different design problem — defer, note in doc).

### 16.4 Risks & mitigations (read before building)
- **Octave errors** are the #1 pitfall (detector halving/doubling f0 on breathy voices):
  MPM's clarity threshold + the octave-equivalence default mostly neutralize it; also bias
  peak-picking toward the lowest strong peak.
- **Room noise / laptop fan:** RMS gate before the detector; calibrate the threshold with a
  2 s ambient sample when the mic first opens.
- **The played root bleeding into the mic:** stop sampler playback before arming the
  listener (sequential, not simultaneous, in v1).
- **Browser variance:** test matrix = Chrome, Firefox, Safari (desktop) + iOS Safari and
  Android Chrome. iOS requires the `AudioContext` to be resumed from the same gesture that
  grants the mic.
- Later reuse: the same `lib/pitch` stack powers Chord Singing and Sight Singing when those
  are unparked.

**Gate:** unit tests as specified (detector accuracy, tracker state machine, grading);
manual test: a musician sings 10 intervals, ≥ 9 graded as a human judge would; mic-denied
and no-mic-device paths show friendly guidance; all existing tests still green.

---

## Suggested order & sizing

| Phase | Size | Depends on |
|---|---|---|
| 10 de-clutter | done | — |
| 11 cross-cutting polish | M | — |
| 12 per-topic deep pass | L | 11 (shared palette, error boundary) |
| 13 performance/bundle | M | none (but easier after 12's exam touches) |
| 14 accessibility | M | 11.3 |
| 15 tests & CI | M | 13 (async examTypes changes test setup) |
| 16 interval singing | L | none technically; do last so polish phases protect the v1 surface first |

Tag `v1.1.0` after Phase 12, `v1.2.0` after Phase 15, `v2.0.0` after Phase 16 (first
microphone feature).
