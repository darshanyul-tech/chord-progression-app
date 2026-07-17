# 12 — Melodic Dictation Fixes (Phases MD-1 to MD-4): Palette Glyphs, Beaming, Placement Model, Hover Preview

User-reported defects in the Melodic Dictation topic (v2.7.0, commit `fa5a817`), verified
against the current code. Four independent fixes, ordered smallest-risk first. The palette
and score-builder fixes also touch Rhythm Dictation, Sight Singing, and the exam-mode
notation palette because the components are shared — verify those surfaces too.

**Conventions carried forward (binding, unchanged — same as docs 10/11):**
- Two-tier protocol (D15): new logic framework-free in `src/lib/`, unit-tested; React thin.
- Seedable randomness: generators draw through `lib/theory.ts`'s `random()`/`pick()`.
- No co-author trailers in commit messages.
- Every phase ends with: `npx vitest run`, `npx tsc -b`, `npm run lint`, `npm run build`,
  `npm run test:coverage` (per-file ≥90% on `src/lib/`) all clean, live browser verification
  of the changed surface, commit + push, CI green.
- VexFlow is pinned at **5.0.0** — check API signatures against that version, not v4 docs.
- Verify every claim below against current code before acting.

**Reference docs:** `docs/05-topics/07-melodic-dictation.md` (topic spec),
`docs/04-notation-engine.md` (Part B: VexFlow imperative-island conventions).

---

## Verified root causes

### RC-1: Palette buttons — stems point down and glyphs overflow the buttons
`src/topics/rhythm-dictation/PaletteGlyph.tsx:19` builds every icon note as
`new StaveNote({ keys: ['b/4'], duration, autoStem: !isRest })`. `b/4` is the **middle
line**, and VexFlow's auto-stem rule points stems **down** for notes on or above the middle
line — so every palette note renders stem-down. The stem-down glyph then extends below the
fixed `viewBox="0 0 44 68"` (line 30), and since the CSS gives `.rd-glyph` and its `svg`
`overflow: visible`, the ink spills outside the button instead of clipping. The rest glyph
is mis-centered in its box for the same fixed-viewBox reason.

Shared component — three consumers, all affected:
- `src/topics/melodic-dictation/MelodicDictationTopic.tsx` (palette)
- `src/topics/rhythm-dictation/RhythmDictationTopic.tsx` (palette)
- `src/components/NotePalette.tsx` (exam-mode rhythm/melodic answering)

### RC-2: Stems/beams glitch on the stave for quavers and semiquavers
`src/lib/melody/vexscore.ts:84-90` (`drawMeasureVoice`) calls
`Beam.generateBeams(beamable)` **after** `voice.draw(context, stave)`.
`generateBeams` mutates the notes it beams (stem direction, stem length, flag suppression),
but by that point the notes have already drawn themselves with individual flags and default
stems. The beam then draws over geometry it no longer matches: doubled flags, stems that
don't reach the beam, beams slashing across noteheads. It also passes no `groups`/time-sig
config and no notion of time-adjacency, so it will happily beam two eighths that are not
adjacent in time (e.g. beats 0 and 2 with a gap between).

Correct VexFlow order: build notes → create beams (`Beam.generateBeams(notes, { groups:
Beam.getDefaultBeamGroups(timeSigString) })`) → format → `voice.draw()` → `beam.draw()`
for each beam. Beams must exist before formatting/drawing so stems are prepared for them.

`buildVexScore` is also used by Sight Singing (`SightSingingStaffHost.tsx`) and the melodic
exam type — the fix applies there automatically, but verify both.

### RC-3: "Can't fit 3 crotchets in 3/4" — layout and hit-testing disagree
Two mechanisms compound:

1. **Rendering doesn't reflect beat positions.** `drawMeasureVoice` puts only the placed
   notes into a SOFT-mode voice and lets the Formatter lay them out **sequentially** —
   unfilled beats take no horizontal space. A crotchet placed at beat 0 in an otherwise
   empty 3/4 bar renders near the left/center of the whole bar width.
2. **Hit-testing assumes proportional layout.** `VexStaffHost.tsx:74-76` maps click-x
   linearly (`rel * measureTotalBeats`, snapped to `gridStep` — the GCD of active
   durations, e.g. 0.25) across the note area. And `usePractice.ts:306-315`
   (`placeNoteAt`) **silently replaces** any overlapping note.

