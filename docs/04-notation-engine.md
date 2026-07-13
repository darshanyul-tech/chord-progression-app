# 04 — Notation Engines

Two engines by decision D5: the ported custom SVG staff for Rhythm Dictation (Part A) and VexFlow 5 for Melodic Dictation's pitched staff (Part B). Both are hosted in React as **imperative islands** (`01-architecture.md §6.3`). Accepted trade-off: the two staves differ in engraving style; they share colors, stroke weights, and card framing.

---

## Part A — Rhythm staff (verbatim port, do not change behavior)

Port these functions from the canonical legacy file (lines ~5795–6310) into `lib/rhythm-staff/` + `lib/rhythm/time.ts`, keeping names:

- Geometry/time: `measureWidth`, `measureTotalBeats`, `parseTimeSig`, `durationTicks`, `gridStep`, `snapBeat`, `noteOverlaps`, `beatFromClickX`, `noteX`
- Rendering: `svgEl`, `renderStaff`, `drawMeasureNotes`, `drawNoteGlyph`, `drawRestGlyph`, `drawNotehead`, `drawRest`, `addFilledFlag`, `injectPaletteGlyphs`

Preserved characteristics:
- Single `<svg viewBox="0 0 1000 200" preserveAspectRatio="xMidYMid meet">`, responsive by CSS width.
- Beat-snapped click placement against an armed palette duration; dotted + triplet variants; rests as first-class placements.
- Reveal renders the correct pattern in a contrasting color exactly as legacy `checkAnswer`/`renderStaff` produce it.
- Tick math: durations compared in integer ticks (`durationTicks`, `gcdInt`); grading is tick-exact via `sortNotes`/`measuresEqual`.

### React hosting (`topics/rhythm-dictation/RhythmStaffHost.tsx`)

```tsx
// Owns the <svg ref>. useEffect re-runs renderStaff(svg, model) when the model changes.
// Click handler: beatFromClickX → props.onPlace(measure, beat) → component state → re-render.
// Palette arming, keyboard shortcuts (1–8, R, D, Backspace, Esc) live in the topic component
// and flow in as props; the island stays stateless between renders.
```

The engine renders from an explicit model (`{ timeSig, measures, userNotes, revealNotes?, activeMeasure }`) — during the port, refactor its reads of legacy module-level state into function parameters. That parameterization is the **only** allowed Tier-1 change beyond types/imports, and it must not alter output (verify by rendering identical models before/after against the legacy app).

---

## Part B — Pitched staff via VexFlow 5 (`melodic-dictation` only)

### B1. Library & role

- `vexflow@5.0.0`, exact pin. Renderer backend: **SVG**.
- VexFlow is **display-only**. Our own note model is the source of truth; grading, storage, and playback never read VexFlow objects. VexFlow renders a fresh scene from the model on every change (no incremental mutation of VexFlow objects).

### B2. Note model (ours, framework-free — `lib/melody/`)

```ts
export interface PitchedNote {
  beat: number;          // onset within measure, same beat units as rhythm engine
  duration: number;      // same duration vocabulary (4, 2, 1, 0.5, 0.25, dotted values)
  rest: boolean;
  midi: number | null;   // null for rests
}
export type Clef = "treble" | "bass";
```

### B3. Pitch spelling rule (deterministic — `lib/melody/spelling.ts`)

VexFlow needs letter+accidental spellings (`"c#/4"`); the model stores MIDI. Spelling is computed, never stored:
1. Diatonic to the exercise key → spell as the diatonic degree (accidental shown only when the key signature doesn't already imply it — VexFlow's `Accidental.applyAccidentals` handles measure-scope carry; feed it the key signature).
2. Chromatic → spell as an alteration of a diatonic degree; prefer the spelling requiring a single accidental; ties broken toward ♯ in sharp keys, ♭ in flat keys and C. Implemented as a per-key pc→spelling lookup table, generated once and unit-tested (no ad-hoc logic at call sites).

### B4. Rendering (`topics/melodic-dictation/VexStaffHost.tsx` + a pure builder in `lib/melody/vexscore.ts`)

`buildVexScore(model) → render(container)` using the VexFlow Factory/low-level API:
- One `Stave` per measure, laid out horizontally with wrap to a second row when > 2 measures (VexFlow `Formatter` per measure; fixed stave width = container/measures-per-row).
- Clef + key signature on the first stave of each row; time signature on the very first.
- User notes as `StaveNote`s (with `Accidental` modifiers per B3, `Dot` modifiers, rests as `StaveNote` rest variants). Eighths/sixteenths beamed with `Beam.generateBeams` (VexFlow does this well — a deliberate engraving upgrade over Part A).
- **Reveal state:** render a second `Voice` containing the correct melody with a contrasting style (`setStyle({ fillStyle, strokeStyle })` = the theme's danger/teal contrast pair), matching Part A's reveal convention.
- Ledger lines, stem directions: VexFlow automatic.

### B5. Input layer (ours, on top of the SVG)

VexFlow gives no note input; we reuse Part A's interaction concept:
- A transparent absolutely-positioned overlay `<div>` on the staff container captures clicks.
- **x → beat:** reuse `beatFromClickX`-style snapping against each measure's known x-range (stave x/width are known because we set them; grid step from `lib/rhythm/time.ts`).
- **y → pitch:** `stave.getYForLine()` gives line geometry; invert to the nearest diatonic staff step (line/space), clamp to the exercise range; armed accidental modifier (♯/♭/off, mutually exclusive toggles in the palette) adjusts the diatonic pitch ±1 semitone at placement; `ArrowUp/ArrowDown` nudges the last-placed note ±1 semitone (respelled via B3).
- Placement writes to the React-side model → VexFlow re-renders. Same palette/duration/rest/dot/backspace/clear behavior and keyboard map as rhythm dictation, plus `S`=♯, `F`=♭.
- Overlay hit-testing needs only stave rectangles + beat grid — **no VexFlow internals beyond stave geometry accessors**, keeping the coupling shallow.

### B6. Grading (`lib/melody/grading.ts`)

`pitchedMeasuresEqual(a, b)`: normalize both sequences (sort by beat), equal iff identical onsets (tick-exact), durations, rest flags, and **MIDI numbers** — enharmonic spellings automatically accepted. Reuses Part A tick math. Never compares spellings or VexFlow output.

### B7. Unit tests (Vitest, required)

- Spelling tables: all 12 pcs in every supported key, both preference directions (B3).
- midi↔staff-step inversion round-trips for both clefs across the full supported range.
- `pitchedMeasuresEqual`: positive / negative / enharmonic / duration-only-difference cases.
- `buildVexScore` smoke: builds without throwing for generated melodies across all settings combinations (property-style loop over 200 random exercises).
