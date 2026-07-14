# Ear Trainer — Functional & Feature Specification

**Purpose of this document:** This is a pure functionality and feature specification. It describes *what* the software should do, how it should be organized, and how it should feel to use. It intentionally contains no implementation guidance (no tech stack, architecture, file structure, or coding approach) — that is left entirely open for planning and execution.

---

## 1. Product Vision

This is a browser-based ear training and musicianship platform, in the spirit of professional ear-training software used by music schools (e.g. Auralia), but built around a personal, currently jazz-leaning core (functional jazz harmony, chord/scale/interval recognition, and rhythm work). The existing app already covers several of these areas as a single self-contained HTML file with a clean, configurable, non-"gamified" practice interface.

The next stage of this project is to:

1. **Expand the range of topics/exercises** to more closely match the breadth of a full ear-training curriculum, organized the way a real syllabus is organized (grouped by musical category, with each topic addressable individually).
2. **Reorganize navigation** around a categorized topic/mode-select menu (similar to a syllabus browser), replacing or supplementing the current flat row of mode tabs.
3. **Grow beyond a single local HTML file** into something that behaves like a proper web application reachable at a normal web address — usable from a shared link, on desktop or mobile, without the user needing to manually open a file.
4. **Preserve the existing visual identity and interaction style** already established in the current build (see Section 3).

---

## 2. Navigation Model — Syllabus-Style Mode Selector

Replace the current simple mode-tab row with a **categorized topic menu**, modeled on how a syllabus/curriculum browser is laid out (reference screenshot provided separately). The structure is:

- The menu is organized into **named category groups**, displayed as separate panels/columns or sections, each with a clear header.
- Each category contains a **vertical list of individual topics/exercises** as clickable entries.
- The **currently active topic** is visually distinguished from the rest (e.g. bolded or highlighted), while other topics in the list remain visible but not selected.
- Topics that exist and are fully working should look and behave identically to topics that are planned but not yet built — i.e., the menu itself should be able to represent the "full syllabus" even before every topic is implemented, the same way a real curriculum lists every topic whether or not a student has reached it yet.
- There should be a clearly separate **"Custom Topics"** category/section, reserved for topics the user defines themselves later (an open, extensible slot in the menu rather than a fixed list) — this does not need real content now, just a place in the navigation structure for future custom exercises.
- Selecting a topic from the menu swaps the main working area to that topic's dedicated practice view, in the same way the current mode tabs swap between practice views — only the entry point (the menu) changes, not the underlying "one view visible at a time" interaction model.
- The categories to include, matching a syllabus-style grouping, are:
  - **Intervals & Scales**
  - **Chords**
  - **Rhythm**
  - **Harmony & Form**
  - **Pitch & Melody**
  - **Repertoire** (placeholder category for future listening/identification-style topics; no specific topics required yet)
  - **Musical Elements** (placeholder category for future topics like dynamics, articulation, tempo, texture; no specific topics required yet)
  - **Custom Topics** (empty/extensible, as above)

The immediate priority is implementing the following topics with full functionality (detailed in Section 4); the remaining topics in each category may simply exist as placeholder/"coming soon" entries in the menu so the full syllabus structure is visible from day one:

- Interval Recognition *(exists — carry forward)*
- Scales *(exists — carry forward)*
- Chord Recognition *(exists — carry forward)*
- Meter Recognition *(new)*
- Rhythm Dictation *(exists in the rhythm-focused version — carry forward and formalize)*
- Chord Progressions *(exists — carry forward)*
- Melodic Dictation *(new)*

---

## 3. Preserving the Existing Style & Interaction Model

Whatever is built should look and feel like a continuation of the current app, not a redesign. Key style/interaction characteristics to preserve:

