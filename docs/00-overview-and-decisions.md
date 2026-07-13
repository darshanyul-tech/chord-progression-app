# 00 — Project Overview & Decision Log

**Project:** Ear Trainer web application (expansion + reorganization of an existing single-file app)
**Deployment target:** Azure Static Web Apps (Free tier)
**Functional spec:** [`docs/spec/ear-trainer-feature-spec.md`](spec/ear-trainer-feature-spec.md) — the authoritative statement of *what* the app must do.
**This document:** records every binding technical decision and its rationale. Implementation must follow these decisions; none are open questions.

> **Revision note (2026-07-13):** D2 (UI framework) and D5 (pitched-staff notation) were revisited with the project owner and changed: the app is now **React + TypeScript**, and Melodic Dictation's staff uses **VexFlow 5**. The two-tier porting protocol (D15) exists because of this change. All other decisions stand.

---

## 1. Source-of-truth artifacts

| Artifact | Role |
|---|---|
| `legacy/jazz-progression-trainer-rhythm.html` (6,439 lines) | **Canonical source.** Contains ALL existing functionality: Chord Progressions, Interval Recognition, Chord Recognition, Scales, Rhythm Dictation, Exam Mode, and the correct visual identity (light ECU teal/white/black theme). Verified to be a strict functional superset of the other file (all 177 top-level functions of the other file exist here, plus 86 rhythm-specific ones). **All porting is done from this file.** |
| `legacy/jazz-progression-trainer.html` (4,666 lines) | Secondary reference only (dark-theme variant, no rhythm tab). Do not port from it. Its theme is NOT the one to preserve. |
| `docs/spec/ear-trainer-feature-spec.md` | Functional requirements. |

**Behavioral rule for the implementer:** where these design docs and the legacy file disagree about how an *existing* feature behaves, the legacy file wins ("no loss of existing functionality" is a hard requirement). Where the legacy file has no answer (new topics, navigation, deployment), these docs win.

---

## 2. What exists today (analysis summary of the legacy app)

- **Five practice modes** behind a flat tab row: `progression`, `interval`, `chord`, `scale`, `rhythm` — each a hidden/shown `<div>` view (`one view visible at a time`), plus an **Exam Mode** overlay covering the four recognition-style modes.
- **Theme:** light, `color-scheme: light`, CSS custom properties: teal `#005f6b` (`--accent`), teal-dark `#004a54`, black text/header accents, white panels, `#d8d8d8` borders, 14px-radius cards, Inter/Segoe font stack. Rhythm mode flips the body to a black background (`body.rhythm-active`).
- **Audio:** Tone.js `14.8.49` loaded from CDN (3 fallback CDNs), `Tone.Sampler` with the 17-file Salamander piano sample set (A1–A5) at `-6 dB`, `release: 1.6`. Rhythm mode synthesizes percussion (metronome clicks, snare-style hits) via the WebAudio context directly. Playback cancellation uses a `playbackGen` generation counter + timer lists per mode.
- **Notation:** Rhythm Dictation renders a single-line rhythmic staff as **hand-built SVG** (`renderStaff`, `drawNoteGlyph`, `drawRestGlyph`, `svgEl`, viewBox `1000×200`), with palette-armed click-to-place entry, snapping (`snapBeat`, `gridStep`), keyboard shortcuts (1–8 durations, R rest, D dot, Backspace, Esc), capacity hints, and a contrasting-color reveal of the correct pattern.
- **Scoring:** every mode keeps `session: { correct, total }` in memory; recognition modes count only the **first guess** while allowing up to 3 attempts (`RECOGNITION_MAX_GUESSES = 3`); rhythm dictation grades the whole exercise as one unit. Auto-advance after reveal is optional per mode (`RECOGNITION_AUTO_ADVANCE_MS`).
- **Exam mode:** question types `progressionRecognition`, `intervalRecognition`, `chordRecognition`, `scaleRecognition`; per-type config schema `{count 1–30, reps 1–5, spacingSec 0–15}`; 30-second answer limit (`EXAM_ANSWER_LIMIT_SEC`); results/review screen comparing answer vs. correct per question.
- **No persistence:** no `localStorage` usage anywhere; all state is in-memory.
- **Content inventories** (exact lists in the per-topic docs): 14 interval types (m2–M9), 21 scale types in 5 groups, 32 chord types in 5 groups, 8 time signatures, full jazz-harmony progression generator (secondary dominants, tritone subs, borrowed iv, chromatic approach, rootless voicings, inversions, voice-leading).

---

## 3. Decision log (binding)

### D1 — Language: TypeScript (strict mode)
All new and ported code is TypeScript with `"strict": true`. Ported legacy logic may use pragmatic typing — the priority is behavioral fidelity, not type elegance. No `any` except in clearly-marked port shims.

