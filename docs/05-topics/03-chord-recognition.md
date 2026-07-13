# Topic 03 — Chord Recognition (`chord-recognition`)

**Status:** carry forward, zero regressions. Category: Chords.
**Porting source:** all `chord*` / `Chord*` recognition functions (`CHORD_RECOGNITION_*`, `chordEl`, `chordState`, `wireChordRecognition`, …) and `#chordView` markup in the canonical legacy file. (Do not confuse with the progression trainer's chord machinery.)

## 1. Exercise

A single chord is played — block or arpeggiated per settings — and the user identifies its quality/type from answer buttons. Shared recognition pattern: ≤3 attempts, first guess scored, reveal, optional auto-advance.

## 2. Content inventory (exact, from legacy tables — 32 types, 5 groups)

| Group | Types (id — label; * = default-enabled) |
|---|---|
| Triads | maj — Major triad*, m — Minor triad*, aug, dim, sus4 |
| Sixths | maj6, m6, maj69 — Major 6/9, m69 |
| Sevenths | maj7*, m7*, 7 — Dominant 7*, dim7, mMaj7 — Minor–major 7, m7b5 — Minor 7 ♭5 |
| Altered & sus dominants | 7sus4, maj7s5, maj7b5, 7s5, 7b5, 7s9, 7b9, 7alt, 7sus4b9 |
| Ninths & extensions | maj9, m9, 9, 9sus4, majadd9, madd9, m9b5, 13 |

Interval recipes (`CHORD_RECOGNITION_RECIPES`, semitone stacks) port verbatim. Note the spec asks for sus2: **sus2 is not in the legacy inventory — add it** (`sus2: [0, 2, 7]`, group Triads, default off). This is the only inventory addition; it is an expansion, not a regression risk.

## 3. Settings

| Setting | Control | Values / default |
|---|---|---|
| Enabled chord types | grouped checkboxes + per-group toggle-all (`renderChordTypeSettings`) | table above |
| Playback style | select `chordPlaybackStyle` | block / arpeggiated (legacy default) |
| Block hold length | slider `chordHoldLen` (visible in block mode) | legacy values |
| Arp note length | slider `chordArpNoteLen` (arp mode) | legacy values |
| Arp gap | slider `chordArpGap` (arp mode) | legacy values |
| Auto-advance | checkbox `chordAutoAdvance` | legacy default |

**Storage schema** (`…settings.chord-recognition`): `{ enabledTypes: string[], playbackStyle, holdLen, arpNoteLen, arpGap, autoAdvance }`

## 4. Generation & playback

Root picked within `CHORD_ROOT_MIDI_MIN/MAX`; voicing built by `buildChordRecognitionVoicing` (close position off the recipe). Block = simultaneous trigger with hold length; arpeggio = sequential with note length + gap. Standard cancellation.

## 5. Exam contribution

Exam type `chordRecognition`; exam answer choices grouped per `buildChordExamChoiceGrouped` — port verbatim.

## 6. Acceptance criteria

- All 33 types (32 legacy + sus2) selectable; timing controls swap visibility with playback style (legacy `syncChordPlaybackSettingsUi`).
- Block vs arpeggiated audibly distinct and timed per sliders.
- First-guess scoring, persistence, transport parity per Topic 01 checklist.
- sus2 addition verified audible as 0-2-7.