- A **clean, minimal, professional aesthetic** — no cartoonish gamification, no badges/streak mechanics, no distracting animation. The tone is that of a serious practice tool, similar in spirit to the restrained interface style of professional ear-training software.
- A consistent **light theme with a dark/black accent header treatment**, and a limited, deliberate color accent (the current build uses a teal/white/black palette) rather than a colorful multi-hue UI.
- **Card-based layout**: settings live in their own distinct panel/card, separate from the "listen and respond" practice panel, which is separate again from the session score panel. This three-part separation (Settings → Practice/Response → Score) should be consistent across every topic, including new ones.
- **Every topic has its own settings panel** allowing the user to configure the difficulty and content scope of that exercise before or during practice, rather than being locked into fixed pre-set "levels." Users should be able to grow the difficulty scope with unlimited configuration rather than a small quantity of preset difficulty tiers.
- **Consistent transport controls** across topics: initializing audio, playing/replaying the prompt, stopping playback, submitting/checking an answer, and moving to the next question — presented the same way regardless of which topic is active.
- **Consistent feedback behavior**: after an answer, the correct answer should be clearly revealed (visually and/or audibly), and the interface should clearly mark whether the response was right or wrong, without excessive delay or unnecessary steps.
- **Consistent scoring behavior**: each topic keeps its own running session score, visible at all times while practicing that topic, and resettable independently of other topics' scores.
- The overall app should retain a **single unified shell** (title, subtitle, top-level navigation, and an always-available "Exam mode" entry point) surrounding whichever topic is currently active, matching the existing app's shell/topic-view relationship.

---

## 4. Detailed Functional Requirements Per Topic

### 4.1 Interval Recognition *(carry forward existing functionality, no regressions)*
- User hears two pitches (the interval), either ascending or descending, and identifies which interval was played.
- User can configure which specific intervals are included in a session (e.g. selectively enable/disable intervals such as minor 2nd through major/minor 9th, perfect 8ve, etc.) rather than being forced through a fixed set.
- User can configure whether intervals are played ascending only, descending only, or both, and this should be selectable at a session level.
- User can control the timing/spacing of the two notes (note length and gap between notes) as a practice-difficulty parameter.
- The response method is answer buttons representing interval names; multiple attempts per question are allowed, but only the first attempt counts toward the "correct" tally in the session score.
- An auto-advance option lets the next question begin automatically once an answer has been revealed, without requiring a manual "next" action.
- Play, replay, and skip-to-next controls are always available during a question.

### 4.2 Scales
- User hears a scale played as a run of notes (ascending, and optionally descending) and identifies which scale/mode was played.
- Scale content should be organized in configurable groups reflecting real music-theory categories, at minimum: major modes, minor forms (natural/harmonic/melodic), pentatonic/hexatonic scales, and symmetric scales (e.g. whole-tone, octatonic/diminished) — with the ability to expand into jazz-specific scales (bebop scales, altered scales, etc.) as an available, toggleable group rather than a hardcoded fixed list.
- The user can restrict practice to specific scale groups or specific individual scales within a group.
- The starting note/root of the scale should vary within a sensible playable range each time, so the exercise isn't reduced to memorizing a single fixed starting pitch.
- Response, scoring, and playback controls follow the same first-guess-scored, multi-attempt-allowed pattern as Interval Recognition.

### 4.3 Chord Recognition
- User hears a single chord (played either as a block/solid chord or arpeggiated, depending on a user-configurable setting) and identifies its quality/type.
- Chord content should be organized in configurable groups reflecting real harmonic categories, at minimum: basic triads (major, minor, augmented, diminished), added/suspended chords (sus2, sus4), sixth chords, seventh chords (major 7, dominant 7, minor 7, half-diminished 7, fully diminished 7), and a further "altered/extended" group for upper-structure and altered chords (9ths and beyond, altered dominants, etc.) — with the ability for the user to enable/disable individual chord types or whole groups for a given practice session.
- Playback style (block vs. arpeggiated) and timing (hold length for block chords; note length and gap for arpeggios) should be independently configurable.
- Response, scoring, and playback controls follow the same first-guess-scored, multi-attempt-allowed pattern as the other recognition topics.

### 4.4 Meter Recognition *(new topic)*
- User hears a short rhythmic or melodic excerpt and identifies the time signature by feel (the excerpt is not labeled or hinted at in advance).
- The set of time signatures included in a session should be configurable (at minimum covering simple meters such as 2/4, 3/4, 4/4, and compound/odd meters such as 6/8, 5/4, 9/8, 3/8, 12/8), matching the scope already used elsewhere in the rhythm-focused parts of the app.
- The user should be able to control the tempo and the type of sound used for the excerpt (e.g. a plain click/percussive pulse vs. a more melodic excerpt), and whether the excerpt emphasizes the strong beat audibly or plays completely neutrally, as difficulty controls.
- Response is a simple selection among the enabled time signatures; scoring and playback controls follow the same pattern as other recognition topics (first attempt counts, replay available, auto-advance optional).

