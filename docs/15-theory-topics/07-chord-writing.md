# Theory Topic 07 — Chord Writing (`chord-writing`) — NEW

**Status:** new build. Section: Theory · Category: Writing · Theme: light.
**Reuse (14-theory-engine):** writing frame §9b; `ChordStaffInput` §8b (this topic is its
only v1 consumer); `chordSpelling` §4; grading normalization §10. Tier-1 builder in
`lib/written-theory/chordWriting.ts`.

## 1. Exercise

The prompt names a chord (*"Write an F♯ minor triad, first inversion"*) and the user
builds it as a stacked whole-note chord on an open staff by clicking staff positions
(click adds a tone, click again removes it; armed ♯/♭ for accidentals). **Closed
position, bottom-to-top** is required; the bass octave is free (any octave whose full
stack fits on the staff ± 2 ledger lines), the upper tones must then be the closed-
position stack above that bass. Spelling-exact per tone. Writing-frame submit contract
(engine §9b): one submit; on incorrect, the expected chord draws as the red correction
voice beside the user's stack.

## 2. Settings

| Setting | Control | Values / default |
|---|---|---|
| Qualities | grouped checkboxes | **Triads:** major✓ / minor✓ / diminished / augmented · **Sevenths:** maj7 / min7 / dom7 / half-dim7 / dim7 (all off✓) — ≥1 enforced |
| Inversions | checkboxes | root✓ / 1st / 2nd / 3rd (3rd applies to sevenths only; a triads-only + 3rd-only combination is prevented in the UI) |
| Clefs | checkboxes | treble✓ / bass✓ |
| Hear it | toggle | off✓ — after submit, plays the user's stack as a block chord (1 s, shared sampler) |
| Auto-advance | toggle | off✓ |

**Storage schema** (`eartrainer.v1.settings.chord-writing`):
`{ qualities, inversions, clefs, hearIt, autoAdvance }`

## 3. Question generation (`lib/written-theory/chordWriting.ts`)

1. Pick an enabled quality and a legal enabled inversion.
2. Root pool: natural + single-accidental spellings with
   `chordNeedsDoubleAccidentals(root, quality)` false (D♯ major triad excluded — F𝄪;
   E♭ minor, F♯ major included).
3. Expected stack = `spellChord(root, quality, inversion)` (engine §4: bass = inversion
   member, closed position ascending).
4. Output `{ clef, quality, inversion, root, expected: SpelledPitch[3|4], promptText }`.
   Prompt wording: "\<root\> \<quality label\> triad/seventh, \<root position | first |
   second | third inversion\>".

## 4. Display, input & grading

- Page layout: engine §8c — melodic dictation's card structure verbatim (♯/♭ +
  Backspace/Clear centered in `.md-palette` below the staff; Submit/Next in
  `.md-actions`).
- `ChordStaffInput` with max stack = the quality's tone count. Submit stays disabled
  until the stack is full (writing frame §9b — no partial grading).
- Grading normalizes the bass octave: the user's stack is correct if transposing the
  whole stack by whole octaves makes it `spellingsEqual` per tone with the expected
  stack (bass-octave freedom, engine §10 note). Anything non-closed (a gap of more than
  an octave-internal third/fourth between adjacent tones — i.e. per-tone mismatch after
  normalization) grades as wrong tones, and the status line adds "closed position
  required" when the pitch *classes* were all right but the spacing wasn't.
- On an incorrect submit the expected stack draws in the red correction voice (engine
  §9b) and the question locks until Next.

## 5. Unit tests

- Spelling sweep incl. hand-checked cases: F♯ minor 1st inv = A C♯ F♯; A♭ major root =
  A♭ C E♭; B dim = B D F; C aug = C E G♯; G dom7 2nd inv = D F G B; C♯ half-dim7 root =
  C♯ E G B.
- Pool filter excludes double-accidental chords; inversion legality (3rd inversion never
  generated for triads).
- Grading: octave-shifted correct stack passes; right pitch classes in open spacing
  fails with the spacing flag; enharmonic tone fails.

## 6. Acceptance criteria

- Live: build F♯ minor 1st inversion correctly an octave lower than the generator's
  reference octave → correct. Build it with E♯ instead of F♯ and submit → incorrect,
  red correction voice shows the expected stack.
- Click-to-remove works and the hover ghost previews add vs remove distinctly.
- Writing-frame contract verified once end-to-end; settings persist; score doesn't.
