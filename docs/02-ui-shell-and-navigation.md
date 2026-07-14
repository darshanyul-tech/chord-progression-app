# 02 — UI Shell & Syllabus Navigation

Binding design for the persistent shell, the syllabus-style topic menu that replaces the flat tab row, the complete topic inventory, design tokens, and responsive behavior.

---

## 1. Shell layout

```
┌────────────────────────────────────────────────────────────┐
│ HEADER (black band, full width)                            │
│  Ear Trainer                              [Exam mode]      │
│  Train your ear — harmony, melody & rhythm                 │
├──────────────┬─────────────────────────────────────────────┤
│ SYLLABUS     │ MAIN (one topic view at a time)             │
│ SIDEBAR      │  ┌───────────────────────────────────────┐  │
│              │  │ Settings card                         │  │
│ Intervals &  │  ├───────────────────────────────────────┤  │
│  Scales      │  │ Practice / response card              │  │
│  · Interval  │  ├───────────────────────────────────────┤  │
│    Recognit. │  │ Session score (inside/below practice, │  │
│  · Scales    │  │  exactly as each legacy view lays it  │  │
│  …           │  │  out — do not restructure)            │  │
│ Chords       │  └───────────────────────────────────────┘  │
│  …           │                                             │
├──────────────┴─────────────────────────────────────────────┤
│ FOOTER (credit line, as legacy)                            │
└────────────────────────────────────────────────────────────┘
```

- **Header** replaces the legacy `hero-header` card with a full-width **black band** (`--ecu-black` background, white text) — this is the "dark/black accent header treatment" the spec names. Contents: `<h1>Ear Trainer</h1>`, subtitle `Train your ear — harmony, melody & rhythm.`, and the existing `Exam mode` button (ported styling, teal fill on white/black).
- **Main** hosts the topic components (`TopicHost`, all mounted, one visible — D9a). The three-card structure (Settings → Practice/Response → Score) already exists inside every legacy view; components must reproduce each view's visible structure and **legacy CSS class names** so the ported stylesheets apply unchanged (Tier-2 parity, D15).
- **Footer**: ported credit line.

## 2. Syllabus sidebar

- Desktop (≥1024px): fixed-position left column, `260px` wide, white background, right border `1px solid var(--border)`, independently scrollable.
- Category header: uppercase, `0.78rem`, letter-spaced, teal (`--accent`), padded top gap between groups — same typography treatment as the legacy `.settings-section-title`.
- Topic entry: full-width button, `0.9rem`, black text, left-aligned, `8px` radius, hover = `--ecu-teal-light` background.
  - **Active topic**: teal background (`--accent`), white text, `font-weight: 700`. Exactly one active at a time.
  - **Placeholder topic**: identical rendering to active-able topics (per spec §2 — the full syllabus must look uniform), except a small right-aligned `soon` tag (muted, `0.68rem`, bordered pill). Clicking navigates to the shared placeholder view (see §4).
- The sidebar (`SyllabusMenu.tsx`) renders from the registry array — no hand-maintained list.
- While an exam is running, the sidebar entries are disabled (legacy: mode tabs disabled during exam).

### Mobile / narrow (<1024px)
- Sidebar becomes an off-canvas **drawer** from the left (full-height, same content, `max-width: 300px`, scrim behind).
- Header gains a hamburger button (left of the title) that opens it; selecting a topic closes it.
- The drawer is the only navigation change on mobile; topic views already reflow via the legacy `repeat(auto-fit, minmax(225px, 1fr))` grids.

## 3. Topic inventory (exact menu contents, in this order)

Categories and topics below are the complete v1 menu. `●` = implemented (`status: "active"`), `○` = placeholder.

**Intervals & Scales**
- ● Interval Recognition (`interval-recognition`)
- ● Scales (`scales`)
- ○ Interval Comparison, ○ Interval Singing, ○ Jazz Scales, ○ Tuning

**Chords**
- ● Chord Recognition (`chord-recognition`)
- ○ Chord Comparison, ○ Cluster Chords, ○ Jazz Chords, ○ Chord Singing

