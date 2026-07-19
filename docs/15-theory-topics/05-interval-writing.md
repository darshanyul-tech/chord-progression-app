# Theory Topic 05 — Interval Writing (`interval-writing`) — NEW

**Status:** new build. Section: Theory · Category: Writing · Theme: light.
**Reuse (14-theory-engine):** writing frame §9b; `SlotStaffInput` §8a (this topic is its
proving ground — one slot, simplest possible use); `spelledPitch` intervals §1; grading
normalization §10. Tier-1 builder in `lib/written-theory/intervalWriting.ts`.

## 1. Exercise

A given note is shown on an open staff (no key signature) and the prompt asks for an
interval above or below it: *"Write a major 6th **above** the given note."* The user
places the second note in the empty slot beside it (armed ♯/♭ for accidentals).
Spelling-exact: a major 6th above C is A — G𝄪 is wrong even though it sounds the same
(and the pool never asks for anything requiring a double accidental, engine §10).
Writing-frame submit contract (engine §9b): one submit; on incorrect, the expected note
draws as the red correction voice on the same staff.

## 2. Settings

| Setting | Control | Values / default |
|---|---|---|
| Intervals | checkboxes | m2 / M2✓ / m3✓ / M3✓ / P4✓ / A4 / d5 / P5✓ / m6 / M6✓ / m7 / M7 / P8✓ (≥1 enforced) |
| Direction | select | above✓ / below / both (coin flip) |
| Clefs | checkboxes | treble✓ / bass✓ / alto / tenor |
| Hear it | toggle | off✓ — when on, a small Play button sounds the graded pair (given note then answer, harmonic then melodic is overkill: melodic only, 0.5 s each) after submit, via the shared sampler. Practice nicety, never required. |
| Auto-advance | toggle | off✓ (fires only on a correct submit — §9b) |

**Storage schema** (`eartrainer.v1.settings.interval-writing`):
`{ intervals, direction, clefs, hearIt, autoAdvance }`

## 3. Question generation (`lib/written-theory/intervalWriting.ts`)

1. Pick an enabled interval and a direction (per setting).
2. Pick a given note: any natural or single-accidental spelling whose staff position sits
   inside the clef's staff ± 2 ledger lines, **filtered** so the target
   (`transposeUp/Down`) also (a) needs no double accidental and (b) lands inside the
   same window. Uniform over the surviving pool.
3. Output `{ clef, given: SpelledPitch, intervalId, direction, expected: SpelledPitch }`.

## 4. Display & input

Page layout: engine §8c — melodic dictation's card structure verbatim (♯/♭ + Backspace/
Clear centered in `.md-palette` below the staff; Submit/Next in `.md-actions`).

`SlotStaffInput`: two whole-note positions — slot 0 pre-filled (the given note, locked),
slot 1 empty. Prompt text above the staff states the interval + direction in full words
("major 6th above"). On an incorrect submit the expected note draws beside the user's
in the red correction voice (engine §9b) and the question locks until Next.

## 5. Unit tests

- Interval math spot grid: M6 above C4 = A4; m3 below C4 = A3; A4 above F4 = B4; d5
  above B3 = F4; M7 below E♭5 = F♭4 (single accidental — stays in the pool).
- Pool-filter exclusion case: a given note of C♯ with A4 (augmented 4th) above would
  require F𝄪 (C♯4 → target MIDI 67, spelled on the 4th letter F, which is 2 semitones
  above F-natural), so C♯ never appears as a given note for that interval.
- Pool sweep: 500 questions per direction — no expected note with a double accidental,
  all notes within the window, every enabled interval appears.
- Grading: correct spelling passes; enharmonic equivalent (same MIDI, different letter)
  fails; wrong octave fails.

## 6. Acceptance criteria

- End-to-end: place a wrong note and submit → question scored incorrect, the expected
  note appears in red, input locks until Next. Verify once in each direction.
- Hear-it plays given-then-answer after submit when enabled, silent otherwise.
- Layout parity (gates §8c for all writing topics, since this is the first one built):
  side-by-side screenshot against Melodic Dictation — palette centered below the staff
  in the same bottom-bar position, Submit/Next in the same place, same button classes
  and sizes.
- Settings persist; score doesn't.
