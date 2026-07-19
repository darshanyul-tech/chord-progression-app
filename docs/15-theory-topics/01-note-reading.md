# Theory Topic 01 — Note Reading (`note-reading`) — NEW

**Status:** new build. Section: Theory · Category: Reading & Notation · Theme: light.
**Default theory topic** (first landing inside the Theory section).
**Reuse (14-theory-engine):** choice frame §9a; `TheoryStaffView` §7; clef extension §6;
`spelledPitch` labels §1. Tier-1 builder in `lib/written-theory/noteReading.ts`.

## 1. Exercise

A single note is displayed on a staff (whole note, chosen clef, no key signature, explicit
accidental when there is one). The user names it from a button grid. Spelling-exact: the
displayed note *is* a spelling (G♯ shown → A♭ answered = wrong; the accidental on the
staff is explicit, so there is no ambiguity to forgive). 3 attempts, first-guess scoring,
reveal names the note ("That was C♯"), optional auto-advance.

## 2. Settings

| Setting | Control | Values / default |
|---|---|---|
| Clefs | checkboxes | treble✓ / bass✓ / alto / tenor (≥1 enforced; each question picks uniformly among enabled) |
| Range | select | staff only / staff + 2 ledger lines✓ / staff + 4 ledger lines (each side) |
| Accidentals | select | naturals only✓ / naturals + sharps & flats |
| Show octave numbers | toggle | off✓ — when on, answer buttons carry octaves (C4 vs C5) and grading includes the octave |
| Auto-advance | toggle | off✓ |

**Storage schema** (`eartrainer.v1.settings.note-reading`):
`{ clefs, range, accidentals, octaveNumbers, autoAdvance }`

## 3. Question generation (`lib/written-theory/noteReading.ts`)

1. Pick a clef from the enabled set; compute the legal staff-position window from the
   range setting via `staffLineFor`/`lineToLetterOctave` (lib/melody/theory.ts — "staff
   only" = lines 1–5, each ledger step widens by 1 line above and below).
2. Pick a position uniformly; naturals-only mode stops here. Accidentals mode: with
   probability 1/2 attach ♯ or ♭ (coin flip) to the letter.
3. Output `{ clef, spelling: SpelledPitch, answerId }`.
   - `answerId` without octaves = letter+acc (`'C#'`); with octaves = full (`'C#4'`).

Choice grid: octave off → 7 buttons (naturals mode) or 21 buttons in accidentals mode —
`GroupedChoiceGrid` with three groups in this order: **Naturals** (C…B), **Sharps**
(C♯…B♯), **Flats** (C♭…B♭), binding. Octave on → the grid lists exactly the spellings
possible in the current clef+range window (computed, not hardcoded), grouped the same
way.

## 4. Display

`TheoryStaffView`: one whole note, correct accidental glyph, no key signature, no time
signature. Wrong-guess feedback never changes the display; the reveal (after 3 misses)
highlights nothing — the note was already visible; only the status line teaches.

## 5. Unit tests

- 500-question sweeps per settings combo: every note within the range window; accidental
  frequency ≈ 1/2 in accidentals mode; all four clefs produce correct letter/octave for
  known lines (spot-assert e.g. alto middle line = C4, tenor 4th line = C4, bass line 2
  = B2, treble +1 ledger below = C4).
- Choice-grid contents match the range window exactly in octave mode.

## 6. Acceptance criteria

- All four clefs render correctly (visual check against a notation reference for one note
  per clef).
- Spelling-exactness verified live (display G♯, answer A♭ → wrong, status explains).
- First-guess-only scoring; settings persist; score doesn't; auto-advance honored.