**Rhythm**
- ● Meter Recognition (`meter-recognition`) — NEW build
- ● Rhythm Dictation (`rhythm-dictation`)
- ○ Rhythm Comparison, ○ Rhythm Imitation, ○ Rhythm Styles, ○ Two-Part Rhythm Dictation

**Harmony & Form**
- ● Chord Progressions (`chord-progressions`)
- ○ Nashville Numbers, ○ Modulation, ○ Phrase Structure & Form, ○ Jazz Forms

**Pitch & Melody**
- ● Melodic Dictation (`melodic-dictation`) — NEW build
- ○ Pitch Dictation, ○ Melodic Comparison, ○ Note Recognition, ○ Sight Singing, ○ Contour

**Repertoire**
- ○ Repertoire Listening (single placeholder)

**Musical Elements**
- ○ Dynamics & Articulation, ○ Tempo & Texture (placeholders)

**Custom Topics**
- ○ Create a custom topic (single placeholder entry; empty-state copy: *"Your own exercises will live here."*)

Default route on first load: `chord-progressions` (matches legacy default tab).

## 4. Placeholder view (shared)

One reusable view: standard card containing the topic title, a muted line *"This topic is part of the syllabus but isn't built yet."*, and a `Back` link to the previously active implemented topic. No fake settings/transport controls inside the view — uniformity applies to the **menu**, not to pretending a practice view exists.

## 5. Design tokens (ported verbatim from `legacy/jazz-progression-trainer-rhythm.html` `:root`)

```css
:root {
  color-scheme: light;
  --ecu-teal: #005f6b;   --ecu-teal-light: #e8f0f1;  --ecu-teal-dark: #004a54;
  --ecu-black: #000000;  --ecu-white: #ffffff;
  --bg-1: #ffffff;  --bg-2: #f7f7f7;
  --panel: #ffffff; --panel-2: #fafafa;
  --text: #000000;  --muted: #5a5a5a;
  --accent: #005f6b; --accent-2: #004a54; --accent-outer: #000000;
  --danger: #c0392b; --warn: #9a6b00;
  --border: #d8d8d8; --bar: #f0f0f0; --bar-active: #005f6b;
}
```

- Font stack: `Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif` (system-served; do not add a webfont).
- Cards: white, `1px solid var(--border)`, `border-radius: 14px`, padding `1.1rem 1.2rem`.
- All remaining component styles (fields, toggles, sliders, buttons, choice grids, exam overlay, rhythm view) are **ported from the legacy `<style>` block**, split into the files listed in `01-architecture.md §1`. Port, don't restyle — and keep the class names, since Tier-2 components emit them.

## 6. Per-topic theme flag

Legacy behavior: activating the rhythm tab sets `body.rhythm-active` → black page background, adjusted tab/footer colors. Generalized: the router applies `body.theme-dark` when the active topic's `theme === "dark"`. v1 mapping: `rhythm-dictation` → dark (preserving current behavior); **Melodic Dictation and Meter Recognition are `light`**; everything else light. The CSS class carries the existing `body.rhythm-active` rules, renamed.

## 7. Interaction constants (preserve exactly)

- One view visible at a time; switching stops the outgoing topic's playback but never resets its settings or score.
- Transport row order everywhere: `Initialize audio` (until ready) → `Play` → `Replay` → `Stop` → `Submit`/answer area → `Next` — implemented once as the shared `TransportRow` component and used by every topic.
- Feedback: correct/incorrect status line + revealed answer styling as each legacy view does it; auto-advance checkbox where it exists today (all recognition topics) and on the two new recognition-style topics.
- Keyboard shortcuts in Rhythm Dictation (1–8, R, D, Backspace, Esc) are preserved and extended to Melodic Dictation (see its topic doc).

## 8. Accessibility baseline

Preserve legacy attributes (`aria-label` on staff SVG, `aria-live` hints, labelled toggles) when porting; new menu gets `<nav aria-label="Syllabus">`, drawer gets focus trap + Esc-to-close. Nothing beyond this baseline is in scope for v1.
