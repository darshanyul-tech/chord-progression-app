# 08 — Implementation Plan (for the implementing agent)

Phased build order with acceptance gates. Work strictly in phase order — each phase leaves the app deployable and demonstrably non-regressed. Do not start a phase before the previous phase's gate passes.

---

## 1. Ground rules

1. **The legacy file is law** for existing features (`legacy/jazz-progression-trainer-rhythm.html`). When in doubt about behavior, open it and copy what it does. Never "improve" ported behavior.
2. **Two-tier porting protocol (D15):**
   - **Tier 1 (verbatim):** all framework-free logic — theory tables, generators, graders, voicing, audio scheduling, percussion, rhythm staff engine — moves function-by-function into `src/lib/` with minimal diffs (types, imports, and the documented model-parameterization of the rhythm staff only). Keep names, constants, magic numbers. No dedup, no refactors. `src/lib/` never imports React/Zustand.
   - **Tier 2 (parity re-implementation):** views become React components that reproduce the legacy views' visible structure, **legacy CSS class names**, control ranges/defaults/visibility rules, transport order, and feedback text. The topic docs' Settings tables + acceptance criteria are the parity contract; the legacy file arbitrates anything they don't cover. Shared UI components (`TransportRow`, `ChoiceGrid`, …) are encouraged; shared Tier-1 logic between the four recognition topics is forbidden.
3. **Every phase ends with:** unit tests green, the phase's gate checklist done, deploy to SWA (from Phase 0 onward the site is always live).
4. Legacy line numbers in these docs are anchors, not ranges to transcribe blindly — take whole functions.
5. State discipline: settings in persisted Zustand slices, scores in the non-persisted score store, question state in component state, topics stay mounted (D9a). Do not deviate per topic.

## 2. Phases

### Phase 0 — Scaffold & pipeline (small)
- Vite `react-ts` scaffold; strict tsconfig; ESLint (+ Tier-1 firewall rule) ; Vitest + RTL wired.
- Install pinned deps (00 doc §5). Download the 17 Salamander samples into `public/samples/piano/` + LICENSE.txt (03-audio §2).
- `staticwebapp.config.json` in `public/`.
- GitHub repo, SWA resource, workflow per `07-deployment` — deploy a placeholder page.
- **Gate:** production URL serves the app shell placeholder; CI runs tests and blocks on failure; `/samples/piano/A4.mp3` reachable.

### Phase 1 — Shell, tokens, registry, router, stores (medium)
- Port design tokens + base CSS; build `HeaderBar`, `SyllabusMenu` (sidebar + drawer), footer, `PlaceholderView`, `TopicHost` with the mounted-views rule (`02-ui-shell`, `01-architecture §§3–4`).
- `createHashRouter` routes; Zustand store scaffolding incl. persist wiring and tolerant merge; theme flag machinery.
- **Gate:** full syllabus menu navigable at desktop + mobile widths; active highlight; deep links (`#/topic/…`) work; placeholder view renders; a faked dark topic flips the body theme; settings slice round-trips a reload.

### Phase 2 — Audio core + first ported topic (Interval Recognition)
- Tier 1: `lib/theory.ts`, `lib/audio/*` (engine singleton, PlaybackChannel, self-hosted sampler), `lib/recognition/intervals.ts`.
- Tier 2: `IntervalTopic` + the shared components it needs (`TransportRow`, `ChoiceGrid`, `StatusLine`, `SessionScoreLine`, settings fields), `useStopOnDeactivate`, `useAudioReady`.
- This phase sets the canonical patterns every later topic copies — get it reviewed against topic doc 01 thoroughly.
- **Gate:** topic doc 01 acceptance criteria on the live site, desktop + phone; RTL test for first-guess scoring flow.

### Phase 3 — Remaining recognition topics + progressions
- Chord Recognition (add sus2), Scales, then Chord Progressions (topic docs 03, 02, 06 — progressions last; its per-bar guess rows and custom mode are the biggest Tier-2 build).
- **Gate:** each topic doc's acceptance criteria; settings persist across reload for all four; switching topics never resets scores or in-progress questions.

### Phase 4 — Rhythm Dictation port
- Tier 1: `lib/rhythm/*`, `lib/rhythm-staff/*` (with the model parameterization), `lib/audio/percussion.ts`.
- Tier 2: `RhythmDictationTopic` + `RhythmStaffHost` island, palette, keyboard map, dark theme flag.
- **Gate:** topic doc 05 acceptance criteria including side-by-side parity checks with the legacy file open in another tab.

### Phase 5 — Exam mode port
- Tier 1: `exam-machine.ts` (paper builder, timers, grading). Tier 2: `ExamOverlay/Setup/Results` reproducing legacy flow behind the exam-type adapter interface; the four legacy types only (`06-exam` §A, §B1).
- **Gate:** exam doc §D legacy-parity criteria.

### Phase 6 — New topic: Meter Recognition
- Per topic doc 04, reusing `lib/rhythm` + percussion; register its exam type.
- **Gate:** topic doc 04 acceptance criteria + unit tests.

### Phase 7 — New topic: Melodic Dictation
- `lib/melody/*` (spelling tables, walk generator, grading, `buildVexScore`) with unit tests → `VexStaffHost` + input overlay → topic build per topic doc 07.
- **Gate:** topic doc 07 acceptance criteria.

### Phase 8 — Exam expansion
- Dictation exam types + replay-limit settings + dictation results section (`06-exam` §§B2–B5).
- **Gate:** exam doc §D full-mix criteria.

### Phase 9 — Hardening & release
- Full regression checklist (§3) on production, desktop + phone; Lighthouse pass (fix anything obviously broken); bundle check (VexFlow must be in the melodic-dictation lazy chunk if bundle > ~500 KB gz — use `React.lazy` for the topic in that case).
- Tag `v1.0.0`.

## 3. Full regression checklist (run at Phases 5 and 9)

For **each** implemented topic: initialize audio → play → replay → stop mid-playback → answer wrong then right (verify first-guess scoring / whole-exercise grading as applicable) → auto-advance on and off (where present) → reset score → switch away and back (in-progress question intact) → reload (settings intact, score reset).

Cross-cutting: exam from every topic's context; exam exit restores topic; drawer navigation on a phone; dark theme only on rhythm dictation; no console errors during a full pass; second-visit sample cache hit.

## 4. Estimated shape (for planning, not a commitment)

Phases 0–1 small-medium; 2 medium (pattern-setting); 3 the long middle (progressions dominates); 4 delicate; 5 mechanical-plus-UI; 6 small; 7 the largest new-code phase; 8–9 small. If anything must be cut to ship, cut Phase 8 last-in items (recognition replay limits) — never cut regression gates.

## 5. Out of scope for v1 (do not build)

Custom topic authoring, Nashville-number answer mode, user accounts, any backend, PWA/offline support, additional placeholder topics' functionality, Tone.js 15 upgrade, VexFlow for the rhythm staff, recognition-logic dedup refactor, SSR.