So the user places crotchet #1 at beat 0, then clicks where the next crotchet *visually*
belongs; that x maps to some beat like 0.75 or 1.25, which overlaps an existing note or a
previously placed one, and the placement *replaces* rather than adds. Result: the bar can
never accumulate 3 crotchets, matching the report. (The capacity hint "3 quarters per bar"
from `maxNotesOfDuration` is correct — the input path is what's broken.)

### RC-4: No placement preview
Placement is blind: nothing shows where the click will land before it commits. The keyboard
cursor already draws a marker (`vexscore.ts:168-193` — purple triangle at
`cursorBeat`/`cursorMidi`), but mouse users get nothing.

---

## Phase MD-1 — Palette glyph rendering (S) — `PaletteGlyph.tsx` only

1. Force stems up on note icons: `autoStem: false`, `stemDirection: Stem.UP` (import
   `Stem` from `vexflow`; in VexFlow 5 `StaveNote` accepts `stemDirection` in its ctor
   options — verify the exact option name against the installed 5.0.0 typings).
2. Fix the overflow properly instead of retuning magic offsets: after drawing, read the
   real ink extent with `svg.getBBox()` and set the `viewBox` from it plus ~2px padding,
   so every glyph (whole note, dotted notes, rest) is contained and centered regardless of
   stem direction. Keep the width/height attribute stripping so CSS sizing still applies.
   Note: `getBBox` needs a rendered DOM — this component has no unit tests today (it's a
   DOM-drawing island, exercised by a11y/topic tests only); keep it that way and verify
   visually rather than adding jsdom-hostile tests.
3. Live-verify all three consumers: Melodic Dictation palette, Rhythm Dictation palette,
   and an exam question that shows `NotePalette` (rhythm or melodic exam answer). Every
   glyph inside its button, stems up, rest centered, dotted glyphs show the dot inside
   the box.

**Gate:** all seven duration buttons + rest button visually contained on all three
surfaces; no CSS changes needed (if the fix seems to need CSS, the viewBox math is wrong).

## Phase MD-2 — Beaming/stem fix in the score builder (S–M) — `lib/melody/vexscore.ts`

1. Rework `drawMeasureVoice` to the canonical order: build `staveNotes` → create beams
   **before** drawing, via `Beam.generateBeams(beamableRun, { groups:
   Beam.getDefaultBeamGroups(\`${timeSig.beatsPerBar}/${timeSig.beatValue}\`) })` → format
   voice → `voice.draw()` → draw beams. `drawMeasureVoice` will need the time signature
   passed in (it already gets `measureTotalBeats`; pass the `TimeSigInfo` instead).
2. Only beam **time-adjacent runs**: split the measure's sorted notes into runs where each
   note starts exactly where the previous ends (`durationClose(prev.beat + prev.duration,
   next.beat)`), no rests intervening, all durations < 1 beat; call `generateBeams` per
   run. Notes separated by gaps or rests must never share a beam. This run-splitting is
   pure logic — put it in `lib/melody/vexscore.ts` as an exported pure helper (e.g.
   `beamableRuns(notes): PitchedNote[][]`) and unit-test it in `vexscore.test.ts`
   (single eighth → no run; two adjacent eighths → one run of 2; eighths at beats 0 and 2
   → two singleton runs → no beams; eighth-rest-eighth → no beam; 4 sixteenths → one run).
3. Reveal styling: beams for the reveal voice must keep taking the wrong-color style —
   preserve the existing `style` application on beams.
4. Live-verify: place quavers/semiquavers in Melodic Dictation (adjacent pairs beam
   cleanly, no double flags, no stray stems), check Sight Singing's displayed melody and a
   melodic-dictation exam reveal still render correctly.

**Gate:** `vexscore.test.ts` additions green; visual check of quaver/semiquaver beaming in
practice + reveal + Sight Singing; coverage on `lib/melody/vexscore.ts` stays ≥90%.

## Phase MD-3 — Placement model: make layout, hit-testing, and capacity agree (M–L)

The load-bearing decision: **make the rendered x-position of every note proportional to
its beat**, so the existing linear hit-test math becomes true instead of approximately
false. Do not try to invert VexFlow's formatter from the click side.

1. **Proportional layout via gap-filling.** In `drawMeasureVoice`, before building the
   voice, fill the gaps between placed notes (and from the last note to the bar end) with
   invisible padding rests (VexFlow `GhostNote`s, or rests with a transparent style —
   `GhostNote` is the purpose-built tickable; verify it formats with normal width in 5.0.0).
   Decompose each gap greedily into standard durations (existing helpers in
   `lib/rhythm/time.ts` / rhythm staff code may already do this — check
   `lib/rhythm-staff/` before writing a new one). The formatter then spaces real notes
   close to proportionally, and an empty region of the bar visibly *is* empty space.
   Gap-decomposition is pure Tier-1 logic: exported helper + unit tests (gap of 1.5 →
   [1, 0.5] or [1.5]; full empty bar in 3/4 → paddings summing to 3; no padding when bar
   is exactly full).
2. **Snap to the armed duration's legal grid.** In `VexStaffHost.handleClick`, snap the
   beat to multiples of the **armed duration** when the bar is empty at that region, and
   otherwise to the boundaries of existing notes (i.e. candidate beats = 0, and every
   `note.beat + note.duration`, plus multiples of `gridStep` that don't overlap anything).
   Simplest correct version that fixes the report: compute the set of *valid* placement
   beats (positions where the armed duration fits without overlapping), snap the click to
   the nearest valid beat, and only flash-reject when the set is empty. Put this in a pure
   Tier-1 helper (e.g. `validPlacementBeats(measure, armedDur, measureBeats, gridStep):
   number[]` + `nearestValidBeat(...)`) in `lib/rhythm/time.ts` or a new
   `lib/melody/placement.ts`, unit-tested: 3/4 empty + crotchet → [0,1,2] (plus any
   finer-grid non-overlapping positions); after placing crotchets at 0 and 1 → nearest
   valid for a third click anywhere right of center = 2; full bar → empty set.
3. **Stop silently replacing on overlap — replace only on direct hit.** In
   `placeNoteAt` (`usePractice.ts`), a placement whose snapped beat *equals* an existing
   note's beat (`durationClose`) replaces that note (re-pitching/re-valuing a note stays
   one click); anything else must land on a valid free beat from step 2 — never delete
   neighbours to make room. Keep `placementHistory` consistent for both paths.
4. **Keyboard cursor parity:** `moveCursorBeat` currently walks the raw grid; walk the
   same valid-beat set instead so keyboard placement can't construct the overlap-replace
   trap either. The cursor marker in `buildVexScore` already positions proportionally, so
   it stays consistent with the new layout.
5. Re-check `submitEnabled`'s exact-fill rule still works (it sums durations — unaffected
   by padding rests, which live only in the display layer and must **never** enter
   `userMeasures`, grading, or playback).