### D2 — UI framework: **React 19 + TypeScript** *(revised by owner decision)*
React `^19.2` with function components and hooks throughout. Vite `react-ts` template as the base.

Consequence, made explicit: the legacy app's ~180 imperative UI-wiring functions are **re-implemented** as React components with behavior parity, while all framework-free logic (theory, generators, graders, audio scheduling, percussion synthesis, the rhythm SVG staff engine) is **ported verbatim** as plain TS modules that components call. This two-tier split is defined precisely in D15 — it is what keeps the no-regression requirement enforceable under a framework change. Class components, Redux, and CSS-in-JS are out of scope; styling remains the ported plain CSS (D8).

### D3 — Build tool: Vite (latest 6.x), output = static `dist/`
No SSR, no backend, no Azure Functions API. Single-page static output.

### D4 — Audio: Tone.js `^14.8.49` as an npm dependency; Salamander samples **self-hosted**
- Tone.js moves from CDN `<script>` to a bundled npm import (pin `14.8.49` — the exact version in production today; do not upgrade to 15.x during the port).
- The 17 Salamander mp3 files are downloaded once and committed to `public/samples/piano/` (~2–3 MB total), served by SWA with immutable cache headers. Removes the runtime dependency on `tonejs.github.io` and the triple-CDN fallback hack.
- The percussion/metronome synthesis code is ported as-is.
- The audio engine lives **outside React** as a module singleton; components interact with it through a thin hook layer (`03-audio-engine.md §5`). Audio scheduling never runs through React state.

### D5 — Notation: rhythm staff stays custom SVG; pitched staff uses **VexFlow 5** *(revised by owner decision)*
- **Rhythm Dictation** keeps its ported, battle-tested custom SVG staff engine unchanged (an "imperative island" inside a React host component — `04-notation-engine.md` Part A). Rebuilding it on VexFlow is explicitly rejected: it is the most delicate existing feature and gains nothing from re-rendering.
- **Melodic Dictation** renders its 5-line pitched staff with `vexflow@5.0.0` (exact pin): professional engraving for clefs, key signatures, accidentals, ledger lines, and beaming. VexFlow is **display-only**; the click-to-place input layer, beat/pitch snapping, tick-based data model, and grading remain ours (`04-notation-engine.md` Part B).
- Accepted trade-off (owner-approved): the rhythm staff and pitched staff will not look pixel-identical in engraving style. Mitigate with shared colors, stroke weights, and layout framing.

