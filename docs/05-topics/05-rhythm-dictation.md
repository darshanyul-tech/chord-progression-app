# Topic 05 — Rhythm Dictation (`rhythm-dictation`)

**Status:** carry forward, zero regressions — this is the most delicate port in the project. Category: Rhythm. Theme: **dark** (preserves `body.rhythm-active`).
**Porting source:** `#rhythmView` markup (legacy lines ~1458–1599), the `rd-*` styles, and the entire rhythm block (functions ~5795–6885) in the canonical file.

## 1. Exercise (as built today — preserve exactly)

A rhythmic pattern is generated (never shown first), played after a metronome count-in, and the user reconstructs it by placing notes/rests on a single-line rhythmic staff. Grading is whole-exercise: all measures must match for the question to count as correct. On mismatch, the correct rhythm is revealed in a contrasting color. Session score `correct/total`.

## 2. Settings (ported controls, exact)

| Setting | Control | Values / default |
|---|---|---|
| Time signatures | checkboxes | 2/4✓ 3/4✓ 4/4✓ 5/4 3/8 6/8 9/8 12/8 |
| Note & rest values | checkboxes | Whole✓ Half✓ Quarter✓ Eighth✓ Sixteenth, Dotted quarter✓, Dotted eighth, Dotted half |
| Rest frequency | select `rd-rest-frequency` | none / light / moderate✓ / heavy |
| Syncopation | select `rd-syncopation` | off✓ / light / moderate / heavy |
| Include triplets | toggle `rd-include-triplets` | off |
| Measures per question | select `rd-num-measures` | 1 / 2 / 4✓ / 8 |
| Tempo | slider `rd-tempo-slider` | 40–200, default 84 |
| Sound | buttons `rd-sound-type-btns` | percussive✓ / instrumental / melodic |
| Beat emphasis | slider `rd-emphasis-slider` | 0–100, default 60 |
| Metronome volume | slider `rd-metro-volume` | 0–100, default 50 |

**Storage schema** (`…settings.rhythm-dictation`): `{ signatures: string[], durations: number[], restFrequency, syncopation, triplets, measures, tempo, sound, emphasis, metroVolume }`

## 3. Entry method (preserve exactly)

- Palette buttons arm a duration (whole…dotted half, triplet eighth/quarter); modifier buttons: rest mode, dot, backspace, clear measure.
- Keyboard: `1–8` arm durations, `R` rest, `D` dot, `Backspace` remove last, `Esc` per legacy `onKeyDown`.
- Click on staff places the armed value at the snapped beat (`snapBeat`, `gridStep`, overlap rejection via `noteOverlaps`); capacity hint line (`updateCapacityHint`) shows remaining beats; submit enabled only when all measures are exactly full (`syncSubmitEnabled`).

## 4. Generation & playback (preserve exactly)

- `generateQuestion` → per-measure `fillMeasure` honoring enabled durations, rest chance (`restChance`), syncopation weighting (`beatSyncopationScore`, `placeSyncopated` vs `placeSequential`), triplets toggle.
- Count-in dots UI + metronome clicks precede playback; pulse honors the meter (simple = quarter, compound = dotted quarter — `metricPulseBeats`/`metricPulseCount`).
- Three sound modes; emphasis scales strong-beat gain; metronome volume independent.
- `Preview pattern` button (plays a sample of current settings without starting a question) is preserved (`playTestExample`).

## 5. Grading & reveal (preserve exactly)

`checkAnswer` → `measuresEqual` per measure (tick-exact, rest-aware). All-or-nothing scoring; feedback strip message + per-question score; correct pattern rendered distinctly on mismatch. `Next` starts a new question.

## 6. Module placement

Tier 1: staff rendering/geometry → `lib/rhythm-staff/` + `lib/rhythm/time.ts`; percussion → `lib/audio/percussion.ts`; generation (`fillMeasure` pipeline) → `lib/rhythm/generator.ts` — Meter Recognition and Melodic Dictation import it. Tier 2: `RhythmDictationTopic.tsx` + `RhythmStaffHost.tsx` (imperative-island host per `04-notation-engine.md` Part A); palette arming, keyboard map, count-in dots, and feedback strip are component state/JSX reproducing the legacy view's structure and class names.

## 7. Exam contribution (new — see 06-exam-mode.md)

Registers dictation exam type `rhythmDictation`: limited replays, answer via the same staff UI, graded matched/not-matched, reported in the dictation results section.

## 8. Unit tests

Port-verification tests for the pure pieces: `parseTimeSig`, `durationTicks`, `measuresEqual`, `fillMeasure` (bars always exactly full; only enabled durations used; rests=none ⇒ no rests; syncopation=off ⇒ all onsets on grid pulses).

## 9. Acceptance criteria

- Side-by-side behavior parity with the legacy file across: count-in, emphasis slider extremes, all three sounds, triplet entry, 8-measure questions, reveal rendering, keyboard shortcuts.
- Dark theme applies on activate, clears on deactivate.
- Settings persist; score survives topic switches but not reload.