### 4.5 Rhythm Dictation *(carry forward and formalize existing functionality)*
This topic already exists in a fully worked-out form and should be preserved essentially as-is, including:
- A generated rhythmic pattern is played (not notated in advance) and the user must reconstruct it by placing notes/rests onto a single rhythmic staff (not a full 5-line melodic staff — just rhythmic placement).
- Full configurability of: which time signatures may appear, which note/rest durations are allowed (from whole notes down to sixteenth notes, including dotted values), how frequently rests appear (a scaled setting from none/light through heavy), how much syncopation is present (a scaled setting from off through heavy), whether triplets are allowed, how many measures the pattern spans, tempo, the sound/instrument character used for playback, whether a beat is audibly emphasized, and the volume of any metronome/count-in.
- A palette-based entry method: the user "arms" a note or rest duration and places it directly onto the staff at a snapped beat location; already-placed notes can be removed individually (undo/backspace) or the whole measure/pattern can be cleared.
- A count-in / metronome precedes playback of the actual rhythm, and the correct pattern for playback should audibly represent the meter properly (e.g. simple-meter quarter-note pulses vs. compound-meter dotted-quarter pulses).
- Grading is done per full exercise (all measures correct = one correct answer for the session score), not per individual note, matching how this differs from the note-by-note first-guess scoring used in the recognition-style topics.
- A visible correction/reveal state shows the correct rhythm distinctly (e.g. in a contrasting color) when the submitted answer doesn't fully match.

### 4.6 Chord Progressions *(carry forward existing functionality, no regressions)*
This topic already exists in a fully worked-out form and should be preserved, including:
- A short chord progression is generated and played in a chosen or randomly selected key, and the user must identify each chord in the progression — at minimum its scale-degree/function, quality, and (optionally) extension/inversion — bar by bar.
- Configurable harmonic scope: choice of major or minor tonality (with the option to include natural minor vs. harmonic-minor-flavored dominant chords), a selectable "highest extension" allowed per chord (from simple triads up through 7ths, 9ths, and beyond), and an option for rootless/split-hand-style voicings as a voicing-character setting.
- Configurable progression construction: diatonic-only vs. allowing chromatic insertions (secondary dominants, borrowed/mixture chords, chromatic approach chords) with a control over roughly how many chromatic chords appear in a given progression; whether sub-dominant-family chords are allowed; whether the progression should end on a clear resolution/cadence; and whether the tonic chord is always sounded first as an orienting reference.
- Configurable performance parameters: tempo, and the number of bars/chords in the generated progression.
- An additional **inversions** toggle and an underlying preference for smoother voice-leading (i.e. the generated chords should move between each other in a musically sensible way rather than jumping registers arbitrarily) should be preserved as configurable/underlying behavior.
- The user's guess for each bar is entered per-bar (function/roman-numeral-style identification, quality, extension, and — where relevant — inversion).
- A "play back my guess" capability lets the user hear what they answered, rendered in the same key as the original progression, so they can compare their answer musically rather than just visually.
- A **custom progression mode** should be preserved: the user can input a progression directly instead of generating a random one, and play that back, useful for testing one's own compositions or specific progressions of interest rather than only random ones.
- Session scoring should continue to track overall accuracy as well as more granular breakdowns (for example, accuracy specifically on identifying chord function, and accuracy specifically on identifying major/minor tonality), not just a single blended score.
- As a possible future refinement of this topic (not required for the initial build, but worth reserving room for): an alternate answer-input mode using Nashville Number System notation as an alternative to roman-numeral/function labeling, and support for identifying/answering in more explicit harmonic-function terms alongside the numeral system.