### D6 — State: Zustand 5 for settings & scores; component state for questions
- **Settings** (every control in a topic's Settings card): one Zustand store slice per topic, wrapped in `persist` middleware → localStorage key `eartrainer.v1.settings.<topicId>`. Tolerant restore: `merge` keeps defaults for missing/unknown keys; a corrupt blob is discarded silently.
- **Session scores** (and progression's granular tallies): Zustand slices **without** persist — they survive topic switches, die on reload (a session score is a session score).
- **In-progress question state** stays in component state; it survives topic switches because topic views stay mounted (D9a).
- Version bump policy: incompatible schema change later → bump prefix to `v2`, drop old data, no migrations.

### D7 — Routing: React Router v7, hash strategy (`createHashRouter`)
Routes: `#/topic/<topic-id>`, `#/exam`, fallback redirect to the default topic. Hash strategy chosen over BrowserRouter because it needs zero server coordination and the app has no SEO requirements; SWA `navigationFallback` is still configured (harmless, future-proof).

### D8 — Styling: plain CSS with custom properties, ported design tokens
One global stylesheet set built from the legacy file's `:root` tokens (ECU teal/white/black — full table in `02-ui-shell-and-navigation.md §5`). Legacy CSS class names are **kept verbatim** and components must emit markup carrying those classes, so the ported stylesheets apply unchanged. No Tailwind, no CSS-in-JS, no CSS modules. The `body.rhythm-active` dark treatment generalizes to a per-topic `theme` flag.

### D9 — Navigation: syllabus sidebar replaces the tab row
Persistent left sidebar (≥1024px) / slide-in drawer (<1024px) listing all 8 categories and every topic — implemented and placeholder alike. Placeholder topics open a standard-shell "coming soon" view. Full layout and topic inventory in `02-ui-shell-and-navigation.md`.

### D9a — Topic views stay mounted (hidden with CSS), matching legacy semantics
All implemented topic components render once and stay in the tree; the router toggles visibility (`display: none` on inactive views). This preserves the legacy guarantee that switching topics never destroys an in-progress question, settings UI state, or score — with zero state-lifting machinery. Deactivation triggers playback stop via an effect (`01-architecture.md §4`). This is deliberately non-idiomatic React and is the correct call here; do not "fix" it by unmounting.

### D10 — Testing: Vitest + React Testing Library (targeted) + manual regression checklist
- Vitest unit tests are **required** for all Tier-1 ported logic (theory tables, generators, graders, tick math) and the new generators (meter, melody).
- React Testing Library only for high-value component behavior: first-guess scoring flow, settings→store→persistence round-trip, exam type toggling. No snapshot tests, no E2E framework.
- The manual regression checklist in `08-implementation-plan.md §3` remains the primary parity gate against the legacy file.

### D11 — Hosting: Azure Static Web Apps, Free plan, GitHub Actions CI/CD
GitHub repo → SWA workflow → Node 20 build → deploy `dist/`. `staticwebapp.config.json` with `navigationFallback`, immutable caching for `/samples/`, security headers. Runbook in `07-deployment-azure-swa.md`. Custom domain deferred (default `*.azurestaticapps.net` URL satisfies the web-address requirement).

### D12 — New topic: Meter Recognition reuses the rhythm engine
Question generation calls the ported rhythm-dictation pattern generator per candidate time signature; playback reuses its percussive/instrumental/melodic sound paths and beat-emphasis machinery. Spec in `05-topics/04-meter-recognition.md`.

### D13 — New topic: Melodic Dictation = VexFlow display + custom input layer + rhythm-generator reuse + a new pitch-contour generator
Pitch assignment is a constrained random walk over scale degrees (spec'd exactly in `05-topics/07-melodic-dictation.md` — no discretion needed). Grading = pitch (enharmonic-equivalent MIDI match) + rhythm (same tick comparison as rhythm dictation). Grading never reads VexFlow objects — it compares our own note model.

### D14 — Exam expansion
Meter Recognition joins as a fifth recognition type (identical machinery). Rhythm/Melodic Dictation join as **dictation question types** graded matched/not-matched and reported in a separate results section, never blended into first-guess accuracy stats. Replay limits become a per-type exam setting. Spec in `06-exam-mode.md`.

### D15 — Two-tier porting protocol *(replaces the old verbatim-only protocol)*
**Tier 1 — verbatim logic port.** Everything framework-free moves function-by-function into plain TS modules with minimal diffs: keep function names, timing constants, magic numbers, algorithms. Covers: `theory`, all generators (progression, rhythm/`fillMeasure` pipeline), all graders (`gradeGuesses`, `measuresEqual`, …), voicing/`buildVoicing`, audio scheduling patterns, percussion synthesis, and the rhythm SVG staff engine. **No renaming, no improvements, no dedup.** Unit tests pin behavior.

**Tier 2 — parity re-implementation of UI.** Components re-express the legacy views in JSX: same visible structure, same legacy CSS class names, same control ranges/defaults/visibility rules, same transport button order, same status/feedback text. DOM ids become refs/props (ids kept only where the ported rhythm engine needs them). Each topic doc's Settings table + acceptance criteria are the parity contract; the legacy file is the arbiter for anything they don't cover.

The four near-identical recognition topics MAY share React components (choice grid, transport row, score line) — sharing *components* is Tier 2 and allowed; sharing/merging their Tier-1 *logic* modules is still forbidden during the port.

---

## 4. Document map

| Doc | Contents |
|---|---|
| `00-overview-and-decisions.md` | This file. |
| `01-architecture.md` | Repo layout, component/module structure, topic registry, stores, routing. |
| `02-ui-shell-and-navigation.md` | Shell, syllabus menu, full category/topic inventory, design tokens, responsive rules. |
| `03-audio-engine.md` | Tone.js setup, sample self-hosting, scheduling/cancellation, React integration. |
| `04-notation-engine.md` | Rhythm SVG staff port (Part A) + VexFlow pitched staff (Part B). |
| `05-topics/01…07` | Per-topic functional implementation plans (settings schema, generation, grading, UI). |
| `06-exam-mode.md` | Exam port + expansion design. |
| `07-deployment-azure-swa.md` | Azure SWA + GitHub Actions runbook, `staticwebapp.config.json`. |
| `08-implementation-plan.md` | Phased build order, acceptance criteria, porting protocol, regression checklist. |

## 5. Dependencies (complete runtime list — do not add others without a documented decision)

| Package | Version | Purpose |
|---|---|---|
| `react`, `react-dom` | `^19.2` | UI |
| `react-router-dom` | `^7` | hash routing |
| `zustand` | `^5` | settings (persisted) + score stores |
| `tone` | `14.8.49` (exact pin) | sampler, audio context |
| `vexflow` | `5.0.0` (exact pin) | pitched-staff engraving (Melodic Dictation only) |

Dev: `vite` (react-ts template), `typescript` 5.x, `vitest`, `@testing-library/react`.
