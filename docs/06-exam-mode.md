# 06 — Exam Mode: Port + Expansion

Two workstreams: (A) verbatim port of the existing exam machinery, (B) expansion with Meter Recognition and the two dictation types.

---

## A. Port (zero regressions)

Porting source: the `exam` object, `EXAM_SECTION_MODES`, `EXAM_RECOGNITION_SETTINGS_SCHEMA`, `EXAM_ANSWER_LIMIT_SEC = 30`, and all `exam*`/`*Exam*` functions in the canonical file. Split per the two-tier protocol: paper building, sequencing/timers, playback orchestration, and grading (`buildMixedExamPaper`, `gradeRecognitionSingle`, `playExamRepetitions`, `playExamNoteSequence`, `playExamChordBlock`, `stopExamAnswerTimer`, `clearExamTimers`, `abortExamPlayback`, …) port verbatim into Tier-1 `src/exam/exam-machine.ts`; the setup screen, question panels, choice rendering, and results/review screens are Tier-2 parity re-implementations (`ExamSetup.tsx`, `ExamOverlay.tsx`, `ExamResults.tsx`).

Preserved behavior:
- Entry via the always-visible header button; exam overlay replaces the topic view; topic navigation disabled while active.
- Setup screen: enable any combination of question types; per-type settings from the recognition schema — count 1–30, repetitions per question 1–5, spacing between repetitions 0–15 s. Defaults pre-enable the type matching the topic the user came from (`examTypeDefaultEnabled`).
- Question flow: limited hearings (reps × spacing), 30 s answer timer, **no feedback until the end**; skip/empty answers captured per legacy rules (`allowEmptyCapture`).
- Existing four types: `progressionRecognition` (its dedicated per-bar panel), `intervalRecognition`, `chordRecognition`, `scaleRecognition` (choice-button panel, grouped choices for chord/scale).
- Results screen: per-question user-answer vs correct-answer comparison; recognition accuracy statistics.

## B. Expansion (new)

### B1. Type registration
Exam types are contributed by topic modules via the registry (`TopicDefinition.examTypes`) instead of the hardcoded `EXAM_SECTION_MODES` map. Two kinds:

```ts
type ExamTypeDefinition =
  | { kind: "recognition"; id: string; label: string;
      buildQuestion(): RecognitionExamQuestion;        // legacy buildXxxExamQuestion signature (Tier 1)
      ChoicesComponent: React.ComponentType<ExamChoicesProps> }   // grouped choice buttons
  | { kind: "dictation"; id: string; label: string;
      buildQuestion(): DictationExamQuestion;          // generated pattern/melody + playback fn (Tier 1)
      AnswerComponent: React.ComponentType<ExamDictationProps>;   // topic's staff UI, reports the
    };                                                            // captured answer via onChange
```

The port first reproduces the four legacy types through this interface unchanged (adapter-thin), then new types plug in.

### B2. Meter Recognition in exams (recognition kind)
`meterRecognition` behaves identically to the other recognition types: reps/spacing hearings, 30 s timer, choices = the topic's enabled signatures, answer graded exact, included in recognition accuracy stats.

### B3. Dictation types in exams (`rhythmDictation`, `melodicDictation`)
Structural differences, per spec §5:
- **Per-type exam settings:** count 1–10 (default 2), **replays allowed 0–5** (default 2; a replay is a full re-hearing the user triggers), no spacing/reps concept. Answer time limit: 120 s per dictation question (extended from 30 s — notation entry takes longer; constant `EXAM_DICTATION_LIMIT_SEC = 120`).
- Answer UI: the topic's own staff interface mounted inside the exam panel (same palette, snapping, keyboard).
- Grading: matched / did not match per question. **Never blended** into recognition accuracy; results screen shows a separate "Dictation" section: per question, the user's staff and the correct staff rendered side by side (reuse reveal rendering) with a matched/not badge.
- Replay counter visibly ticks down; Play disabled at 0 remaining.

### B4. Replay limits for recognition types (spec §5 requirement)
Add "replays after hearings" per recognition type: 0–3, default 0 (legacy behavior = no extra replays — default preserves current behavior exactly). A replay re-plays the question once on demand during the answer window.

### B5. Exam settings persistence
Exam setup (enabled types + per-type settings) persists under `eartrainer.v1.settings.exam`, same tolerant restore rules.

## C. Unit tests
- Paper builder: type mix and counts honored; shuffled order stable-seedable for tests (inject RNG).
- Dictation grading path returns matched/not-matched and never increments recognition tallies.
- Replay-limit accounting.

## D. Acceptance criteria
- Legacy parity for the four original types (setup defaults, hearings timing, 30 s limit, results table).
- Mixed paper containing all 7 types runs start-to-finish; results screen shows recognition stats + dictation section correctly separated.
- Exiting an exam restores the previously active topic view and hash, with its state intact.
