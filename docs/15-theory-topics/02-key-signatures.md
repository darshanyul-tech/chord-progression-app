# Theory Topic 02 — Key Signatures (`key-signatures`) — NEW

**Status:** new build. Section: Theory · Category: Reading & Notation · Theme: light.
**Reuse (14-theory-engine):** choice frame §9a; `KeySignatureView` §7; full key table §2.
Tier-1 builder in `lib/written-theory/keySignatures.ts`.

## 1. Exercise

A key signature is displayed on a stave (clef + signature, nothing else). The prompt
states which mode to name — **"Name the major key"** or **"Name the minor key"** — and
the user picks from a grid of key names. Both modes of one signature are separate
questions (the display is identical; the prompt disambiguates). 3 attempts, first-guess
scoring; the reveal always names **both** keys ("3 sharps — A major / F♯ minor") so every
question reinforces the relative pair. Optional auto-advance.

## 2. Settings

| Setting | Control | Values / default |
|---|---|---|
| Ask for | select | major keys / minor keys / both✓ (both = coin flip per question) |
| Max accidentals | slider | 1–7, default 5 (0-accidental C/Am is always in the pool — the slider bounds the top, and the blank signature is a legitimate, often-missed answer) |
| Clefs | checkboxes | treble✓ / bass✓ / alto / tenor (signature accidental positions differ per clef — that's the point of offering them) |
| Auto-advance | toggle | off✓ |

**Storage schema** (`eartrainer.v1.settings.key-signatures`):
`{ askFor, maxAccidentals, clefs, autoAdvance }`

## 3. Question generation (`lib/written-theory/keySignatures.ts`)

1. Pool = `keysWithin(maxAccidentals, mode)` from the key table (mode per the setting /
   coin flip). Pick uniformly; pick a clef from the enabled set.
2. Output `{ clef, vexKeySpec (always the MAJOR spec — display is mode-independent),
   askMode, answerId (TheoryKey id), accidentalCount, relativeLabel }`.

Choice grid: all 15 keys of the asked mode (fixed grid, teal `chord-choice` styling),
labels like `A major` / `F♯ minor` — the grid never shrinks with the slider (choosing
among all 15 is part of the skill; only the *question* pool is bounded).

## 4. Display

`KeySignatureView`: clef + signature. The C/Am question renders an empty stave — verify
no layout collapse. No time signature, no notes, no barline decorations.

## 5. Unit tests

- Pool respects the slider bound and always contains the 0-accidental key.
- For every one of the 30 keys: builder's `vexKeySpec` renders (smoke) and
  `accidentalCount`/mode match the table.
- Both-mode coin flip distribution sane over 500 draws; reveal string contains both
  relative names.

## 6. Acceptance criteria

- Signatures visually correct in all enabled clefs (spot-check 3♯ and 4♭ against a
  notation reference in treble, bass, alto).
- Prompt wording unambiguous; reveal teaches the relative pair; first-guess-only
  scoring; persistence rules hold.
