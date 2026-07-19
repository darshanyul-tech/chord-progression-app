# Theory Topic 03 — Scale Degrees (`scale-degrees`) — NEW

**Status:** new build. Section: Theory · Category: Keys & Degrees · Theme: light.
**Reuse (14-theory-engine):** choice frame §9a; `TheoryStaffView` §7; key table +
`scaleSpelling` §2; degree names §5. Tier-1 builder in
`lib/written-theory/scaleDegrees.ts`.

## 1. Exercise

The prompt shows a **key** and a **note**; the user answers which scale degree that note
is in that key. Example: *"Key: E♭ major — what degree is C?"* → **6**. The note is shown
both as text and on a staff (with the key's signature, so the visual reinforces
key-signature reading). Diatonic notes only in v1 (chromatic degrees like ♯4 are
backlog). Minor keys use the natural minor scale. 3 attempts, first-guess scoring,
reveal states degree number + name ("C is 6̂ — the submediant of E♭ major"); optional
auto-advance.

## 2. Settings

| Setting | Control | Values / default |
|---|---|---|
| Keys | select | majors / minors / both✓ |
| Max accidentals | slider | 0–7, default 4 |
| Display | select | staff + text✓ / text only (drills pure key knowledge without the visual crutch) |
| Degree labels | select | numbers✓ / names (changes the answer buttons' primary label; the other form always shows as the button's sublabel — both are always visible, the setting picks which is big) |
| Auto-advance | toggle | off✓ |

**Storage schema** (`eartrainer.v1.settings.scale-degrees`):
`{ keys, maxAccidentals, display, degreeLabels, autoAdvance }`

## 3. Question generation (`lib/written-theory/scaleDegrees.ts`)

1. Pick a key from `keysWithin(maxAccidentals, keysSetting)`; pick a degree 1–7
   uniformly.
2. The asked note = `scaleSpelling(key)[degree-1]` — **the key's own spelling**, always
   (in E♭ major the 6th degree is C; in B major the 4th is E; never an enharmonic
   respelling).
3. Staff display: the note as a whole note on a treble or bass stave (auto: bass when
   the note's comfortable octave sits below C4, else treble) **with the key signature**.
   When more than one octave fits inside the staff, use the one whose staff position is
   nearest the middle line (binding tie-break; ties go to the lower octave).
4. Output `{ key, degree (answerId), note: SpelledPitch, clef, promptText }`.

Choice grid: 7 fixed buttons, `1̂`–`7̂` with degree names as sublabels (per the labels
setting, swapped). Minor-key questions label degree 7 **subtonic** (mode-aware names —
engine §5).

## 4. Unit tests

- For every key in the table: all 7 asked notes equal `scaleSpelling` output; degree 7's
  name is leading note in major, subtonic in minor.
- Pool respects mode + accidental settings; staff octave always within the displayed
  staff's range; 500-draw distribution sanity over keys and degrees.

## 5. Acceptance criteria

- Spot-check: E♭ major + C → 6; B minor + A → 7 labeled subtonic; F♯ major + E♯ → 7
  (displayed as E♯, never F).
- Text-only display mode shows no staff; first-guess-only scoring; persistence rules
  hold.
