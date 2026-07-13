# Topic 07 — Melodic Dictation (`melodic-dictation`) — NEW

**Status:** new build; the largest new work item. Category: Pitch & Melody. Theme: light.
**Reuse mandate (D13):** rhythm skeletons come from the rhythm-dictation generator (`lib/rhythm/generator.ts`); staff **rendering via VexFlow 5** with our custom input overlay (`04-notation-engine.md` Part B); playback via the shared sampler.

## 1. Exercise

A short single-line melody plays (piano, after a count-in with key orientation — see §4); the user transcribes **pitch and rhythm** onto a 5-line staff with clef and key signature displayed. Whole-exercise grading (like rhythm dictation): every note's onset, duration, and pitch must match. Mismatch reveals the correct melody in a contrasting color. Session score `correct/total`.

## 2. Settings

| Setting | Control | Values / default |
|---|---|---|
| Clef | select | treble✓ / bass / random per question |
| Key | select | majors C✓, G, D, A, E, F, B♭, E♭, A♭ + minors Am, Em, Dm, Gm, Cm (key signature range ±4 accidentals) |
| Random key | toggle | off; when on, key select disabled and a key from the list is picked per question |
| Range | select | narrow (one octave from tonic) ✓ / medium (a 10th) / wide (two octaves, forces ledger lines) — anchored per clef: treble tonic nearest C4–B4, bass tonic nearest C3–B3 |
| Chromatic notes | select | none✓ / light (~1 per 4 bars) / moderate (~1 per bar) |
| Time signatures | checkboxes | 2/4✓ 3/4✓ 4/4✓ 6/8 (subset of rhythm engine's list — melodic dictation stays in common metres for v1) |
| Note values | checkboxes | Half✓ Quarter✓ Eighth✓ Dotted quarter✓, Whole, Sixteenth, Dotted eighth |
| Rests | select | none✓ / light / moderate (reuses rhythm engine's rest machinery) |
| Syncopation | select | off✓ / light / moderate |
| Length | select | 1 / 2✓ / 4 measures |
| Tempo | slider | 40–160, default 76 |
| Melodic motion | select | mostly steps✓ / mixed / leapy (see §3 weights) |

**Storage schema** (`…settings.melodic-dictation`): `{ clef, key, randomKey, range, chromatic, signatures, durations, rests, syncopation, measures, tempo, motion }`

## 3. Melody generation (deterministic algorithm — implement exactly)

1. Resolve clef, key, time signature, range window `[lowMidi, highMidi]` from settings.
2. Generate the rhythm skeleton with the rhythm-dictation generator (enabled durations/rests/syncopation, triplets always off for v1).
3. Build the scale-degree pool: diatonic scale of the key (natural minor for minor keys) restricted to the range window.
4. Assign pitches to non-rest onsets by constrained random walk:
   - First note: tonic, mediant, or dominant (weighted 3:1:2), nearest instance to the middle of the range.
   - Interval choice per step, in scale degrees, by motion setting — mostly steps: {±1: 0.60, ±2: 0.25, ±3: 0.10, ±4…±5: 0.05}; mixed: {0.40, 0.30, 0.18, 0.12}; leapy: {0.25, 0.25, 0.25, 0.25}. Direction reverses when within 2 degrees of a range edge; after any leap ≥ ±3 degrees, the next move must be a step in the opposite direction (classic recovery rule).
   - Repeated notes: allow with probability 0.08 in place of a drawn interval.
   - Last note: force scale degree 1̂, 3̂, or 5̂ (nearest), with 1̂ weight 2× — melodies end restfully.
5. Chromatic pass (if enabled): pick N random non-first, non-last notes (N from the chromatic setting) and alter ±1 semitone toward the next note (creating a passing/neighbor chromatic tone), respelled via `lib/melody/spelling.ts` (notation doc B3). Never alter two consecutive notes.
6. Result: `PitchedNote[]` per measure; regenerate (max 5 tries) if any pitch left the range window (safety net; the walk shouldn't allow it).

## 4. Playback

- Count-in: metronome clicks (one full bar, meter-aware) **preceded by a key orientation**: tonic chord (I or i triad, 1.2 s) — dictation without tonal grounding is a different exercise. Both are always on in v1 (no setting).
- Melody notes on the shared piano sampler at the settings tempo; rests are silent gaps. Standard cancellation pattern; Replay replays identically; Stop halts.

## 5. Entry & UI

- Standard three-card layout, light theme. Practice card contains the VexFlow staff (`VexStaffHost` + transparent input overlay per notation doc B5), capacity hint, and the palette: duration buttons (as rhythm dictation, minus triplets) + rest/dot/backspace/clear + **accidental modifiers ♯ ♭ (armed toggles, mutually exclusive)**.
- Two-axis snapped click placement (x → beat grid, y → stave line/space via stave geometry), ArrowUp/ArrowDown semitone nudge of last note, keyboard parity with rhythm dictation (1–8/R/D/Backspace/Esc, plus `S`=♯, `F`=♭ arm toggles).
- Submit enabled when all measures rhythmically full (same rule as rhythm dictation — pitches are wherever the user placed them).

## 6. Grading & reveal

`pitchedMeasuresEqual` (notation doc B6): tick-exact onsets/durations/rests + MIDI-equal pitches (enharmonics accepted); grading compares our note model, never VexFlow objects. All-or-nothing per exercise. Reveal renders the correct melody as a contrasting-color second voice (notation doc B4); feedback strip states the first differing measure ("Measure 2 differs") to guide learning.

## 7. Exam contribution

Registers dictation exam type `melodicDictation`: limited replays, same staff UI, matched/not-matched reporting (06-exam doc).

## 8. Unit tests

- Walk invariants (1,000 melodies per motion setting): all pitches in range; no two consecutive chromatic notes; leap-recovery rule holds; final note ∈ {1̂,3̂,5̂}.
- Chromatic counts match setting bands.
- Grading: transposed melody ≠ match; enharmonic respelling = match; single-duration difference ≠ match.

## 9. Acceptance criteria

- Treble and bass clefs render with correct key signatures for all 14 keys; wide range shows correct ledger lines.
- A generated melody, dictated back exactly, grades correct; any single wrong pitch grades incorrect with reveal.
- Playback matches notation (spot-check vs. reveal).
- Settings persist; keyboard entry usable end-to-end without mouse (except staff clicks).
