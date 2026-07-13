# Topic 06 — Chord Progressions (`chord-progressions`)

**Status:** carry forward, zero regressions — the largest topic (~2,000 lines). Category: Harmony & Form. Default topic on first load.
**Porting source:** `#progressionView` markup and the progression block (constants `SCALES`, `MAJOR_SCALE`, `FUNCTIONS`, `FLOW`, `RECIPES`, `FAMILY_OPTS_*`, `EXT_OPTS` and every function from `getSettings` through `gradeGuesses`/custom-mode machinery) in the canonical file.

**Porting rule:** this topic is ported function-for-function with no behavioral edits. The list below is a *verification inventory*, not a re-specification — the legacy code is the spec.

## 1. Exercise

A progression is generated in a key (fixed or random per toggle), played with voice-led voicings; the user identifies each bar's chord: scale-degree/function (roman-numeral select), quality family, extension, and inversion where enabled. Per-bar dropdown rows (`renderGuessRows`); grading per bar with partial-credit tallies; "play my guess" renders the user's answer audibly in the same key; reveal shows per-bar comparison (`describeBarAnswer/Guess`).

## 2. Settings inventory (verify all ported)

- **Harmony:** random key toggle; key center (12); tonality major/minor (minor = harmonic-minor harmony: i m7, iiø, bIII, iv, V7, bVI, vii°7); allowed extensions 7/9/11/13 (highest-selected per chord); rootless voicings (split hands) toggle.
- **Progression construction:** diatonic vs chromatic insertions (secondary dominants, tritone subs, borrowed iv, chromatic approach — `makeSecondaryDominant`, `makeTritoneSub`, `makeBorrowedIv`, `makeChromaticApproach`, `insertChromaticChords`) with chromatic-count control; subdominant allowance; resolve/cadence ending; tonic-first orientation option.
- **Performance:** tempo; bar count; inversions toggle (`chooseInversion`, `maxInversionFor`); voice-leading built into `buildVoicing`.
- **Custom progression mode** (`setCustomMode`, `applyCustomModeUi`, `buildProgressionFromGuesses`, `syncCustomProgressionLength`): user enters a progression via the same per-bar selects and plays it back; random-key transposition on Play applies.

**Storage schema** (`…settings.chord-progressions`): flat object of the above control values `{ randomKey, keyCenter, tonality, extensions: string[], rootless, chromatic, chromaticCount, allowSubdominant, cadence, tonicFirst, tempo, bars, inversions, customMode }`.

## 3. Scoring (verify all ported)

Session score plus granular tallies exactly as `gradeGuesses`/`renderSessionScore` compute them today (overall accuracy; function-identification accuracy; tonality accuracy). Reset independent of other topics.

## 4. Exam contribution

Exam type `progressionRecognition` with its dedicated exam panel (`examProgressionPanel`), bar rendering (`renderExamBars`, `renderExamGuessRows`), tonic lead-in (`scheduleTonicLeadIn`), and empty-answer capture rules — port verbatim.

## 5. Unit tests

- `generateProgression` invariants: bar count honored; diatonic-only mode yields only diatonic chords; chromatic count ≤ setting; cadence option ends on V→I / resolution as legacy defines.
- `gradeBarMatch` / `familyExtToQuality` table cases.
- `buildVoicing` smoke: voicings within register bounds, no duplicate adjacent voicing jumps beyond legacy rules (port `dedupeAdjacent` behavior).

## 6. Acceptance criteria

- A/B parity session against the legacy file: same settings → structurally equivalent progressions (same chord vocabulary and constraints), identical grading verdicts on identical guesses.
- Custom mode round-trip: enter progression → Play → transpose under random key → grading disabled per legacy.
- "Play back my guess" audibly matches guessed chords in the question's key.
- Granular score lines render and reset correctly.
