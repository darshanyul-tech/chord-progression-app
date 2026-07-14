# Topic 04 — Meter Recognition (`meter-recognition`) — NEW

**Status:** new build. Category: Rhythm.
**Reuse mandate (D12):** question material comes from the ported rhythm-dictation generator and playback engine; this topic adds no new audio or generation machinery of its own beyond what is specified here.

## 1. Exercise

A short unlabeled rhythmic (or melodic) excerpt plays after a neutral lead-in; the user identifies the time signature by feel from answer buttons (one per enabled signature). Shared recognition pattern: ≤3 attempts, first guess scored, reveal, replay always available, optional auto-advance.

## 2. Settings

| Setting | Control | Values / default |
|---|---|---|
| Time signatures | checkbox grid | 2/4✓, 3/4✓, 4/4✓, 5/4, 3/8, 6/8✓, 9/8, 12/8 (same 8 as rhythm dictation; defaults chosen to contrast simple vs compound) |
| Tempo | slider | ♩(or ♩. in compound) 40–200, default 90 |
| Sound | 3-button group | percussive (default) / instrumental / melodic — the rhythm engine's three sound modes |
| Beat emphasis | select | emphasized (default) / neutral — maps to emphasis 70 vs 0 on the rhythm engine's 0–100 scale |
| Excerpt length | select | 2 / 4 (default) / 8 measures |
| Auto-advance | checkbox | off |

**Storage schema** (`…settings.meter-recognition`): `{ enabledSignatures: string[], tempo, sound, emphasis, measures, autoAdvance }`

No count-in and **no audible metronome** for this topic (unlike rhythm dictation): the excerpt itself is the only evidence. A 1-second silent gap precedes playback.

## 3. Generation (deterministic procedure)

1. Pick `answerSig` uniformly from enabled signatures.
2. Generate `measures` bars via the ported `fillMeasure`/`partitionBar` pipeline with fixed internal difficulty: durations {quarter, eighth, dotted quarter, half}, rests **off**, syncopation **off**, triplets **off**. Rationale: the meter must be carried by grouping, not obscured by rhythmic noise; difficulty in this topic comes from signature choice, emphasis, sound, and tempo.
3. **Grouping fidelity rule:** the generator is called with the signature's native pulse grouping (compound /8 bars are built from dotted-quarter groups, as `metricPulseBeats` already does). Patterns must include at least one onset on every metric pulse of bar 1 (regenerate the bar until true, max 8 tries, then force pulse onsets) so the meter is hearable.
4. Melodic sound mode assigns pitches with the rhythm engine's existing melodic mode (no new pitch logic).

### Known ambiguity (accepted, documented)
With emphasis = neutral, some pairs (2/4 vs 4/4; 3/8 vs 6/8 subsets) are theoretically ambiguous over short excerpts. This mirrors real aural training; the grading key is always the generated signature. The settings help text must state: *"Neutral emphasis makes closely related metres genuinely ambiguous — enable emphasis or longer excerpts to disambiguate."* No grading leniency is implemented.

## 4. Answer UI

Answer buttons render one per **enabled** signature (like other recognition topics render only enabled content), in the fixed order 2/4, 3/4, 4/4, 5/4, 3/8, 6/8, 9/8, 12/8. Minimum 2 signatures enabled (guard like the legacy ≥1-scale guard, but 2 because a single option is not a question).

## 5. View layout

Standard three-card layout: Settings card (above table), Practice card (status line, transport `Initialize/Play/Replay/Stop`, answer button grid, `Next`), session score line + reset. Reuse the recognition topics' CSS classes wholesale; light theme.

## 6. Exam contribution

Registers `meterRecognition` as a fifth recognition exam type using the identical recognition machinery (count/reps/spacing, limited hearings, delayed feedback). Exam questions use the topic's current settings for signature pool and sound.

## 7. Unit tests

- Pulse-onset guarantee: for each signature, 100 generated bars → bar 1 always has onsets on all metric pulses.
- Enabled-signature guard (min 2).
- Answer-key correctness: generated question's answer id equals the signature used for generation.

## 8. Acceptance criteria

- Each of the 8 signatures, played with emphasis on at percussive/90 bpm, is identifiable by a musician (manual check).
- Neutral mode removes all accent difference (equal click gains).
- Replay replays the identical excerpt; Next generates a new one.
- First-guess scoring, persistence, transport parity per the shared checklist.
