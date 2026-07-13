# Topic 01 — Interval Recognition (`interval-recognition`)

**Status:** carry forward, zero regressions. Category: Intervals & Scales.
**Porting source:** all `interval*` / `Interval*` functions and the `#intervalView` markup in `legacy/jazz-progression-trainer-rhythm.html`. The legacy behavior is the spec; this doc enumerates it for verification and defines the storage schema.

## 1. Exercise

Two pitches played in sequence (ascending or descending); the user identifies the interval from answer buttons. Up to 3 attempts (`RECOGNITION_MAX_GUESSES = 3`); only the first attempt counts toward the session score. Reveal shows the correct interval; optional auto-advance (`RECOGNITION_AUTO_ADVANCE_MS`) starts the next question after reveal.

## 2. Content inventory (exact, from legacy `INTERVAL_TYPES`)

m2 (1), M2 (2), m3 (3), M3 (4), P4 (5), TT (6), P5 (7), m6 (8), M6 (9), m7 (10), M7 (11), P8 (12), m9 (13), M9 (14) — id (semitones).

## 3. Settings (Settings card, ported controls)

| Setting | Control | Values / default |
|---|---|---|
| Direction | select `intervalDirection` | ascending / descending / both (session-level) |
| Included intervals | per-interval checkbox matrix (`renderIntervalSettingsMatrix`) | each of the 14 types on/off; legacy defaults |
| Note length | slider `intervalNoteLen` | legacy range/default (seconds) |
| Gap between notes | slider `intervalGap` | legacy range/default (seconds) |
| Auto-advance | checkbox `intervalAutoAdvance` | off by default (legacy) |

**Storage schema** (`eartrainer.v1.settings.interval-recognition`):
`{ direction, enabledIntervals: string[], noteLen, gapLen, autoAdvance }`

## 4. Generation & playback

- Root MIDI chosen uniformly within `RECOGNITION_ROOT_MIDI_MIN/MAX` so the top note stays ≤ `RECOGNITION_MAX_TOP_MIDI` (port constants verbatim).
- Direction resolved per question when "both".
- Playback = two sampler notes with configured length/gap (`intervalPlaybackNotes`, `playIntervalQuestion`), replay/stop always available, standard cancellation pattern.

## 5. Transport / feedback / score

Standard recognition pattern (shared with chord/scale topics): `Initialize audio` → `Play interval` → `Replay` → `Stop` → answer buttons → `Next`. Wrong first guess marks the question incorrect but the user may keep guessing until correct or attempts exhausted; correct answer highlighted at reveal. Session score `correct/total` + reset button.

## 6. Exam contribution

Registers exam type `intervalRecognition` exactly as legacy (`buildIntervalExamQuestion`), using the shared recognition exam schema (count/reps/spacing) — see `06-exam-mode.md`.

## 7. Acceptance criteria

- All 14 interval types selectable; disabling all but one always yields that interval.
- Direction setting respected in playback order.
- First-guess-only scoring verified (guess wrong then right → total+1, correct+0).
- Settings persist across a full page reload; score does not.
- Behavior parity spot-check against the legacy file for: auto-advance timing, replay during playback, stop mid-question.
