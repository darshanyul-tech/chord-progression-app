# 14 — Theory Engine (shared written-theory infrastructure)

Binding design for everything the nine theory topics (`docs/15-theory-topics/01–09`)
share: the spelled-pitch math library, the full key table, the staff **input** components
for writing answers, the read-only display helpers, and the two answer/scoring frames.
Read this before any topic spec — every spec references contracts defined here.

**Placement:** all new framework-free logic lives in **`src/lib/written-theory/`**
(unit-tested, no React imports — two-tier protocol D15 applies to new code exactly as it
did to ported code). Shared theory UI components live in `src/components/`. The directory
is named `written-theory` (not `theory`) because `src/lib/theory.ts` already exists and a
sibling directory with the same stem would make `../theory` imports ambiguous to humans.

**Core principle — grading is symbolic, not aural.** Theory topics grade the *written*
answer: letter + accidental (+ octave where the staff pins it). C♯ ≠ D♭ everywhere in
this section, even though they are the same MIDI note. This is the defining difference
from the aural section (which grades MIDI-only) and the reason the engine below is built
on spelled pitches, not pitch classes.

---

## 1. `spelledPitch.ts` — spelled-pitch model and interval math

```ts
export type Accidental = '' | '#' | 'b' | '##' | 'bb';   // '' = natural
export interface SpelledPitch { letter: string; acc: Accidental; octave: number; }
```

- `spelledToMidi(p): number` — letter's natural pc (reuse the semantics of
  `lib/melody/theory.ts` `NATURAL_PC`, but do not import across: copy the 7-entry table
  with a comment; `written-theory` must not depend on `lib/melody`) + accidental offset
  (−2…+2) + octave. Octave convention matches the rest of the app (C4 = 60), and the
  octave is the **letter's** octave (B♯3 sounds like C4 but is octave 3 — same rule
  `lib/melody/theory.ts` documents for `NoteSpelling`).
- `INTERVALS` table: `{ id, label, number (1–8), semitones }` for
  P1, m2, M2, m3, M3, P4, A4, d5, P5, m6, M6, m7, M7, P8. (Compound intervals are
  backlog; the table shape must not preclude them.)
- `transposeUp(p, interval): SpelledPitch` / `transposeDown` — advance the letter by
  `number − 1` steps (with octave carry), then set the accidental so the semitone
  distance is exact. May legitimately produce `##`/`bb` — the math must be correct;
  *question pools* are what exclude double accidentals, never the math.
- `spellingsEqual(a, b)`, `spellingLabel(p)` (e.g. `F♯`, unicode accidentals for display;
  ASCII `#`/`b` stay the internal representation, consistent with the rest of the app).
- `parseSpelling('F#4')` for test convenience.

`lib/melody/theory.ts`'s `NoteSpelling` (`{letter, accidental: '#' | 'b', octave}` with
absent-field-means-natural) is what the staff input components emit; the adapter
`fromNoteSpelling(letter, accidental | undefined, octave): SpelledPitch` lives here and
is the only place the two shapes meet.

## 2. `keys.ts` — the full 30-key table

`MELODY_KEYS` (±4 accidentals, `lib/melody/theory.ts`) is too small for theory work.
New table, all 15 + 15 spellings:

```ts
export interface TheoryKey {
  id: string;            // 'C', 'F#', 'Cb', 'Am', 'A#m', 'Abm', …
  label: string;         // 'F♯ major', 'B♭ minor'
  mode: 'major' | 'minor';
  tonic: { letter: string; acc: Accidental };
  accidentalCount: number;      // 0–7
  sharps: boolean;              // false for flat keys and C/Am
  vexKeySpec: string;           // VexFlow key-signature spec ('C#', 'Bbm', …)
  relativeId: string;           // relative major ↔ minor link
}
```

