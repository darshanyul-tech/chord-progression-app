# 01 — Architecture

Binding structural design for the React application. Foundational decisions (React 19, Zustand, React Router hash, Tone.js pin, VexFlow 5, two-tier porting) are recorded in `00-overview-and-decisions.md §3` and not re-argued here.

---

## 1. Repository layout

```
/
├── index.html                      # Vite entry (root div only)
├── package.json / tsconfig.json / vite.config.ts
├── public/
│   ├── staticwebapp.config.json    # Azure SWA config (07-deployment doc)
│   └── samples/piano/              # 17 self-hosted Salamander mp3s + LICENSE.txt
├── legacy/                         # canonical porting sources (never shipped)
├── docs/                           # these design docs
└── src/
    ├── main.tsx                    # createRoot → <App/>
    ├── App.tsx                     # RouterProvider + shell layout
    ├── styles/
    │   ├── tokens.css              # :root custom properties (ported verbatim)
    │   ├── base.css                # card, field, buttons, toggles, inputs (ported)
    │   ├── shell.css               # header band, sidebar/drawer (new)
    │   └── topics/*.css            # per-topic styles ported from legacy <style>
    ├── lib/                        # ★ TIER 1 — framework-free ported logic. NO React imports allowed.
    │   ├── theory.ts               # NOTE_NAMES, midiToNoteName, mod, pick, shuffle …
    │   ├── audio/
    │   │   ├── engine.ts           # Tone.js init, sampler singleton (03-audio doc)
    │   │   ├── playback.ts         # PlaybackChannel pattern, scheduleSamplerTrigger, delaySec
    │   │   └── percussion.ts       # metronome/snare synthesis (ported)
    │   ├── rhythm/
    │   │   ├── time.ts             # parseTimeSig, durationTicks, metricPulse*, snap/grid math
    │   │   ├── generator.ts        # fillMeasure, partitionBar, placeSyncopated … (ported)
    │   │   └── grading.ts          # sortNotes, measuresEqual (ported)
    │   ├── rhythm-staff/           # ported SVG staff engine (imperative island, Part A)
    │   │   ├── render.ts           # renderStaff, drawMeasureNotes, glyph drawing
    │   │   └── glyphs.ts
    │   ├── progression/            # SCALES, FLOW, RECIPES, generateProgression, buildVoicing,
    │   │   └── …                   # gradeGuesses, custom-mode model … (ported, split by seam)
    │   ├── recognition/            # per-topic question builders & content tables (ported):
    │   │   ├── intervals.ts        # INTERVAL_TYPES, pickIntervalQuestion …
    │   │   ├── chords.ts           # CHORD_RECOGNITION_* tables, voicing builder …
    │   │   └── scales.ts           # SCALE_RECOGNITION_* tables …
    │   ├── melody/
    │   │   ├── generator.ts        # NEW: constrained-walk melody generator (topic doc 07 §3)
    │   │   ├── spelling.ts         # NEW: deterministic pitch spelling per key (04 doc B3)
    │   │   └── grading.ts          # NEW: pitchedMeasuresEqual
    │   └── meter/generator.ts      # NEW: meter-recognition question builder (topic doc 04 §3)
    ├── state/                      # Zustand stores
    │   ├── settings/<topicId>.ts   # persisted slice per topic + exam
    │   ├── scores.ts               # non-persisted session scores (all topics)
    │   └── ui.ts                   # active topic, drawer open, exam-active lock
    ├── shell/
    │   ├── HeaderBar.tsx           # black band, title, hamburger, Exam button
    │   ├── SyllabusMenu.tsx        # sidebar/drawer from registry
    │   ├── TopicHost.tsx           # keeps all topic views mounted, toggles visibility (D9a)
    │   └── PlaceholderView.tsx
    ├── components/                 # shared Tier-2 building blocks
    │   ├── Card.tsx, Field.tsx, ToggleSwitch.tsx, RangeField.tsx
    │   ├── TransportRow.tsx        # Init/Play/Replay/Stop/Next in canonical order
    │   ├── ChoiceGrid.tsx          # recognition answer buttons + reveal states
    │   ├── SessionScoreLine.tsx
    │   └── StatusLine.tsx          # status text with ""/warn/error kinds
    ├── topics/
    │   ├── registry.ts             # TopicDefinition list (02 doc §3 inventory)
    │   ├── interval/IntervalTopic.tsx (+ Settings.tsx, usePractice.ts …)
    │   ├── chord/ … scale/ … progression/ …
    │   ├── rhythm-dictation/       # RhythmDictationTopic.tsx + RhythmStaffHost.tsx (island host)
    │   ├── meter/                  # NEW
    │   └── melodic-dictation/      # NEW: MelodicTopic.tsx + VexStaffHost.tsx + input overlay
    └── exam/
        ├── ExamOverlay.tsx, ExamSetup.tsx, ExamResults.tsx
        ├── exam-machine.ts         # Tier 1: ported paper builder, timers, grading
        └── types.ts                # ExamTypeDefinition interfaces (06 doc)
```

**The Tier-1 firewall is the load-bearing rule:** nothing under `src/lib/` may import React, Zustand, or anything from `src/` outside `lib/`. Enforce with an ESLint `no-restricted-imports` rule (or a comment-documented convention if lint config is deferred). This is what makes the verbatim port verifiable and unit-testable.

