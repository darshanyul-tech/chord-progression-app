# Topic 09 — Chord Comparison (`chord-comparison`) — NEW

**Status:** new build (no legacy source). Category: Chords. Theme: light.
**Reuse mandate (D13/D15):** chord tables from `lib/recognition/chords.ts` (`CHORD_RECOGNITION_RECIPES`, `CHORD_RECOGNITION_TYPES`, `buildChordRecognitionVoicing`, `pickChordRootMidi`); playback via the shared sampler; recognition scoring frame; persisted settings store. New logic framework-free in `src/lib/recognition/chordComparison.ts`, unit-tested. **Do not touch the progression trainer's separate chord machinery** (same firewall as chord recognition, D15).

## 1. Exercise

Two chords play in sequence; the user answers **"Same" or "Different"**. Up to 3 attempts, first-guess-only scoring (with 2 choices this effectively means the first guess decides; keep the shared frame for consistency). Reveal names both qualities ("First: Major 7 · Second: Dominant 7"); optional auto-advance.

Trains quality discrimination without requiring quality *naming* — the stepping stone between "these sound different" and Chord Recognition's full identification. Difficulty comes from how *similar* the "different" pair is.

## 2. Confusion tiers (the core design — implement as explicit tables)

"Different" pairs are drawn from hand-curated confusion tables, not random pairs — random quality pairs are usually trivially distinguishable. Three tiers, each a list of unordered pairs of `CHORD_RECOGNITION_TYPES` ids:

- **Tier 1 (easy) — family differences:** maj↔m, maj↔dim, m↔aug, maj7↔m7, 7↔m7, maj↔sus4.
- **Tier 2 (medium) — same family, extension/color:** maj↔maj7, maj7↔maj9, m7↔m9, 7↔9, maj↔maj6, m↔m6, 7↔13, sus4↔sus2, maj7↔7 (the classic), m7↔mMaj7.
- **Tier 3 (hard) — single-alteration pairs:** 7♯5↔7♭5, maj7♯5↔maj7, 7♯9↔7♭9, m7♭5↔dim7, m7♭5↔m7, 7sus4↔7sus4♭9, maj7♭5↔maj7, m9↔m9♭5, 9↔9sus4, 7alt↔7♯9.

A pair is only eligible when **both** of its qualities are enabled in the chord pool setting. Tables live in the Tier-1 module as exported constants so tests can assert coverage (every id referenced exists in `CHORD_RECOGNITION_TYPES`).

## 3. Settings

| Setting | Control | Values / default |
|---|---|---|
| Chord pool | grouped checkboxes (reuse chord recognition's group/type layout) | defaults = chord recognition's defaults (maj, m, maj7, m7, 7) |
| Difficulty | select | tier 1✓ / up to tier 2 / up to tier 3 (cumulative — higher tiers include lower) |
| Root relationship | select | same root✓ / transposed (second chord's root moves ±1–5 semitones; quality comparison across transposition is substantially harder) |
| Same/Different balance | fixed 50/50 (not a setting — an imbalanced base rate corrupts the exercise) | — |
| Playback style | select | block✓ / arpeggio (reuse chord recognition's scheduling) |
| Chord length | slider | 0.8–2.5 s, default 1.4 |
| Pause between chords | slider | 0.3–2.0 s, default 0.8 |
| Auto-advance | toggle | off✓ |

**Storage schema** (`eartrainer.v1.settings.chord-comparison`):
`{ enabledTypes: string[], difficulty: 1|2|3, rootRelationship, playbackStyle, holdLen, pairPauseSec, autoAdvance }`

## 4. Question generation (Tier-1, `lib/recognition/chordComparison.ts`)

1. Compute eligible confusion pairs: tiers ≤ difficulty, both qualities enabled. If none, return null (UI explains: "enable at least one pair of comparable qualities…", listing an example).
2. Roll same/different 50/50. Same: one quality (from any enabled quality that appears in ≥1 eligible pair — keeps the pool coherent), played twice. Different: pick an eligible pair uniformly; coin-flip order.
3. Root A via `pickChordRootMidi` (uniform pitch class, comfortable register). Root B: same as A, or transposed ±1–5 semitones (uniform, nonzero) per the setting — clamped to the recognition register window.
4. Voicings via `buildChordRecognitionVoicing` — root position both, always (inversion comparison is a different, much harder exercise; out of scope v1, note in doc).
5. Output: `{ first: {quality, rootMidi}, second: {…}, answerId: 'same' | 'different' }`.

Seedable randomness throughout.

## 5. Playback / transport / score

Chord A (block or arp per setting), pause, chord B; standard channel cancellation, identical Replay, Stop, Replay-disabled-while-sounding. Standard recognition transport and first-guess scoring; reveal prompt always names both qualities so a wrong "same" teaches the distinction that was missed.

## 6. Exam contribution

Registers recognition exam type `chordComparison` (shared schema; per-type empty-paper message when no eligible pairs). Two answer buttons.

## 7. Unit tests

- Confusion tables: every referenced id exists in `CHORD_RECOGNITION_TYPES`; no pair appears in two tiers; no self-pairs.
- Builder: 500 seeded questions — same/different ≈ 50/50; "different" questions always come from eligible tiers; disabling one quality of a pair removes that pair; null when no eligible pairs.
- Transposed mode: root B ≠ root A, offset within ±5 and register clamped.

## 8. Acceptance criteria

- Tier 1 with defaults plays clearly distinguishable pairs; tier 3 with the altered-dominant pool produces genuinely hard questions (manual musician spot-check).
- Same/Different scoring, reveal naming, settings persistence, exam integration all verified per the standard recognition checklist (docs/08 §3).
- With only one quality enabled, the UI explains why questions can't generate rather than silently doing nothing.
