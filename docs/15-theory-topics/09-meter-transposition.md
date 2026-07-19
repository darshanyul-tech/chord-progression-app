# Theory Topic 09 — Meter Transposition (`meter-transposition`) — NEW

**Status:** new build. Section: Theory · Category: Transposition · Theme: light — note
this topic reuses the **rhythm staff**, whose aural host runs dark; here it renders on
the standard light theme (the rhythm-staff renderer is theme-agnostic SVG/VexFlow; verify
contrast once).
**Reuse (14-theory-engine + rhythm stack):** writing frame §9b; the rhythm-dictation
input surface (`RhythmStaffHost` + palette + `lib/rhythm/time.ts` grading via
`measuresEqual`) — reused with a restricted palette, **no playback, no metronome, no
count-in**; compound meters and triplet durations (0.333/0.667) already exist throughout
`lib/rhythm`. Tier-1 builder in `lib/written-theory/meterTransposition.ts`.

**Prerequisite display fix (part of this topic's phase):** triplet-duration notes
currently render as plain eighths/quarters with no tuplet bracket. Extend
`lib/rhythm-staff/render.ts` to wrap each run of triplet durations completing one beat
in a VexFlow `Tuplet` (bracketed "3", display-only, no grading impact). This also
retroactively fixes Rhythm Dictation's triplet display — call that out in the commit.

## 1. Exercise

A short rhythm is displayed in a **source meter** (read-only rhythm staff); the user
rewrites it on an **answer rhythm staff** in the paired meter so it *sounds identical*,
converting between **compound and simple time**:

- Compound → simple: 6/8 → 2/4 (dotted-crotchet beat becomes a crotchet beat; quaver
  groups become triplets).
- Simple → compound: 2/4 → 6/8 (triplet figures become straight quavers).

Meter pairs: **6/8 ↔ 2/4, 9/8 ↔ 3/4, 12/8 ↔ 4/4.** Bar count and rest placement are
preserved; only note values change. Writing-frame submit contract (engine §9b): one
submit; on incorrect, the expected rhythm draws on the answer staff as the red
correction voice — the rhythm staff's existing reveal convention, reused unchanged.

## 2. Settings

| Setting | Control | Values / default |
|---|---|---|
| Meter pairs | checkboxes | 6/8↔2/4✓ / 9/8↔3/4✓ / 12/8↔4/4 (≥1 enforced) |
| Direction | select | compound → simple✓ / simple → compound / both (coin flip) |
| Difficulty | select | basic✓ (cells 1, 2, 5, 6 below) / full (adds cells 3, 4) |
| Bars | select | 1✓ / 2 |
| Auto-advance | toggle | off✓ |

**Storage schema** (`eartrainer.v1.settings.meter-transposition`):
`{ pairs, direction, difficulty, bars, autoAdvance }`

## 3. The beat-cell mapping (binding — the entire correctness core)

Generation and grading both run on **beat cells**: one compound beat (dotted crotchet,
1.5 beat-units) maps to one simple beat (crotchet, 1 beat-unit). v1 cell table
(beat-unit durations in the app's quarter-note units; ↔ is exact both directions):

| # | Compound beat (6/8 etc.) | Simple beat (2/4 etc.) |
|---|---|---|
| 1 | dotted crotchet `[1.5]` | crotchet `[1]` |
| 2 | three quavers `[0.5, 0.5, 0.5]` | quaver triplet `[0.333, 0.333, 0.333]` |
| 3 | crotchet + quaver `[1, 0.5]` | triplet crotchet + triplet quaver `[0.667, 0.333]` |
| 4 | quaver + crotchet `[0.5, 1]` | triplet quaver + triplet crotchet `[0.333, 0.667]` |
| 5 | dotted-crotchet rest `[1.5 R]` | crotchet rest `[1 R]` |
| 6 | dotted minim `[3]` (spans 2 beats; 6/8 whole bar) | minim `[2]` |

- Anything not expressible in these cells is **out of the v1 pool by construction** —
  generation composes bars from cells, so no filtering is ever needed.
- Cell 6 only starts on an odd beat boundary (beats 1, 3, …) and consumes two beats.
- The triplet values 0.333/0.667 are the existing `lib/rhythm` durations (already
  handled by `vexDuration`, gap decomposition, and grading tolerance `durationClose`).

## 4. Question generation (`lib/written-theory/meterTransposition.ts`)

1. Pick an enabled pair + direction (source meter follows). Per bar, fill the compound
   side's beats by picking cells uniformly from the difficulty's set (rest cell capped
   at one per bar so questions can't degenerate).
2. Derive both notations mechanically from the cell sequence (each cell knows its beats
   in both meters — build `Measure[]` for source and expected answer).
3. Output `{ sourceSig, targetSig, direction, sourceMeasures, expectedMeasures }`.

## 5. Display, input & grading

- Binding layout — **source rhythm on top, answer stave directly below it** (same
  arrangement as Transposition, spec 08 §4): the read-only source rhythm staff in the
  source meter sits above, the editable answer staff in the target meter directly
  beneath it in the same practice card, prompt text above the source. Both render at
  the rhythm-dictation staff's own geometry (same canvas width/viewBox and responsive
  full-card-width CSS), so they occupy the same horizontal span and each answer bar
  sits vertically below its source bar (bar counts are always equal; bar-to-bar
  vertical alignment is required, per-note x-alignment inside a bar is not).
- Answer staff starts default-filled with rests (the rhythm topics' existing
  convention — `pulseRestSpans`).
- Answer palette: exactly the durations appearing on the target side of the enabled
  difficulty's cells (plus the matching rests) — e.g. compound→simple basic: crotchet,
  minim, triplet quaver, crotchet rest. Rhythm Dictation's palette component reused with
  this custom duration set; its keyboard shortcuts follow the palette for free. Page
  layout: engine §8c — Rhythm Dictation's own bottom-bar structure verbatim, palette
  centered below the staves, Submit/Next in the same actions position.
- Grading: `measuresEqual` per measure against `expectedMeasures` (beat + duration +
  rest, existing tolerance). Feedback exactly as Rhythm Dictation gives it after its
  own submit (reuse, don't restyle); status line "n of m bars correct".

## 6. Unit tests

- Cell table round-trip: mapping every cell compound→simple→compound is the identity.
- Bar arithmetic: generated source and expected bars are always exactly full
  (`durationFitsBar` / sum = measureBeats) in their own meters, for all three pairs and
  both bar counts.
- Direction symmetry: a simple→compound question's expected answer, fed back as a
  compound→simple source, regenerates the original.
- Tuplet bracket extension: runs of 0.333s produce one Tuplet group per beat; a lone
  0.667+0.333 beat groups once; non-triplet bars produce none (render-layer test, same
  style as existing `render.test.ts`).
- Rest cap: ≤1 rest cell per bar over 500 draws.

## 7. Acceptance criteria

- Live: a 6/8 bar `♩. | ♪♪♪` rewritten as `♩ | triplet(♪♪♪)` in 2/4 grades correct;
  writing straight quavers instead of the triplet grades that bar wrong.
- Triplet brackets render with the "3" in both the palette preview and placed notes
  (and — regression check — in Rhythm Dictation with triplets enabled).
- No audio UI appears anywhere in the topic (no transport, no metronome).
- Layout: the source rhythm renders above the answer stave at the same width, each
  answer bar directly below its source bar (screenshot check at desktop and mobile
  widths).
- Writing-frame contract verified once end-to-end; settings persist; score doesn't.