6. Live-verify the reported case exactly: 3/4, click three crotchets left-to-right into
   one bar — all three land, hint and submit behave; then quavers filling a bar; then
   mixed values with a rest.

**Gate:** new Tier-1 helpers ≥90% covered; the 3-crotchets-in-3/4 flow works live;
`usePractice.test.tsx` extended with a placement regression test (place 1,1,1 in 3/4 via
`placeNoteAt` and assert three notes at beats 0/1/2 — this already passes today via direct
beat args, so also assert the new nearest-valid-beat helper's outputs, which is where the
bug actually lived).

## Phase MD-4 — Hover placement preview (M) — `VexStaffHost.tsx` + `vexscore.ts`

1. Extend `MelodyStaffModel` with an optional `hover: { measureIndex, beat, midi | null
   (rest), duration, isRest } | null`. In `buildVexScore`, when present, draw a ghost of
   the armed note at the snapped position: a semi-transparent (≈0.35 alpha, accent color)
   notehead + stem at the exact x the beat maps to and the exact y the pitch maps to
   (reuse the cursor-marker math at `vexscore.ts:168-193`; for rests draw the ghost at the
   middle line). A hand-drawn ellipse + stem line via the raw context is sufficient — do
   **not** build a second VexFlow voice for the ghost (it would perturb formatting).
2. In `VexStaffHost`, add `onMouseMove` reusing `handleClick`'s exact transform +
   snapping (extract the shared math into one function so click and hover can never
   disagree — this is the point of the feature), throttled with `requestAnimationFrame`;
   `onMouseLeave` clears the hover. Hover state lives in the practice hook or local state
   — either is fine, but the placed position must come from the *same* snap call the
   preview used.
3. When the snapped position is invalid (bar full / no valid beat), show no ghost (or a
   muted 'blocked' marker) — clicking then flashes as today. When `hasSubmitted`, no ghost.
4. Touch devices get no hover — acceptable; the flash/preview-audio feedback remains.
5. Live-verify: ghost tracks the mouse across beats and staff lines, matches the committed
   note exactly on click (pitch, beat, dot, accidental reflected — accidental shifts the
   ghost's letter position only via the placed midi, same as click), disappears on leave.

**Gate:** hover ghost position === committed note position for every click (spot-check
across both measures, edges included); no measurable render jank (rAF-throttled full
rebuilds are acceptable at this scene size — if not, diff-render only the ghost layer).

---

## Suggested order & sizing

| Phase | Size | Depends on |
|---|---|---|
| MD-1 Palette glyphs | S | — |
| MD-2 Beaming | S–M | — |
| MD-3 Placement model | M–L | — (do before MD-4) |
| MD-4 Hover preview | M | MD-3 (shares its snapping) |

One commit per phase minimum (MD-3 will want one Tier-1 commit + one wiring commit, per
D15). Bump to **v2.7.1** (or v2.8.0 if MD-3/MD-4 are judged feature-sized) after all four
land with the standard full gate.

## Explicitly out of scope

- Rhythm Dictation's own canvas staff (it has its own placement code; only the shared
  `PaletteGlyph` change touches it).
- Any change to grading, playback, or stored `userMeasures` shape — padding rests and
  ghosts are display-only.
- Per-note recoloring in `buildVexScore` (still the known one-style-per-voice limitation).
- Triplets, ties, or new time signatures.