## 2. App composition & boot

```
<App>
 ├─ RouterProvider (createHashRouter)
 │   ├─ route "/"            → redirect to /topic/chord-progressions
 │   ├─ route "/topic/:id"   → <Layout><TopicHost activeId={id}/></Layout>
 │   └─ route "/exam"        → <Layout><TopicHost hidden/><ExamOverlay/></Layout>
 └─ Layout = <HeaderBar/> + <SyllabusMenu/> + <main> + <footer>
```

- Zustand `persist` rehydrates settings synchronously from localStorage before first paint (default behavior); no loading state needed.
- Audio engine is NOT initialized at boot — first user gesture only (D4).

## 3. Topic registry (`topics/registry.ts`)

```ts
export type CategoryId =
  | "intervals-scales" | "chords" | "rhythm" | "harmony-form"
  | "pitch-melody" | "repertoire" | "musical-elements" | "custom";

export interface TopicDefinition {
  id: string;                         // "interval-recognition" — used in routes
  title: string;
  category: CategoryId;
  status: "active" | "placeholder";
  theme?: "light" | "dark";           // default light; rhythm-dictation = dark
  Component?: React.ComponentType;    // present iff active; lazy() allowed but not required
  examTypes?: ExamTypeDefinition[];   // contributed exam question types (06 doc)
}
export const TOPICS: TopicDefinition[] = [ /* exact inventory: 02 doc §3 */ ];
```

The registry is a plain array — menu, routes, TopicHost, and exam setup all derive from it. Adding a future topic = add a folder + one array entry.

## 4. TopicHost & the mounted-views rule (D9a)

```tsx
function TopicHost({ activeId }: { activeId: string }) {
  return TOPICS.filter(t => t.status === "active").map(t => (
    <div key={t.id} className="topic-view" style={{ display: t.id === activeId ? "" : "none" }}>
      <t.Component />
    </div>
  ));
  // placeholder ids render <PlaceholderView topic={t}/> instead (always unmount-safe)
}
```

- Every active topic mounts once on first `TopicHost` render and never unmounts. In-progress questions, transient UI, and refs survive switches — legacy semantics for free.
- **Deactivation contract:** each topic subscribes to `useIsActiveTopic(id)`; on `true → false` it must stop playback (increment its `PlaybackChannel` generation, clear timers, `releaseAll`) — implemented once as a `useStopOnDeactivate(channel)` hook shared by all topics. It must NOT reset settings or scores.
- The router applies `body.theme-dark` when the active topic's `theme === "dark"` (effect in `TopicHost`).
- While `ui.examActive`, `SyllabusMenu` entries are disabled (legacy: tabs disabled during exam).

## 5. State model

| State | Where | Lifetime |
|---|---|---|
| Settings (all Settings-card controls) | Zustand slice per topic, `persist` → `eartrainer.v1.settings.<topicId>` | Persistent |
| Session scores (incl. progression's granular tallies) | `state/scores.ts` (no persist) | Until reload |
| In-progress question / attempts / reveal state | Component state (survives via D9a) | Per question |
| Exam paper/answers/config | `exam-machine.ts` instance + ExamOverlay state; exam *setup* settings persisted like a topic | Per run |
| UI (drawer, active topic, exam lock) | `state/ui.ts` | Ephemeral |

Settings slices define defaults matching the legacy defaults **exactly** (each topic doc's Settings table is the contract). `persist` uses a `merge` that keeps defaults for missing keys and drops unknown keys; JSON parse failure → fall back to defaults (wrap storage access; private-mode safe).

## 6. Tier-1 ↔ Tier-2 interaction patterns (canonical, use everywhere)

1. **Question lifecycle:** component calls `lib` builder (`pickIntervalQuestion(settings)`) → stores the returned question object in component state → passes it to `lib` playback functions on Play. Logic never reaches into React.
2. **Playback channel per topic:** `const channel = useRef(createPlaybackChannel()).current;` — stop/replay/deactivate all operate on the channel (03-audio doc §3).
3. **Imperative islands** (rhythm staff, VexFlow staff): a host component owns a `<div ref>`/`<svg ref>`; `useEffect` calls the island's render function whenever the React-side model changes; the island reports user input via callbacks that set component state. The island never mutates React state directly; React never touches the island's internals (04-notation doc).
4. **Audio readiness:** `useAudioReady()` hook subscribes to the engine singleton's tiny listener set; components render Init vs Play buttons from it (03-audio doc §5).

## 7. Error-handling conventions (ported, made explicit)

- Playback cancellation: generation-counter pattern everywhere, ported verbatim (03-audio §3). No AbortController, no Tone.Transport.
- Status lines: `StatusLine` component with `kind: "" | "warn" | "error"` mapping to the legacy CSS classes; message strings copied from legacy where the flow exists there.
- Any storage/audio failure degrades gracefully: settings fall back to defaults, audio shows the legacy-style init error status. Nothing throws to a blank screen; add a top-level ErrorBoundary rendering a plain reload prompt card.

## 8. TypeScript & lint baseline

`strict: true`, `noUncheckedIndexedAccess` off (ported table-lookup code relies on indexing), `jsx: react-jsx`, target ES2020. ESLint: `eslint` + `typescript-eslint` + `react-hooks` recommended + the Tier-1 firewall rule (§1). Prettier defaults.