- Majors: C, G, D, A, E, B, F♯, C♯ / F, B♭, E♭, A♭, D♭, G♭, C♭.
  Minors: Am, Em, Bm, F♯m, C♯m, G♯m, D♯m, A♯m / Dm, Gm, Cm, Fm, B♭m, E♭m, A♭m.
- Every `vexKeySpec` must be verified in unit tests — binding approach: assert all 30
  ids against VexFlow 5's exported `keySignatures` table (deterministic, no DOM), plus
  one jsdom render smoke test each for one sharp key and one flat key.
- Helpers: `theoryKeyById(id)`, `keysWithin(maxAccidentals, mode | 'both')`,
  `scaleSpelling(key): SpelledPitch-like[7]` (octave-free letter+acc for the 7 degrees;
  natural minor for minor keys), `degreeOfLetter(key, letter, acc): 1–7 | null`.
- `MELODY_KEYS` is untouched; melodic dictation keeps its own table. Where a theory topic
  needs a `KeyDef` for the melody generator (Transposition), the mapping helper
  `toMelodyKey(theoryKey)` returns the matching `MELODY_KEYS` entry or null.

## 3. `scaleSpelling.ts` — scale types as letter-degree patterns

Scale types for **writing** (distinct from the aural recognition table — that one is
interval-only and spelling-blind):

```ts
export interface WrittenScaleType {
  id: string; label: string;
  // 7 entries: semitone offset + letter step for each degree above the tonic —
  // spelling falls out automatically (each degree uses the next letter).
  degrees: { semitones: number }[];   // letters always advance by one per degree
}
```

- v1 types: `major`, `naturalMinor`, `harmonicMinor`, `melodicMinor` (ascending form),
  plus the 7 major modes (`ionian`… `locrian`, ids matching
  `lib/recognition/scales.ts` so labels stay consistent).
- `spellWrittenScale(tonic: SpelledPitch, type): SpelledPitch[8]` — 8 notes including the
  octave tonic; each successive letter is the next letter, accidental computed from the
  semitone target (via §1 math).
- `scaleNeedsDoubleAccidentals(tonic, type): boolean` — the pool filter every writing
  topic uses (e.g. G♯ harmonic minor's F𝄪 → that (tonic, type) pair is excluded from v1
  question pools).
- Melodic minor **descending** = natural-minor spellings; the scale-writing spec handles
  this at the topic level, not here.

## 4. `chordSpelling.ts` — chord qualities and inversions

```ts
export interface WrittenChordQuality {
  id: string; label: string;
  intervals: { number: number; semitones: number }[]; // stacked above the root
}
```

- Triads: `maj [M3,P5]`, `min [m3,P5]`, `dim [m3,d5]`, `aug [M3,A5]`.
  Sevenths: `maj7`, `min7`, `dom7`, `halfDim7 (m7♭5)`, `dim7`.
- `spellChord(root: SpelledPitch, quality, inversion: 0–3): SpelledPitch[]` — closed
  position, bottom-to-top, bass = the inversion's chord member, upper tones in the
  nearest octaves above (strictly ascending).