### 4.7 Melodic Dictation *(new topic)*
- A short single-line melody is played, and the user must transcribe it by placing notes onto a proper melodic staff (unlike Rhythm Dictation's single rhythmic line, this requires correct pitch placement as well as rhythm).
- The user should be able to choose or be assigned treble or bass clef for the exercise.
- Generated melodies should be able to include ledger lines and accidentals, not just notes within the staff and within the key signature, as a difficulty factor.
- Configurable difficulty parameters should include: the key/tonality of the melody, the overall range/register of notes used, the rhythmic complexity of the melody (reusing the same kind of duration/rest/syncopation controls established in Rhythm Dictation where sensible), and the length of the melody (number of bars/notes).
- As with Rhythm Dictation, grading should be done by comparing the submitted notated melody (both pitch and rhythm) against the correct answer, with a clear visual reveal of the correct melody when the submission doesn't fully match.
- Playback controls (play, replay, stop) and a running session score should be present, consistent with every other topic.

---

## 5. Exam Mode — Expansion

Exam mode already exists for the recognition-style topics (Chord Progressions, Interval Recognition, Chord Recognition, Scales) and should be expanded to also include the newly added topics where appropriate:

- Meter Recognition should be includable as an exam question type, using the same "limited hearings, delayed feedback until the end" model as the existing recognition topics.
- Rhythm Dictation and Melodic Dictation are structurally different (graded as whole-exercise-correct rather than first-guess-scored), so their inclusion in exam mode should account for that distinction — for example, being selectable as their own question type with results reported as "matched / did not match" per question rather than blended into the first-guess accuracy statistics used by the other types.
- The exam setup should let the user choose which question types to include (any combination of the available topics), how many questions of each, repetition/spacing between hearings, and how many times each question may be replayed before answering.
- A results/review screen at the end of the exam should show a per-question comparison of the user's answer against the correct answer, for every question type included, including the newly added ones.

---

## 6. Cross-Cutting / Whole-App Requirements

- **Single unified entry point**: one application, one persistent shell (title/subtitle/navigation/exam-entry), with the syllabus-style topic menu as the primary way to move between exercises.
- **Session state per topic**: switching between topics should not corrupt or reset unrelated topics' settings or scores; each topic's configuration and running score persist independently while the app is open.
- **Consistent transport & feedback language**: initialize/play/replay/stop/submit/next controls, and right/wrong feedback with a reveal of the correct answer, should look and behave the same way across every topic — old and new.
- **No fixed "levels"**: consistent with the existing app's philosophy, every topic should offer granular, continuously adjustable settings rather than a small number of preset difficulty tiers, so a teacher or self-directed student can dial in exactly the content they want to practice.
- **Extensibility for future topics**: the categorized menu structure and the "Custom Topics" section should make it straightforward to add further topics later (e.g. additional items visible in the reference syllabus screenshot such as Chord Comparison, Chord Imitation, Chord Singing, Cluster Chords, Jazz Chords, Rhythm Comparison, Rhythm Elements, Rhythm Element Dictation, Rhythm Imitation, Rhythm Styles, Two-Part Rhythm Dictation, Rhythm Counting, Nashville Numbers, Advanced Part Dictation, Part Dictation, Phrase Structure & Form, Forms, Jazz Forms, Modulation, Melodic Motion, Pitch Comparison, Pitch Imitation, Contour, Pitch Dictation, Melodic Comparison, Note Recognition, Absolute Pitch, Atonal Melodic Dictation, Counterpoint Singing, Sight Singing, Tuning, Two-Part Melodic Dictation, Melodic Error Detection, Tonic Identification, Interval Comparison, Interval Imitation, Interval Singing, Jazz Scales, Jazz Scale Singing, and Repertoire/Musical Elements topics) without needing to redesign the navigation model itself.
- **Web accessibility**: the finished product should be usable simply by visiting a web address in a browser — no manual file-opening, no local setup — and should work sensibly on both desktop and mobile screen sizes. (How this is achieved is intentionally left open — this is a functional requirement only, not an implementation instruction.)
- **No loss of existing functionality**: everything currently working (Chord Progressions, Interval Recognition, Chord Recognition, Scales, Exam Mode, and Rhythm Dictation as found in the rhythm-focused version of the app) must continue to work exactly as it does now after reorganization — this is an expansion and reorganization project, not a rewrite-from-scratch.

---

## 7. Explicitly Out of Scope for This Spec

This document deliberately does not address: technology choices, code architecture, file/folder structure, hosting/deployment mechanics, libraries or frameworks, audio engine choices, or any other implementation detail. Those decisions are intentionally left entirely open.
