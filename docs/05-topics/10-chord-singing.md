# Topic 10 — Chord Singing (`chord-singing`) — NEW (microphone)

**Status:** new build; second microphone topic. Category: Chords. Theme: light.
**Reuse mandate (D13/D15):** the entire `lib/pitch/` stack from Interval Singing — `detect.ts` (MPM detector), `analysis.ts` (sustained-pitch tracker), `grading.ts` (`gradeSungInterval` works per-tone unchanged), `ROOT_RANGE_PRESETS` — plus `lib/audio/mic.ts` and the `useMicReady` hook. Chord recipes from `lib/recognition/chords.ts`. This reuse was the explicit design intent recorded in 09-improvement-plan.md §16.4 ("the same lib/pitch stack powers Chord Singing and Sight Singing"). New logic framework-free in `src/lib/pitch/chordSinging.ts`, unit-tested.

## 1. Exercise

A chord is presented; the user **sings its tones one at a time, in order** (arpeggiating — one voice can't sing a chord). The tracker captures each sustained tone in sequence with a live pitch meter; after the last tone, the whole arpeggio is graded (every tone within tolerance = correct). Whole-exercise grading like the dictation topics; 3 attempts at the full arpeggio, first-attempt-only scoring; reveal plays the chord tones sequentially then as a block. Same privacy note as Interval Singing: **audio never leaves the device**.

Two prompt modes (setting):
- **Echo (default):** the full chord plays (block, then arpeggiated once slowly), root named. Trains audiation + reproduction.
- **Construction (harder):** only the root plays; the prompt names the quality ("sing a minor 7 chord up from this root"). Trains chord spelling by ear — the singing analogue of chord recognition.

## 2. Settings

| Setting | Control | Values / default |
|---|---|---|
| Chord pool | grouped checkboxes | v1 pool restricted to singable qualities: triads (maj✓, m✓, dim, aug, sus4, sus2) + four-note (maj7, m7, 7, m7♭5, dim7, maj6, m6). Extended/altered qualities excluded v1 (5–6 tones exceeds practical breath/attention span) |
| Prompt mode | select | echo✓ / construction |
| Direction | select | up✓ / down / both (per question) — "down" sings root first then descends 5th→3rd? No: down = highest tone first, descending to the root; tone *targets* are the same set |
| Root range | select | reuse `ROOT_RANGE_PRESETS` (auto✓ / male / female) — clamp so root **and highest chord tone** fit the window (same both-ends clamp as Interval Singing's question builder) |
| Tolerance | select | ±30¢ strict / ±50¢✓ / ±75¢ relaxed (reuse `TOLERANCE_CENTS`) |
| Octave equivalence | toggle | on✓ — applied per tone |
| Hold time | slider | 0.2–1.5 s, default 0.5 (reuse tracker option) |
| Auto-advance | toggle | off✓ |

**Storage schema** (`eartrainer.v1.settings.chord-singing`):
`{ enabledTypes: string[], promptMode, direction, rootRange, tolerance, octaveEquivalence, holdTimeSec, autoAdvance }`

## 3. Question generation (Tier-1, `lib/pitch/chordSinging.ts`)

1. Pick an enabled quality; look up its recipe in `CHORD_RECOGNITION_RECIPES`, **filtered to v1's singable subset** (assert at module load that every allowed id has ≤4 recipe tones).
2. Target tone sequence = recipe offsets from the root, ordered ascending (direction "down" reverses it). E.g. m7 up: `[0, 3, 7, 10]`.
3. Root selection: uniform in the range window such that root + max(recipe) stays inside it; fall back to the window's low end if the quality can't fit (same convention as `buildSingingQuestion`).
4. Output: `{ rootMidi, qualityId, qualityLabel, toneOffsets: number[], promptMode }`.

Seedable randomness.

## 4. Round flow (Tier-2, `src/topics/chord-singing/usePractice.ts`)

Mirrors Interval Singing's hook shape (ref-twin pattern, round token, `disarm()`):

1. **Present:** echo mode — block chord (1.4 s), short gap, slow arpeggio (0.6 s/tone), root re-sounded alone; construction mode — root alone (1.2 s). Playback fully stops before arming (root-bleed mitigation, §16.4 of the improvement plan).
2. **Arm tone 1:** tracker armed with the topic's hold time; live pitch meter centered on the current target tone; UI shows progress ("Tone 2 of 4 — the third").
3. **On capture:** grade that tone via `gradeSungInterval(rootMidi, toneOffsets[i], capturedMidi, {tolerance, octaveEquivalence})`; store the result; brief per-tone tick/cross on the progress strip; reset the tracker and arm the next tone. No early abort — the user completes all tones even after a miss (stopping mid-arpeggio is more frustrating than finishing).
4. **After the last tone:** all correct → attempt correct (first attempt scores); any wrong → show per-tone results ("Root ✓ · 3rd ✓ · 5th ✗ 62¢ flat · 7th ✓"), consume an attempt, re-arm from tone 1 (root replayed first). Third failure → reveal (slow arpeggio + block), score as incorrect.
5. Replay root / Stop / New question transport as Interval Singing; mic released on topic deactivate (Phase 17 convention).

## 5. UI

`src/topics/chord-singing/` — `ChordSingingTopic.tsx` + `Settings.tsx`. Reuse the `PitchMeter` from Interval Singing — **extract it to `src/components/PitchMeter.tsx` as part of this build** (second consumer = extraction time, same rule as `NotePalette`/`IntervalMatrix`). New: a tone-progress strip (one chip per chord tone, states pending/active/✓/✗). No notation engine needed.

## 6. Exam contribution

**None in v1** — same rationale and deferral note as Interval Singing (singing under exam timers is a separate design problem).

## 7. Unit tests

- Question builder: tone sequences match recipes for every allowed quality; direction reversal; root+top clamp honored across all qualities and presets; null when pool empty.
- Round-grading logic (pure helper, e.g. `gradeArpeggio(targets, captures, opts)`): all-correct, one-wrong-tone, octave-shifted tones with equivalence on/off, per-tone cents reporting.
- Singable-subset assertion: every enabled-pool id has ≤4 tones.

## 8. Acceptance criteria

- Echo mode with a maj triad: singing root–3rd–5th in tune grades correct; flatting the 3rd by >tolerance grades that tone wrong with a signed cents readout.
- Construction mode plays only the root; the prompt names the quality.
- Octave equivalence accepts any-octave tones; off, it enforces the literal register.
- Mic-denied/no-device guidance, privacy note, and mic release on topic switch all behave as in Interval Singing.
- Manual musician gate: 10 arpeggios sung, ≥9 graded as a human judge would (same bar as Interval Singing's gate).
