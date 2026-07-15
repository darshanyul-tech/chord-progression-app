# Ear Trainer

Browser-based ear training and musicianship platform for interval, chord, scale, meter,
rhythm, and melodic recognition, plus a timed exam mode. React 19 + TypeScript, hosted on
Azure Static Web Apps.

## Status

**v1.0.0 shipped.** Seven topics are active (Interval Recognition, Scales, Chord
Recognition, Meter Recognition, Rhythm Dictation, Chord Progressions, Melodic Dictation),
alongside exam mode with recognition and dictation question types. Everything else in the
syllabus is a parked placeholder — see `docs/09-improvement-plan.md` for what's next.

## Getting started

```bash
npm install
npm run dev       # local dev server, http://localhost:5173
npm test          # vitest, watch mode (npx vitest run for a single pass)
npm run lint      # eslint
npm run build     # tsc -b && vite build -> dist/
npm run preview   # serve the production build locally
```

Node 20+ recommended (matches the Azure SWA GitHub Actions runner).

## Architecture, in one paragraph

Topics are self-registering entries in `src/topics/registry.ts` (`TopicDefinition`): each
active one contributes a Tier-2 React component and, optionally, an exam type. Tier-1 logic
(`src/lib/`) is framework-free, unit-tested, and shared between a topic's own practice mode
and its exam-mode question builder/grader. All active topics stay mounted simultaneously
(`TopicHost`) so switching between them never loses in-progress state; settings persist
per-topic to `localStorage` under `eartrainer.v1.settings.<topicId>`. See
`docs/01-architecture.md` for the full picture.

## Document map

| Path | Contents |
|---|---|
| `docs/00-overview-and-decisions.md` | Binding decision log (D1–D15) + legacy-app analysis |
| `docs/01-architecture.md` | Modules, registry, routing, state, persistence |
| `docs/02-ui-shell-and-navigation.md` | Shell, syllabus menu, topic inventory, design tokens |
| `docs/03-audio-engine.md` | Tone.js, samples, scheduling patterns |
| `docs/04-notation-engine.md` | SVG rhythm staff + VexFlow pitched staff |
| `docs/05-topics/` | Per-topic implementation specs |
| `docs/06-exam-mode.md` | Exam mode: recognition + dictation question types |
| `docs/07-deployment-azure-swa.md` | Azure SWA + CI/CD runbook |
| `docs/08-implementation-plan.md` | Phases 0–9 (the original build), gates, regression checklist |
| `docs/09-improvement-plan.md` | Phases 10–16 (current roadmap): polish, perf, a11y, tests/CI, mic-based Interval Singing |
| `legacy/jazz-progression-trainer-rhythm.html` | Canonical legacy source everything here was ported from |
| `IMPLEMENTATION-PROMPT.md` | Historical: the original from-scratch build brief (Phases 0–9 are done; kept for context, not a live instruction set) |

## Stack

React 19 + TypeScript (strict) · Vite · React Router 7 (hash routing) · Zustand 5
(persisted settings) · Tone.js 14.8.49 (pinned) · self-hosted Salamander piano samples ·
custom SVG rhythm staff (ported) + VexFlow 5.0.0 pitched staff · Vitest + React Testing
Library · Azure Static Web Apps (Free tier) via GitHub Actions.

Existing functionality was preserved via a two-tier porting protocol: framework-free logic
(theory, generators, graders, audio scheduling) lives in `src/lib/`, ported near-verbatim
from the legacy file; UI is a parity re-implementation as React components. See decision
log D15 in `docs/00-overview-and-decisions.md`.
