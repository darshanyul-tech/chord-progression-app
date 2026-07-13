# Ear Trainer

Browser-based ear training and musicianship platform — an expansion and reorganization of an existing single-file trainer into a syllabus-organized web app hosted on Azure Static Web Apps.

## Status

**Design phase complete — implementation not started.** All technical decisions are made and binding; see the docs below.

## For the implementing agent — start here

**If you were pointed at this repo to build it: read and follow [`IMPLEMENTATION-PROMPT.md`](IMPLEMENTATION-PROMPT.md).** It defines your working rules, escalation protocol, and starting point. Then:

1. Read `docs/00-overview-and-decisions.md` (decision log — nothing in it is open for debate).
2. Follow `docs/08-implementation-plan.md` phase by phase; each phase names the detailed docs it needs.
3. `legacy/jazz-progression-trainer-rhythm.html` is the canonical source for ALL existing functionality — port from it verbatim per the porting protocol. The other legacy file is reference-only.

## Document map

| Path | Contents |
|---|---|
| `docs/spec/ear-trainer-feature-spec.md` | Functional requirements (the "what") |
| `docs/00-overview-and-decisions.md` | Decision log + legacy-app analysis |
| `docs/01-architecture.md` | Modules, registry, routing, state, persistence |
| `docs/02-ui-shell-and-navigation.md` | Shell, syllabus menu, topic inventory, design tokens |
| `docs/03-audio-engine.md` | Tone.js, samples, scheduling patterns |
| `docs/04-notation-engine.md` | SVG staff port + pitched-staff extension |
| `docs/05-topics/` | Seven per-topic implementation plans |
| `docs/06-exam-mode.md` | Exam port + expansion |
| `docs/07-deployment-azure-swa.md` | Azure SWA + CI/CD runbook |
| `docs/08-implementation-plan.md` | Phase order, gates, regression checklist |

## Stack (decided)

React 19 + TypeScript (strict) · Vite · React Router 7 (hash) · Zustand 5 (persisted settings) · Tone.js 14.8.49 (pinned) · self-hosted Salamander piano samples · custom SVG rhythm staff (ported) + VexFlow 5.0.0 pitched staff · Vitest + React Testing Library · Azure Static Web Apps (Free) via GitHub Actions.

Existing functionality is preserved via a two-tier porting protocol: framework-free logic (theory, generators, graders, audio scheduling, rhythm staff) is ported verbatim into `src/lib/`; UI is re-implemented as React components against per-topic parity contracts. See decision log D15.
