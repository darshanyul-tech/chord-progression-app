# 13 — Home Page & Section Navigation (Aural / Theory)

Binding design for splitting TryTone into **sections** — the existing ear-training content
becomes the **Aural** section, a new **Theory** section hosts the written-theory topics
(specs in `docs/15-theory-topics/01–09`), and a new **Home** page becomes the landing
point where the user picks a section. Extends `02-ui-shell-and-navigation.md`; everything
in that doc stays binding for the inside of a section unless amended here.

---

## 1. Information architecture

```
Home (/)                         ← landing page, no sidebar
 ├─ Aural   (/aural/topic/:id)   ← existing app, unchanged inside
 │    └─ Exam mode (/exam)       ← aural-only, unchanged
 └─ Theory  (/theory/topic/:id)  ← new section, 9 topics
```

- A **section** is a top-level area with its own syllabus sidebar, categories, and default
  topic. v1 sections: `aural`, `theory`. The structure must make adding a third section a
  registry edit, not a shell rewrite.
- **Exam mode remains aural-only in v1.** Theory topics register no exam types; a written
  theory paper is a named backlog item (`16-theory-implementation-plan.md §Backlog`).
- **Custom presets remain aural-only in v1** (same backlog section). Theory topics do not
  render `SaveAsCustomTopicButton` and do not join `settingsStoreRegistry` until that
  backlog item lands. This is scope control, not architecture: nothing here may preclude
  extending presets to theory later.

## 2. Routes (hash router, extends `App.tsx`)

| Route | Renders |
|---|---|
| `/` | **HomePage** (new) — no `Layout` sidebar; header + footer only |
| `/aural/topic/:id` | `Layout` + `TopicRoute` (existing behavior, aural topics only) |
| `/theory/topic/:id` | `Layout` + `TopicRoute` (theory topics only) |
| `/exam` | unchanged |
| `/topic/:id` | **redirect** to `/aural/topic/:id` (preserves existing bookmarks/links) |
| `*` | redirect to `/` |

- `TopicRoute` gains a section check: a topic id requested under the wrong section prefix
  (e.g. `/theory/topic/chord-progressions`) redirects to that topic's correct section URL —
  never a 404, matching the existing "unknown ids fall back" behavior.
- Unknown/hidden ids under `/aural/` fall back to the aural default topic; under `/theory/`
  to the theory default topic.
- Default topic per section: aural = `chord-progressions` (unchanged), theory =
  `note-reading`.
- The exam-running guard that disables sidebar entries also disables the header section
  links (leaving mid-exam via Home/Theory must not be possible by accident — same rule as
  topic switching).

## 3. Registry changes (`src/topics/registry.ts`)

- `TopicDefinition` gains `section?: 'aural' | 'theory'` — **optional, default `'aural'`**,
  so the 30 existing entries stay untouched. Theory topics set it explicitly.
- New `SectionId` type + `SECTIONS` array (id, title, blurb, default topic id) — the
  HomePage and HeaderBar render from this array, never a hand-maintained list.
- `CategoryId` union extended with the four theory categories (§5). New
  `SECTION_CATEGORY_ORDER: Record<SectionId, CategoryId[]>` replaces the single
  `CATEGORY_ORDER` for menu rendering (aural's order is the existing `CATEGORY_ORDER`
  verbatim).
- New helpers: `topicsForSection(section)`, `sectionOfTopic(id)`,
  `DEFAULT_TOPIC_BY_SECTION: Record<SectionId, string>` (keep the existing
  `DEFAULT_TOPIC_ID` export aliased to the aural entry so nothing breaks).

## 4. Home page (`src/shell/HomePage.tsx`)

Framework only — deliberately simple, one card per section, extensible by adding to
`SECTIONS`.

- Header band (same `HeaderBar`) and footer render as everywhere; **no sidebar, no
  hamburger** (the drawer button hides on Home — there is no syllabus to open).
