# 16 — Theory Section Implementation Plan (Phases 26–33)

Successor plan to `11-next-phases.md` (Phases 21–24, fully shipped at v2.7.0; Phase 25
remains the unscheduled platform backlog). This plan adds the **Home page**, the
**Aural / Theory section split**, and the **nine written-theory topics**. Design is
complete and binding:

- `docs/13-home-and-sections.md` — home page, header section nav, routing, registry.
- `docs/14-theory-engine.md` — shared spelled-pitch/key/scale/chord libraries, staff
  input components, the two answer frames, grading normalization. **Read before any
  topic phase.**
- `docs/15-theory-topics/01–09` — one spec per topic.

**Conventions carried forward (binding, unchanged from previous plans):**
- Two-tier protocol (D15): new logic framework-free in `src/lib/` (here:
  `src/lib/written-theory/`), unit-tested; React thin. No refactors of existing ported
  code — extractions for reuse are mechanical, behavior-preserving commits.
- Seedable randomness: every generator draws through `lib/theory.ts`'s
  `random()`/`pick()`.
- No co-author trailers in commit messages.
- Every phase ends with: `npx vitest run`, `npx tsc -b`, `npm run lint`,
  `npm run build`, `npm run test:coverage` (per-file ≥90% on `src/lib/`) all clean,
  live browser verification of the changed surface, commit + push, CI green.
- Verify claims against current code before acting — this plan was written against
  v2.7.0 (working tree also carried uncommitted melodic/rhythm notation changes; if
  those landed since, trust the code).
- Escalation rules from `IMPLEMENTATION-PROMPT.md` apply: decisions here are closed;
  if one proves unworkable, stop and ask with evidence — never silently deviate.

**Version track:** this is a navigation-restructuring release series — **v3.x**.
Tags below; one tag per phase that changes the visible product.

---

## Phase 26 — Home page & sections shell (M) — spec: docs/13 — tag v3.0.0

The whole phase is shell plumbing; no theory content yet beyond placeholders.

1. Registry: `section` field (optional, default `'aural'`), `SECTIONS`,
   `SECTION_CATEGORY_ORDER`, four theory categories, the nine theory topics as
   visible placeholders (docs/13 §5), per-section default-topic map.
2. Routing: `/aural/topic/:id`, `/theory/topic/:id`, `/` → HomePage, `/topic/:id`
   redirect, wrong-section redirect, per-section fallbacks (docs/13 §2).
3. `HomePage.tsx` (docs/13 §4), `HeaderBar` section nav incl. exam-running disable and
   Home hiding the hamburger (docs/13 §6), `SyllabusMenu` section filtering.
4. Tests: routing (old URLs redirect; wrong-section redirect; fallbacks), SyllabusMenu
   filtering, HomePage links, HeaderBar active-state. Update — never delete — existing
   routing/App tests.

**Gate:** docs/13 §8 acceptance list in full, plus the standard checks. Tag **v3.0.0**.

## Phase 27 — Written-theory Tier-1 core (M) — spec: docs/14 §§1–5 — no tag

Pure library work; zero visible change. Ships `src/lib/written-theory/`:
`spelledPitch.ts`, `keys.ts` (30-key table, VexFlow-spec verification test),
`scaleSpelling.ts`, `chordSpelling.ts`, `degrees.ts` — with the full test load
docs/14 §11 demands (this phase is mostly tests, deliberately: every later phase
stands on these spellings).

**Gate:** standard checks; coverage ≥90% per file on the new directory. Commit;
no tag (folded into v3.1.0).

## Phase 28 — Note Reading + Key Signatures (M) — specs: 15-theory-topics/01, 02 — tag v3.1.0

First visible theory topics; read-only displays only (no staff input yet).

1. Clef extension (docs/14 §6: alto/tenor line shifts, vexscore pass-through, render
   tests) — additive; melodic dictation settings untouched.
2. `TheoryStaffView` + `KeySignatureView` (docs/14 §7).
3. Note Reading per spec 01; Key Signatures per spec 02 (each: Tier-1 builder + tests,
   settings store, topic component on the choice frame docs/14 §9a, registry flip to
   active).

