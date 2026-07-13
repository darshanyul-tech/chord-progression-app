# Topic 02 — Scales (`scales`)

**Status:** carry forward, zero regressions. Category: Intervals & Scales.
**Porting source:** all `scale*` / `Scale*` functions and `#scaleView` markup in the canonical legacy file.

## 1. Exercise

A scale is played as a run of notes ascending (optionally also descending); the user identifies the scale/mode from answer buttons. First-guess scoring, ≤3 attempts, reveal, optional auto-advance — the shared recognition pattern.

## 2. Content inventory (exact, from legacy `SCALE_RECOGNITION_GROUPS` / `SCALE_RECOGNITION_TYPES`)

| Group | Scales (id — label) |
|---|---|
| Major modes | ionian — Ionian (major)*, dorian — Dorian*, phrygian, lydian, mixolydian*, aeolian*, locrian |
| Melodic minor modes | locrianSharp2 — Locrian ♯2, dorianFlat2 — Dorian ♭2, altered — Altered scale, lydianDominant — Lydian dominant, mixolydianFlat6 — Mixolydian ♭6 |
| Minor scales | harmonicMinor, jazzMinor |
| 5 & 6 note scales | majPent, minPent, blues |
| 8 note scales | majBebop — Major bebop, domBebop — Dominant bebop, dom8 — Dominant 8-note, diminished — Diminished (whole–half) |

`*` = enabled by default. Interval formulas are in the legacy table — port verbatim. (This satisfies the spec's major modes / minor forms / pentatonic / symmetric / jazz-scale groups; natural & melodic minor are covered as Aeolian & Jazz minor.)

## 3. Settings

| Setting | Control | Values / default |
|---|---|---|
| Enabled scales | grouped checkbox panel with per-group toggle-all (`renderScaleTypeSettings`, `createToggleAllButton`) | table above |
| Descending playback | checkbox `scaleDescend` | off (ascending only) by default |
| Note length | slider `scaleNoteLen` | legacy values |
| Note gap | slider `scaleNoteGap` | legacy values |
| Auto-advance | checkbox `scaleAutoAdvance` | legacy default |

**Storage schema** (`…settings.scales`): `{ enabledScales: string[], descend, noteLen, noteGap, autoAdvance }`

## 4. Generation & playback

- Root varies per question within the legacy playable range (`pickScaleRootMidi`) — never a fixed tonic.
- `scaleIntervalsWithOctave` + `buildScalePlaybackMidis` produce the run (up, plus down when enabled); standard cancellation pattern.

## 5. Exam contribution

Exam type `scaleRecognition`, choices grouped as in `buildScaleExamChoiceGrouped` — port verbatim.

## 6. Acceptance criteria

- Group toggle-all buttons work; at least one scale must remain enabled (legacy guard).
- Descending option audibly appends the descent.
- Random roots: ten consecutive questions with one scale enabled use ≥2 distinct roots.
- First-guess scoring, persistence, and transport parity as per Topic 01 checklist.
