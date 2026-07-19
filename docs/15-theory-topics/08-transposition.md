# Theory Topic 08 — Transposition (`transposition`) — NEW

**Status:** new build. Section: Theory · Category: Transposition · Theme: light.
**Reuse (14-theory-engine):** writing frame §9b; `SlotStaffInput` §8a in rhythm-locked
mode; `TheoryStaffView` §7; key table §2; `spelledPitch` §1; grading normalization §10
(this is the one topic on a **keyed** staff — the signature-normalization rule applies).
Melody source: `lib/melody/generator` + `MELODY_KEYS`, reused as-is. Tier-1 builder in
`lib/written-theory/transposition.ts`.

## 1. Exercise

A short melody is displayed on a **source staff** (read-only, with its key signature).
The user rewrites it transposed on an **answer staff** below, which shows the **target
key's signature** and the melody's rhythm as empty slots — clicking assigns pitches;
rhythm is locked (engine §8a), so the exercise is purely pitch transposition. Two prompt
modes:

- **To a key:** *"Transpose this melody from C major **up** to F major."* — the prompt
  **always states the direction** (binding: grading is octave-exact, and "to F major"
  alone is satisfiable both up a 4th and down a 5th; the stated direction is the one
  the generator picked, §3.3).
- **By interval:** *"Transpose this melody up a major 2nd."* — or, with the semitone
  phrasing setting, *"…up 2 semitones."* (same underlying interval; the prompt wording
  is the only difference, per the user's request that both phrasings exist).

Spelling-exact per note against the diatonic transposition (engine §10: the target
signature supplies diatonic accidentals; redundant correct accidentals are fine).
Writing-frame submit contract (engine §9b): one submit; on incorrect, the expected
notes draw in the red correction voice on the answer staff at the differing slots.

## 2. Settings

| Setting | Control | Values / default |
|---|---|---|
| Mode | select | to a key / by interval / both✓ (coin flip) |
| Interval phrasing | select | interval names✓ / semitones / mixed — by-interval prompts only |
| Intervals | checkboxes | m2 / M2✓ / m3✓ / M3✓ / P4✓ / P5✓ / m6 / M6 / m7 / M7 / P8✓, direction up & down (each question coin-flips direction) |
| Source keys | fixed | the `MELODY_KEYS` table (±4 accidentals) — not a setting; the generator's existing domain |
| Length | select | 1 bar✓ / 2 bars (4/4, quarter + eighth rhythms, no rests — the generator's steps/narrow profile; rhythm is display-only here so keep it simple) |
| Clef | select | treble✓ / bass |
| Auto-advance | toggle | off✓ |

**Storage schema** (`eartrainer.v1.settings.transposition`):
`{ mode, phrasing, intervals, length, clef, autoAdvance }`

## 3. Question generation (`lib/written-theory/transposition.ts`)

1. Pick a source key from `MELODY_KEYS` (majors only in v1 — minor-key melodies from the
   generator lean on natural minor and muddy the diatonic-spelling story; minors are
   backlog). Generate a melody via `lib/melody/generator` (diatonic only — chromatic
   setting forced to `none`), 1–2 bars of 4/4.
2. Spell the source melody: map each MIDI note to the source key's `scaleSpelling`
   letter (+ octave). Diatonic-only generation guarantees this is total.
3. Target:
   - *To a key* mode: pick a target major key from the full key table with ≤5
     accidentals, different from the source; the transposition interval = the smallest
     spelled interval from source tonic to target tonic, direction chosen to keep the
     melody inside the staff window (up or down, whichever fits; re-pick target if
     neither fits).
   - *By interval* mode: pick an enabled interval + direction; target key = source key
     tonic transposed by it. Re-pick if the target key exceeds 7 accidentals or isn't in
     the key table, or the result leaves the staff window.
4. Expected answer = per-note `transposeUp/Down(sourceSpelling, interval)`.
5. Output `{ clef, source: { keyId, notes, rhythm }, target: { keyId, vexKeySpec },
   promptText, expected: SpelledPitch[] }`. Prompt for semitone phrasing converts the
   interval to its semitone count ("up 2 semitones" for M2) — the *expected spelling* is
   still the interval's diatonic result (binding: semitone phrasing changes wording,
   never grading; the reveal names the interval either way, which is itself teaching).

## 4. Display & input

Binding layout — **source phrase on top, empty answer stave directly below it**, so the
original is always the reference point the user reads from while writing:

- **Source staff (top):** `TheoryStaffView` with the source key signature + the real
  rhythm rendered via `buildVexScore`. Read-only.
- **Answer staff (bottom):** `SlotStaffInput`, target key signature, slots at the
  source rhythm's beats. Rendered **directly beneath** the source staff inside one
  shared `.md-staff-frame` panel, nothing between them (the prompt text sits above in
  `.md-prompt` as usual). Page layout otherwise engine §8c verbatim — ♯/♭ + Backspace/
  Clear centered in `.md-palette` below the frame, Submit/Next in `.md-actions`.
- **Both staves render at the melodic-dictation staff's own geometry** — same
  `CANVAS_WIDTH`/viewBox, same responsive full-card-width CSS, same
  measures-per-row layout — so they occupy the same horizontal span and each bar of
  the answer sits **vertically below the same bar of the source** (bar counts are
  always equal). Same measure widths; exact per-note x-alignment inside a bar is not
  required, but bar-to-bar alignment is.

Accidental palette available for the redundant-accidental case only (pools are
diatonic, engine §10).

## 5. Unit tests

- Source spelling: generated melodies in each `MELODY_KEYS` major map to unique
  letter+acc spellings matching the key's scale.
- To-key: C→F melody expectation is every note down a P5/up a P4 as picked; target
  signature spec correct; source ≠ target always.
- By-interval: up-M2 from F major lands in G major with correct spellings (B♭→C etc.);
  target keys always within the table; direction fitting respected over 500 draws.
- Semitone phrasing: prompt says semitones, expected spellings identical to
  interval-name phrasing.

## 6. Acceptance criteria

- Live end-to-end in both modes: a fully correct answer scores correct; writing A♯
  where the F-major target expects B♭ grades wrong (spelling-exact even at equal MIDI),
  with the red correction voice showing B♭ at that slot.
- Diatonic note entered without arming an accidental in a sharp target key grades
  correct (signature normalization works).
- Rhythm-locked entry: slots accept pitches in any order; no duration UI appears.
- Layout: the source phrase renders above the answer stave, both spanning the same
  width as the melodic-dictation staff does in its card, with each answer bar directly
  below its source bar (screenshot check at desktop and mobile widths).
- Settings persist; score doesn't.