**Gate:** both specs' acceptance criteria; aural regression sweep (melodic dictation
still renders treble/bass correctly). Tag **v3.1.0**.

## Phase 29 — Scale Degrees + Scale Home Keys (S) — specs: 03, 04 — tag v3.2.0

Choice-frame topics on the Phase-27 tables; no new UI machinery.

**Gate:** both specs' acceptance criteria (including D Lydian → A major live). Tag
**v3.2.0**.

## Phase 30 — Staff input components + Interval Writing (L) — specs: docs/14 §§8–10, 05 — tag v3.3.0

The riskiest phase: the writing input layer.

1. Extract the reusable geometry/ghost/accidental pieces from Melodic Dictation's input
   host (mechanical, behavior-preserving commits — melodic dictation must be pixel- and
   behavior-identical after; run its full test suite before and after).
2. `SlotStaffInput` (docs/14 §8a) and `ChordStaffInput` (docs/14 §8b) + component tests
   (slot assignment by x-nearest, armed accidentals, locked slots, add/remove toggling,
   hover ghosts).
3. The writing frame (docs/14 §9b) as a shared hook/component pair (single-submit
   lock, red correction voice, completeness gating — the melodic-dictation contract) +
   tests.
4. Interval Writing per spec 05 — the deliberately-minimal first consumer (one slot).

**Gate:** spec 05 acceptance; melodic dictation regression (tests + live). Tag
**v3.3.0**.

## Phase 31 — Scale Writing + Chord Writing (M) — specs: 06, 07 — tag v3.4.0

Both writing topics on the now-proven input layer.

**Gate:** both specs' acceptance criteria (including the melodic-minor-descending
convention and the closed-position/bass-octave grading). Tag **v3.4.0**.

## Phase 32 — Transposition (M/L) — spec: 08 — tag v3.5.0

Melody-generator reuse + keyed-staff grading normalization + rhythm-locked slot entry.

**Gate:** spec 08 acceptance (both prompt modes live; signature normalization; the
A♯-vs-B♭ spelling rejection). Tag **v3.5.0**.

## Phase 33 — Meter Transposition (L) — spec: 09 — tag v3.6.0

1. Tuplet-bracket rendering in `lib/rhythm-staff/render.ts` (display-only; includes the
   Rhythm Dictation triplet-display regression check — spec 09 preamble).
2. Beat-cell library + generator (spec 09 §§3–4) + the round-trip/symmetry test suite.
3. Topic on the rhythm-staff surface with restricted palette, no audio.

**Gate:** spec 09 acceptance in full. Tag **v3.6.0**. **This closes the plan: the
Theory section is complete as scoped.**

---

## Sizing & order rationale

Order is dependency-driven: shell → tables → read-only display → choice topics → input
layer → writing topics → the two transpositions (each with one extra subsystem:
melody-generator reuse, then rhythm-staff reuse). Phases 28–29 deliver user-visible
value early while the risky input work (Phase 30) is still ahead; if Phase 30 slips,
everything before it still ships coherently.

## Out of scope for this plan (named backlog — additions to Phase 25's list)

- **Theory exam types** — the exam machine is aural-shaped (`playOnce` etc.); a written
  paper needs its own question-presentation design.
- **Custom presets for theory topics** (docs/13 §1) — save buttons, registry wiring,
  section-aware preset listing.
- Chromatic scale-degree questions (♯4̂ etc.); minor-key and chromatic transposition
  sources; compound intervals in interval writing; double-accidental palette + pools;
  keyboard entry for `SlotStaffInput`/`ChordStaffInput`; beat-value rhythmic
  transposition (3/4 ↔ 3/8 — a different exercise from simple↔compound, deliberately
  excluded); grand-staff displays; remembering the last-visited section on `/`.
- Playback affordances beyond the specced "Hear it" toggles.

## How to start an implementation session

Point it at `README.md` → `docs/00-overview-and-decisions.md` →
**this file** → `docs/13` + `docs/14` → each topic spec as its phase begins, with
`IMPLEMENTATION-PROMPT.md`'s non-negotiable rules and escalation protocol in force.
Begin at Phase 26.