- Main content, centered column (`max-width: 900px`):
  - Welcome line: `<h2>` "Welcome to TryTone" + muted sentence
    "Train your ear, and your theory." — this exact copy, binding.
  - **Section cards**, one per `SECTIONS` entry, side by side on desktop
    (`repeat(auto-fit, minmax(280px, 1fr))` grid), stacked on narrow screens. Each card:
    standard card styling (white, `--border`, 14px radius), section title (`--accent`,
    large), 1–2 sentence blurb, active-topic count computed from the registry
    ("14 topics"), and the whole card is one link to
    `/{section}/topic/{defaultTopicId}`. Hover: `--ecu-teal-light` background,
    pointer cursor. Card contents:
    - **Aural Training** — "Interval, chord, rhythm and melody recognition, dictation and
      singing — training by ear."
    - **Theory** — "Note reading, key signatures, scale and chord writing, transposition —
      written music theory."
- No topic-level links on Home in v1 (the sidebar does that inside a section).
- Keyboard/a11y: cards are `<a>` elements (real links, focusable, Enter works); page
  `<main>` landmark as elsewhere.

## 5. Theory section syllabus (sidebar inventory, in this order)

Rendered by the same `SyllabusMenu` component, now filtered to the active section
(section read from the route). Category header / entry / active styling identical to
`02-ui-shell §2`.

**Reading & Notation** (`theory-reading`)
- Note Reading (`note-reading`)
- Key Signatures (`key-signatures`)

**Keys & Degrees** (`theory-keys`)
- Scale Degrees (`scale-degrees`)
- Scale Home Keys (`scale-home-keys`)

**Writing** (`theory-writing`)
- Interval Writing (`interval-writing`)
- Scale Writing (`scale-writing`)
- Chord Writing (`chord-writing`)

**Transposition** (`theory-transposition`)
- Transposition (`transposition`)
- Meter Transposition (`meter-transposition`)

All nine ship as `status: 'placeholder'` (visible, `soon` tag, shared placeholder view —
`02-ui-shell §4`) in the shell phase, flipping to `active` topic by topic. Note: the
hidden aural placeholder `note-recognition` is unrelated to theory's `note-reading` and
stays parked as-is.

## 6. Header navigation (`src/shell/HeaderBar.tsx`)

- The black header band gains a **section nav** — `<nav aria-label="Sections">` with three
  text links: **Home · Aural · Theory** (Home first; then `SECTIONS` order). Placement:
  right of the logo group, vertically centered; on narrow screens the links stay in the
  header (three short words fit; they may drop to `0.8rem`).
- Link styling: white text on black, `0.9rem`; **active section** (from the current route;
  Home active only on `/`) gets `font-weight: 700` + a 2px solid **white** underline
  (`--ecu-white` — binding; ECU teal on the black band lacks contrast, so the accent
  color is not used here). On `/exam`, **Aural** is the highlighted section (exam mode
  is aural-only content).
- The hamburger (drawer) button: unchanged inside sections, hidden on Home (§4).
- The existing exam entry point is unchanged and stays wherever it currently lives.

## 7. State, theme, persistence

- `useUIStore` drawer state is unchanged (one drawer, shows the active section's menu).
- Per-topic dark theme flag (`02-ui-shell §6`) works unchanged; all theory topics are
  `light`. Home is light.
- Switching sections behaves like switching topics: outgoing topic's playback stops,
  settings and scores persist untouched (`02-ui-shell §7` interaction constants apply
  across sections, not just within one).
- No new persisted state. `/` always shows Home — we do **not** remember/auto-restore the
  last section (deliberate: Home is the product's front door; one extra click is fine).

## 8. Acceptance criteria (shell phase gate)

- Fresh load of `/` shows Home; both cards navigate to their section's default topic.
- Old-style `/#/topic/rhythm-dictation` URL redirects to `/#/aural/topic/rhythm-dictation`
  and the topic works exactly as before (playback, settings, score, dark theme).
- Header nav reflects the active section on every route including `/exam`; links disabled
  while an exam is running.
- Theory sidebar shows the 4 categories / 9 placeholder topics; each placeholder view
  renders; aural sidebar is unchanged (screenshot-compare against pre-change).
- Mobile (<1024px): hamburger + drawer work in both sections; drawer hidden on Home;
  section links reachable and tappable.
- All existing tests green (routing tests updated for the new URL shapes, not deleted).
