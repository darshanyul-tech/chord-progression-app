# Topic 11 — Tuning (`tuning`) — NEW

**Status:** new build (no legacy source). Category: Intervals & Scales. Theme: light.
**Reuse mandate (D13/D15):** cents math from `lib/pitch/analysis.ts` (`f0FromMidi`, `centsBetween`) — the tuning topic is pure playback + judgment, **no microphone**; playback via the shared sampler + `lib/audio/playback.ts` channel pattern; recognition scoring frame (`useScoresStore`, `TransportRow`, `StatusLine`, `SessionScoreLine`, `ChoiceGrid`); settings via `createPersistedSettingsStore`. New logic framework-free in `src/lib/recognition/tuning.ts`, unit-tested.

## 1. Exercise

A reference note plays, a pause, then the **same note again — either in tune or detuned** by a small number of cents. The user answers **"Flat", "In tune", or "Sharp"**. Up to 3 attempts (`RECOGNITION_MAX_GUESSES`); first-guess-only scoring. Reveal names the actual detune ("Second hearing was 15¢ sharp"); optional auto-advance (`RECOGNITION_AUTO_ADVANCE_MS`).

This trains fine pitch discrimination — the perceptual foundation under both singing topics' ±cents tolerances. Difficulty is the detune magnitude: smaller offsets are harder.

## 2. Settings

| Setting | Control | Values / default |
|---|---|---|
| Difficulty | select | easy (±25¢)✓ / medium (±15¢) / hard (±8¢) — the fixed magnitude used for every detuned question at that level |
| In-tune ratio | fixed ~1/3 (not a setting — the base rate must stay stable for the "In tune" answer to be meaningful) | — |
| Register | select | low (C3–B3) / mid (C4–B4)✓ / high (C5–B5) / any (C3–B5) |
| Note length | slider | 0.5–2.0 s, default 1.0 |
| Pause between hearings | slider | 0.3–2.0 s, default 0.8 |
| Auto-advance | toggle | off✓ |

**Storage schema** (`eartrainer.v1.settings.tuning`):
`{ difficulty, register, noteLen, pauseSec, autoAdvance }`

## 3. Question generation (Tier-1, `lib/recognition/tuning.ts`)

1. Pick a random MIDI note uniformly inside the register window.
2. Roll in-tune vs detuned (~1/3 in-tune). Detuned: coin-flip flat/sharp; magnitude = the difficulty's fixed cents value.
3. Output: `{ baseMidi, detuneCents: number (0 | ±magnitude), answerId: 'flat' | 'intune' | 'sharp' }`.

All randomness through `lib/theory.ts`'s `random()`/`pick()` (seedable, Phase 15 convention). Choice defs are the fixed three buttons — never varies with settings.

## 4. Playback

The detuned hearing needs a **frequency-valued sampler trigger**: `Tone.Sampler.triggerAttackRelease` accepts Hz (`Frequency` values), so extend `scheduleSamplerTrigger`'s `notes` parameter to accept numbers-as-Hz alongside note-name strings (or add a sibling `scheduleSamplerTriggerHz` if the union muddies the shared signature — implementer's call, but do not fork the channel pattern). Hz for the second hearing = `f0FromMidi(baseMidi) * 2^(detuneCents/1200)` — reuse `f0FromMidi`, do not duplicate the math.

Sequence: reference note (noteLen), pause (`pauseSec`), test note (noteLen). Standard channel cancellation; Replay replays the identical pair; Replay disabled while sounding (`scheduleChannelDone` + `replayDisabled`, Phase 12.1 convention).

## 5. Transport / feedback / score

Standard recognition pattern: Initialize audio → Play pair → Replay → Stop → three answer buttons → Next. Reveal always states the signed cents so a wrong "In tune" teaches the actual offset. Session score + reset.

## 6. Exam contribution

Registers recognition exam type `tuning` (shared count/reps/spacing/replays schema). `buildPaper` uses the topic's persisted settings. Three fixed choices; per-type empty-paper message is not needed (the pool can never be empty — note this in the examType so nobody adds a dead guard).

## 7. Unit tests

- Builder: 500 questions per difficulty — detune magnitude is exactly the difficulty's value or 0; flat/sharp/in-tune frequencies within sane chi-square bounds; base note always inside the register window.
- Hz math: detuned frequency for +15¢ on A4 ≈ 443.8 Hz (assert via `centsBetween` round-trip rather than a hand-computed constant).
- Choice defs: always exactly flat/intune/sharp in that order.

## 8. Acceptance criteria

- At hard difficulty the two hearings are audibly distinct to a trained ear but genuinely difficult (manual musician spot-check, same convention as chord comparison's tier-3 check).
- An in-tune question's two hearings are bit-identical in scheduled frequency.
- First-guess-only scoring verified (wrong→right = total+1, correct+0); Replay reproduces the identical pair; settings persist across reload; score does not; exam type appears in exam setup and runs end-to-end.
