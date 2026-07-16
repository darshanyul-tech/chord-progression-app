# Topic 13 — Sight Singing (`sight-singing`) — NEW (microphone)

**Status:** new build; third microphone topic. Category: Pitch & Melody. Theme: light.
**Depends on:** Chord Singing (Phase 20) having proven multi-tone sequential capture — including its **manual singer gate** (docs/05-topics/10 §8), which is still a user-only outstanding item. Do not start this topic until that gate has passed; it validates the exact capture loop this topic stretches further.
**Reuse mandate (D13/D15):** the entire `lib/pitch/` stack (`detect.ts`, `analysis.ts` tracker, `grading.ts`'s `gradeSungInterval`, `ROOT_RANGE_PRESETS`, ambient calibration) + `lib/audio/mic.ts` + `useMicReady` + the shared `PitchMeter` component; melody generation from `lib/melody/generator.ts` (`generateMelody`) and notation display from `lib/melody/vexscore.ts` (`buildVexScore`) — display-only, exactly as Melodic Dictation uses it, no new notation code. New logic framework-free in `src/lib/pitch/sightSinging.ts`, unit-tested.

## 1. Exercise

A short **notated melody is displayed** (VexFlow staff); the tonic chord plays for key orientation, then the starting note sounds. The user sings the melody **note by note at their own pace** — the tracker captures each sustained note in sequence (the Chord Singing loop, with the melody's notes as the target sequence and the staff as the progress display). After the last note the attempt is graded; 3 attempts, first-attempt-only scoring; reveal plays the melody. Privacy note as always: **audio never leaves the device**.

**Binding v1 scope decision — pitch only, no rhythm grading.** The user holds each note until captured; notated rhythms are visual context, not graded targets. Grading sung rhythm requires onset detection and a tempo-tracking model that the tracker doesn't have, and bolting it on would make wrong-pitch and wrong-time failures indistinguishable to the user. Rhythm-graded singing is a future topic, not a v1 stretch goal — say so in the UI help text so nobody files it as a bug.

## 2. Settings

| Setting | Control | Values / default |
|---|---|---|
| Key | select | reuse Melodic Dictation's key list; C major✓ + random-key toggle |
| Length | select | 1 measure✓ / 2 measures |
| Melodic motion | select | mostly steps✓ / mixed (reuse `MelodicMotion`; 'leapy' excluded v1 — leaps compound with singing error and make the gate unpassable) |
| Chromatic notes | select | none✓ / light |
| Vocal range | select | reuse `ROOT_RANGE_PRESETS` (auto✓ / male / female) — the melody generator's range is **clamped to the intersection** of its own range setting and this window |
| Tolerance | select | ±30¢ / ±50¢✓ / ±75¢ (`TOLERANCE_CENTS`) |
| Octave equivalence | toggle | on✓ — per note |
| Hold time | slider | 0.2–1.5 s, default 0.5 |
| Auto-advance | toggle | off✓ |

**Storage schema** (`eartrainer.v1.settings.sight-singing`):
`{ key, randomKey, measures, motion, chromatic, vocalRange, tolerance, octaveEquivalence, holdTimeSec, autoAdvance }`

## 3. Question generation (Tier-1, `lib/pitch/sightSinging.ts`)

1. Build a `MelodicDictationSettings` object from this topic's settings (fixed: treble clef, 4/4, quarter/eighth values only, no rests, no syncopation — rhythm is decoration here, keep it plain) and call `generateMelody`.
2. Flatten the result to an ordered MIDI sequence `targetMidis: number[]` (skip nothing — no rests were allowed).
3. Regenerate (bounded retries, then clamp-transpose by octaves) until every target sits inside the vocal-range window.
4. Output: `{ melody: GeneratedMelody (for the staff), targetMidis, tonicMidi, keyLabel }`.

Grading helper `gradeSungMelody(targetMidis, captures, opts)` — per-note `gradeSungInterval(0, targetMidi, captured, opts)` (root 0 + absolute target = absolute-pitch grading; the existing signature already supports this, add a comment rather than a wrapper type). Same shape as Chord Singing's `gradeArpeggio`; if the two end up identical, extract the shared helper to `lib/pitch/` — second-consumer rule applies to Tier-1 too.

## 4. Round flow (Tier-2, `src/topics/sight-singing/usePractice.ts`)

Mirrors Chord Singing's hook (ref twins, round token, `disarm()`, mic release on deactivate, ambient calibration):

1. **Present:** staff renders; tonic chord (1.4 s), gap, starting note alone (1.2 s). Playback fully stops before arming.
2. **Arm note 1:** tracker armed; `PitchMeter` centered on the current target; the staff highlights the active note (reuse `CURSOR_COLOR` conventions from vexscore).
3. **On capture:** grade; tick/cross the note on the staff (reuse `WRONG_COLOR`); arm the next. No early abort.
4. **After the last note:** all correct → attempt scores (first attempt only); otherwise per-note results shown on the staff, attempt consumed, re-present starting note and re-arm from note 1. Third failure → reveal (melody played on the sampler), scored incorrect.
5. Replay start note / Stop / New question transport; mic released on topic deactivate (Phase 17 convention).

## 5. UI

`src/topics/sight-singing/` — topic + Settings. Staff via the same `buildVexScore` host pattern as Melodic Dictation's display (read-only — none of the dictation input layer). Below it: `PitchMeter` while listening, attempt counter, feedback line. No new shared components expected; if the staff-host wrapper is extracted for a second consumer, that's a separate mechanical commit.

## 6. Exam contribution

**None in v1** — same deferral as both other singing topics.

## 7. Unit tests

- Builder: every `targetMidis` entry inside the vocal window across keys/ranges/motions (seeded, many trials); flattening preserves order and length; transposition fallback lands in-window; chromatic 'none' yields only in-key notes.
- `gradeSungMelody`: all-correct, one-wrong-note (index reported), octave equivalence on/off, signed cents.
- Settings mapping: the fixed dictation-settings fields (clef/meter/no-rests) are asserted so a melody-generator default change can't silently reintroduce rests.

## 8. Acceptance criteria

- A 1-measure C-major stepwise melody sung in tune grades correct end-to-end; one flat note grades exactly that note wrong with signed cents on the staff.
- Random key + range presets never produce an out-of-window target.
- Mic-denied guidance, privacy note, mic release on topic switch as in the other singing topics.
- Manual singer gate: 10 melodies sung, ≥9 graded as a human judge would — the same bar as Phases 16/20, and like theirs it is a user-only task recorded in the phase plan.