- `chordNeedsDoubleAccidentals(root, quality)` — pool filter (excludes e.g. D♯ major
  triad's F𝄪).

## 5. `degrees.ts` — scale-degree naming

`DEGREE_NAMES(mode): string[7]` — tonic, supertonic, mediant, subdominant, dominant,
submediant, then **leading note** in major / **subtonic** in natural minor (the ♭7 is a
whole tone below the tonic — the label must be mode-aware; this is a deliberate teaching
detail, unit-tested).

## 6. Clef extension (touches `lib/melody`, small and additive)

Theory reading benefits from C clefs. Extend `lib/melody/theory.ts`:

- `Clef` union gains `'alto' | 'tenor'`; `CLEF_LINE_SHIFT` gains `alto: 3, tenor: 4`
  (middle C on the middle line / 4th line — verify against VexFlow's `keyProperties`
  line convention in a test, same as treble/bass were).
- `CLEF_REFERENCE_LOW` gains sensible anchors (alto: 53 = F3, tenor: 48 = C3) — only used
  if a generator ever runs on a C clef; melodic dictation's settings UI continues to
  offer treble/bass only (no behavior change for the aural section).
- `lib/melody/vexscore.ts` passes the clef through to VexFlow unchanged (VexFlow supports
  `alto`/`tenor` natively); one render test per new clef.

## 7. Read-only staff displays (Tier-2, shared)

- **`TheoryStaffView`** (`src/components/theory/TheoryStaffView.tsx`) — read-only
  VexFlow render of a short sequence of whole notes (or a single note / stacked chord)
  with optional key signature, using `buildVexScore` as Sight Singing does
  (display-only reuse; no input wiring). Props: clef, optional `vexKeySpec`, notes as
  spelled pitches (always explicit — §8a rule).
- **Staff-display options** (small additive flags on the `buildVexScore` path, needed
  by every theory staff): render **without a time signature** (today `buildVexScore`
  unconditionally calls `addTimeSignature` on measure 0), and render an n-note
  whole-note sequence as **one wide measure with no internal barlines** (model it as a
  single measure whose `measureBeats` = 4 × note count — `drawMeasureVoice` already
  formats by proportional beat position, so this is a modeling convention plus the
  no-time-signature flag, not new layout code). The `key` prop accepts any
  `vexKeySpec` string from the theory key table, not just `MELODY_KEYS` entries —
  legal because theory notes always carry explicit spellings (§8a), so the
  `MELODY_KEYS`-bound spelling table is never consulted.
- **`KeySignatureView`** — a stave with clef + key signature and nothing else (no time
  signature, no notes). Trivial direct VexFlow usage (Stave + `addKeySignature`); must
  render the empty (C/Am) signature without visual glitches.

## 8. Staff input components (Tier-2, shared — the writing topics' answer surface)

Both components are extracted-and-adapted from Melodic Dictation's input layer
(`VexStaffHost.tsx` + `lib/notation/placement.ts` geometry). **Do not fork the geometry
code:** hit-testing (click → staff line), the hover ghost ("render the ghost as a real
note"), and the armed-accidental convention are reused; what differs is the placement
model. Extract shared pieces from `VexStaffHost` only where reuse demands it —
mechanical extraction commits, no refactors of melodic dictation behavior.

### 8a. `SlotStaffInput` — fixed slots, click assigns pitch

Used by: Interval Writing (1 slot), Scale Writing (7 slots), Transposition (n slots,
rhythm locked to the source melody).

- The staff shows a fixed sequence of **slots** at fixed x-positions: pre-filled slots
  render as normal notes (e.g. the given tonic); empty slots render as muted grey
  placeholder noteheads on the middle line (`--muted`, distinct from the hover ghost).
- Rhythm is **not** entered: each slot has a fixed duration (whole notes everywhere
  except Transposition, which uses the source melody's durations). No duration palette,
  no rests, no ties.
- Click behavior: clicking a staff line/space assigns that pitch to the **x-nearest
  slot** (so users can fill slots in any order and correct any slot by clicking at its
  x-position with a new pitch). The hover ghost previews pitch + target slot.
- Accidentals: the melodic-dictation armed-palette convention (Sharp/Flat toggles,
  `NotePalette` accidental buttons reused; no Natural button — on an open staff,
  unarmed = natural; on a keyed staff see §10 normalization). Armed accidental applies
  to the clicked letter exactly as in melodic dictation (spelling stored, never
  collapsed to pitch class).
- **Every placement stores an explicit `NoteSpelling`** — unlike melodic dictation,
  where unarmed placements store none and rendering derives the spelling from
  `lib/melody/spelling.ts`'s per-key table. That table's `signatureFor` is hardcoded to
  the 14 `MELODY_KEYS` ids, and theory grading is spelling-based, so theory inputs
  never rely on it: at placement time the component computes the spelling itself
  (letter+octave from the clicked line, accidental = armed one, else the theory key's
  signature accidental for that letter, else natural) and stores it on the note. Both
  rendering (`spelledToVexKey` path, already supported) and grading then read only
  stored spellings.
- Emits `(slotIndex, NoteSpelling)`; owns no grading.
- Extraction notes (behaviors in today's host that are melodic-specific and must become
  props, not be copied): the pitch clamp window (`placeNoteAt` clamps to
  `resolveRangeWindow(key, clef, settings.range)` — theory passes its own window,
  staff ± 2 ledger lines); rest gap-filling (`fillGaps`/`defaultRestMeasure` — slot
  models have no rests and skip it entirely); and preview-on-place audio (off for
  theory; the specced "Hear it" toggles play only after submit).
- Keyboard: not in v1 (mouse/touch only — melodic dictation's shortcuts are
  duration-centric and don't map; noted in backlog).

### 8b. `ChordStaffInput` — one column, click toggles chord tones

Used by: Chord Writing.

- A single stave with one chord column (whole-note stack). Clicking a line/space **adds**
  that pitch (with armed accidental) to the stack; clicking an existing chord tone
  **removes** it. Max stack size passed as a prop (3 or 4). Hover ghost previews
  add/remove.
- Renders via one VexFlow `StaveNote` with multiple keys (this is the one place
  `buildVexScore`'s one-key-per-note shape doesn't fit — a small dedicated builder
  `buildChordStack` lives in **`src/lib/written-theory/chordStack.ts`** (binding;
  VexFlow-in-`lib` follows the `lib/melody/vexscore.ts` / `lib/rhythm-staff/render.ts`
  precedent), unit-tested for accidental placement).
- Emits the current stack (bottom-to-top `NoteSpelling[]`).

### 8c. Writing-topic page layout (binding — mirror melodic dictation exactly)

The staff-writing topics reproduce Melodic Dictation's card structure and **CSS classes
verbatim**, so every control sits in exactly the place aural users already know, with
the same centering:

- **Top card:** the `.buttons` row (`New question`, `Reset score` — no audio transport
  buttons, since nothing plays) followed by `SessionScoreLine`, exactly as melodic
  dictation's first card lays them out.
- **Practice card** (`md-card-wrap` structure): `.md-header` > `.md-prompt` prompt text
  at the top; the staff (or both stacked staves, for Transposition/Meter Transposition
  — one shared frame, source above answer) inside a single `.md-staff-frame` bordered
  panel; then `.md-bottom-bar` below the staff; then `.md-feedback-strip`.
- **Palette position and centering:** the topic's buttons live in `.md-palette` inside
  the bottom bar — the existing CSS flex-centers it (`justify-content: center`, wrapping
  on narrow screens), which is what keeps the icons horizontally centered under the
  staff. Theory palettes contain only the buttons that apply: Sharp/Flat (`md-mod-btn`,
  same glyphs/classes/sizes as melodic dictation's), then Backspace and Clear — same
  order and same separator convention. Rhythm-locked input means **no duration, rest,
  dot, or tie buttons**; absent buttons are omitted, never disabled placeholders, and
  the remaining ones stay centered as the flexbox already does.
- **Actions:** `Submit →` (and `Next →` after submit) in `.md-actions`, right of the
  palette — identical placement and classes.
- Meter Transposition mirrors **Rhythm Dictation's** bottom bar the same way (its
  palette component and classes, restricted to the target-side durations per spec 09
  §5), palette centered, Submit/Next in the same position.
- The per-topic "Hear it" button (where specced) renders in `.md-actions` beside
  Next — it must not disturb the palette row.

Choice topics (§9a) need no special rule: they reuse the recognition topics' existing
card/grid components unchanged, which already center the choice grids exactly as the
aural section does.

## 9. Answer frames — the two interaction contracts

### 9a. Choice topics (Note Reading, Key Signatures, Scale Degrees, Scale Home Keys)

The existing recognition frame, verbatim: `ChoiceGrid`/`GroupedChoiceGrid`, up to
`RECOGNITION_MAX_GUESSES` (3) attempts, **first-guess-only scoring**, `StatusLine`
feedback, reveal text, optional auto-advance (`RECOGNITION_AUTO_ADVANCE_MS`),
`SessionScoreLine` + reset, scores via `useScoresStore` keyed by topic id. The only
difference from aural recognition topics: there is nothing to play, so the transport row
is absent — the question display + a `Next` button replace it (plus per-topic optional
playback affordances where a spec says so).

### 9b. Writing topics (Interval/Scale/Chord Writing, Transposition, Meter Transposition)

Binding submit contract — **identical to the dictation topics' proven contract**
(melodic dictation's `checkAnswer` + vexscore reveal path, verified against the code
2026-07-19), so the theory staves behave exactly like the existing ones:

- **One submit per question.** Submit grades the answer, records the attempt
  (`useScoresStore.recordAttempt` — correct only if fully correct), and locks the
  question (`hasSubmitted`; input and hover ghost disabled — the existing host already
  does both) until `Next`.
- **Incorrect reveal = red second voice**, exactly as melodic dictation draws it: the
  expected notes render as a second voice in `WRONG_COLOR` (#b3261e) overlaid on the
  same staff via `drawMeasureVoice`'s existing `style` option; the user's own notes
  stay black. Theory expected-answers are built as `PitchedNote`s **with explicit
  `spelling` set**, which the existing adapter already renders via `spelledToVexKey` —
  no render changes needed. There is **no separate Reveal button and no retry loop**
  (neither exists anywhere in the current framework).
- Status line on incorrect reports how close the answer was ("2 of 8 notes correct" —
  computed by the topic's grading lib), the analogue of melodic dictation's
  "Measure n differs" message.
- Auto-advance applies only after a correct submit (toggle, default off).
- An **empty or incomplete answer cannot be submitted** (Submit disabled until every
  slot/required tone is filled — the analogue of melodic dictation's `allMeasuresFull`
  gate) — partial answers are never graded against absent notes.

## 10. Grading normalization (binding, applies to every writing topic)

- Comparison is `spellingsEqual` on letter + accidental + octave (octave matters —
  the staff pins it; specs state the octave rule where the bass octave is free).
- On a staff **with a key signature** (Transposition only): a note's *effective*
  accidental = the armed accidental if the user armed one, else the signature's
  accidental for that letter. Consequence: writing F♯ in D major without arming Sharp is
  correct (the signature supplies it), and *redundantly* arming Sharp on that F is also
  correct (a harmless courtesy accidental). Arming Natural-equivalent (i.e. no natural
  button exists; the user cannot cancel a signature accidental in v1) — question pools
  for keyed staves therefore contain **diatonic-to-target notes only**. Chromatic
  transposition is backlog.
- On open staves (everything else): unarmed = natural, and pools exclude answers needing
  double accidentals (§3/§4 filters).

## 11. Settings, persistence, registry, tests

- Each topic gets a persisted settings store via `createPersistedSettingsStore`, storage
  key `eartrainer.v1.settings.<topic-id>`, schema in its spec §2. Scores are never
  persisted (existing rule).
- Question generation: Tier-1 builders in `src/lib/written-theory/<topic>.ts`, all
  randomness through `lib/theory.ts`'s `random()`/`pick()` (seedable), returning a plain
  question object the React layer never post-processes.
- Registry: topics flip `placeholder → active` per the implementation plan; all are
  `section: 'theory'`, theme light, no `examTypes`.
- Coverage: per-file ≥90% on everything in `src/lib/written-theory/` (project gate).
  Interval math, all 30 key spellings, every scale/chord spelling table entry, and both
  pool filters (double-accidental exclusion) must have direct unit tests — this library
  is the correctness heart of the whole section; a spelling bug here silently mis-teaches
  theory.
