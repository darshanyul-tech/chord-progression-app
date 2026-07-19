# Theory Topic 06 — Scale Writing (`scale-writing`) — NEW

**Status:** new build. Section: Theory · Category: Writing · Theme: light.
**Reuse (14-theory-engine):** writing frame §9b; `SlotStaffInput` §8a (7 empty slots);
`scaleSpelling` §3; grading normalization §10. Tier-1 builder in
`lib/written-theory/scaleWriting.ts`.

## 1. Exercise

The prompt names a scale (*"Write the B♭ major scale, ascending"*), the tonic is given as
the first note on an **open staff** (no key signature — every accidental must be written
explicitly, which is the pedagogical point), and the user fills the remaining 7 slots
(degrees 2–8; slot 8 is the octave tonic and is **not** free — writing it is part of the
exercise). Spelling-exact per slot. Writing-frame submit contract (engine §9b): one
submit; on incorrect, the expected scale draws as the red correction voice.

## 2. Settings

| Setting | Control | Values / default |
|---|---|---|
| Scales | grouped checkboxes | **Major & minor:** major✓ / natural minor✓ / harmonic minor / melodic minor · **Major modes:** the 7 modes (all off✓ by default; ids shared with `lib/recognition/scales.ts` labels) — ≥1 enforced overall |
| Direction | select | ascending✓ / descending / both (coin flip) |
| Clefs | checkboxes | treble✓ / bass✓ |
| Hear it | toggle | off✓ — after submit, plays the user's 8 notes as written (0.35 s each, shared sampler) so a spelling error is also *heard* |
| Auto-advance | toggle | off✓ |

**Storage schema** (`eartrainer.v1.settings.scale-writing`):
`{ scales, direction, clefs, hearIt, autoAdvance }`

## 3. Question generation (`lib/written-theory/scaleWriting.ts`)

1. Pick an enabled scale type and direction.
2. Tonic pool: all natural and single-accidental spellings such that
   `scaleNeedsDoubleAccidentals(tonic, type)` is false (engine §3 — e.g. G♯ harmonic
   minor is excluded, A♭ major is in). Octave chosen so all 8 notes fit within the
   clef's staff ± 2 ledger lines.
3. Expected answer = `spellWrittenScale(tonic, type)`, reversed for descending — with
   one binding exception: **melodic minor descending uses the natural-minor form**
   (the classical convention, and exactly why melodic minor + descending is worth
   drilling). The reveal for that case says so explicitly.
4. Output `{ clef, type, direction, tonic, expected: SpelledPitch[8] }`.

## 4. Display & input

Page layout: engine §8c — melodic dictation's card structure verbatim (♯/♭ + Backspace/
Clear centered in `.md-palette` below the staff; Submit/Next in `.md-actions`).

`SlotStaffInput`: 8 whole-note slots, slot 0 pre-filled (locked tonic; for descending,
the *upper* tonic is given first — the staff always reads left→right in performance
order). Prompt states scale + direction. On an incorrect submit the expected notes draw
in the red correction voice at the differing slots (engine §9b); status line reports
"n of 8 notes correct".

## 5. Unit tests

- Spelling table sweep: for every (tonic, type) pair in the pool, the 8 expected notes
  use each letter exactly once (octave tonic repeats the first) and match hand-checked
  cases: B♭ major = B♭ C D E♭ F G A B♭; C♯ natural minor = C♯ D♯ E F♯ G♯ A B C♯;
  D harmonic minor = D E F G A B♭ C♯ D; F melodic minor asc = F G A♭ B♭ C D E F,
  desc = F E♭ D♭ C B♭ A♭ G F; E Lydian = E F♯ G♯ A♯ B C♯ D♯ E.
- Pool filter: G♯ harmonic minor, D♯ major, F♭ anything-needing-𝄫 excluded; A♭ major,
  C♯ major included.
- Direction handling incl. the melodic-descending exception; octave window respected.

## 6. Acceptance criteria

- Live: write B♭ major with an A♯ in slot 7 and submit → incorrect, the red correction
  voice shows A♮ at that slot (enharmonic ≠ correct), status "7 of 8 notes correct".
- Melodic minor descending question expects natural-minor spellings and the reveal
  explains it.
- Writing-frame contract verified once end-to-end; settings persist; score doesn't.
