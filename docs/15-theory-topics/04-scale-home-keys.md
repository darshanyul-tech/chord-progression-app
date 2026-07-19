# Theory Topic 04 — Scale Home Keys (`scale-home-keys`) — NEW

**Status:** new build. Section: Theory · Category: Keys & Degrees · Theme: light.
**Reuse (14-theory-engine):** choice frame §9a; key table §2; `spelledPitch`
transposition §1. Tier-1 builder in `lib/written-theory/scaleHomeKeys.ts`.

## 1. Exercise

Given a **mode on a tonic**, name its **home key** — the major key whose notes it uses.
Example: *"D Lydian — what is its home key?"* → **A major** (D Lydian is the 4th mode of
A major). Forward direction by default; an optional reverse direction asks *"Which mode
of A major starts on D?"* → **Lydian**. 3 attempts, first-guess scoring; the reveal
explains the relationship ("D Lydian = the notes of A major, starting on its 4th
degree"); optional auto-advance.

## 2. Settings

| Setting | Control | Values / default |
|---|---|---|
| Modes | checkboxes | Ionian / Dorian✓ / Phrygian / Lydian✓ / Mixolydian✓ / Aeolian✓ / Locrian (≥1 enforced; Ionian off by default — its home key is itself, near-trivial, but legitimately includable) |
| Max home-key accidentals | slider | 1–7, default 5 (bounds the *answer* key; the tonic pool derives from it) |
| Reverse questions | select | off✓ / mixed (coin flip) / only |
| Auto-advance | toggle | off✓ |

**Storage schema** (`eartrainer.v1.settings.scale-home-keys`):
`{ modes, maxAccidentals, reverse, autoAdvance }`

## 3. Question generation (`lib/written-theory/scaleHomeKeys.ts`)

Mode → home-key math is spelled-pitch transposition **down** by the mode's degree
interval (never pitch-class arithmetic — the spelling must be exact):

| Mode | Degree of home key | Home key = tonic down a… |
|---|---|---|
| Ionian | 1 | P1 |
| Dorian | 2 | M2 |
| Phrygian | 3 | M3 |
| Lydian | 4 | P4 |
| Mixolydian | 5 | P5 |
| Aeolian | 6 | M6 |
| Locrian | 7 | M7 |

1. Forward: pick an enabled mode, pick a home key from
   `keysWithin(maxAccidentals, 'major')`, derive the tonic by transposing **up** the
   degree interval (guarantees the answer is always a real key in the table — building
   tonic-first can land on home keys like A♯ major that don't exist). Prompt shows
   "\<tonic\> \<Mode\>".
2. Reverse: same pick, prompt shows the home key + starting note, answer = the mode.
3. Output `{ direction, modeId, tonic: SpelledPitch, homeKeyId, answerId }`.

Choice grid: forward → the 15 major keys (fixed full grid, same rationale as Key
Signatures); reverse → the 7 mode names (fixed, all 7 even if not all enabled — the
question pool is what settings bound, not the answer space).

## 4. Unit tests

- Table check: D Lydian → A; E Dorian → D; B Phrygian → G; F Mixolydian → B♭; C♯ Aeolian
  → E; F♯ Locrian → G; G♭ Lydian → D♭ (flat-side spelling preserved).
- Every generated forward question's home key is in the table and within the slider
  bound; reverse answers always one of the 7 modes; distribution sanity.

## 5. Acceptance criteria

- The user's canonical example works: D Lydian → A major.
- Reveal wording teaches the degree relationship in both directions; first-guess-only
  scoring; persistence rules hold.
