# Implementation Prompt — Ear Trainer v1

Copy everything below the line into a fresh Opus 4.8 session started in this project directory (or tell it: "Read IMPLEMENTATION-PROMPT.md and follow it").

---

You are implementing **Ear Trainer v1**, a React web application whose design is fully specified in this repository. The design phase is complete: every technical decision has already been made and recorded. Your job is execution, not design.

## Read first, in this order

1. `README.md` — project map
2. `docs/00-overview-and-decisions.md` — the binding decision log (D1–D15)
3. `docs/08-implementation-plan.md` — your phase-by-phase work order
4. The other docs (`01`–`07`, `05-topics/*`) as each phase directs you to them

## Non-negotiable rules

1. **Decisions are closed.** Do not substitute libraries, versions, patterns, or structure for the ones in the decision log — even if you'd choose differently. If a decision appears genuinely unworkable in practice, stop and raise it (see Escalation) with evidence; never silently deviate.
2. **The legacy file is law** for existing behavior: `legacy/jazz-progression-trainer-rhythm.html`. When any doc is silent or ambiguous about how an existing feature behaves, open the legacy file and replicate what it does. Never port from `legacy/jazz-progression-trainer.html`.
3. **Two-tier porting protocol (D15):** framework-free logic ports verbatim into `src/lib/` (keep names, constants, algorithms; no refactors, no dedup, no React imports); UI is re-implemented as React components that reproduce legacy structure, CSS class names, control defaults, and behavior per each topic doc's parity contract.
4. **Work in strict phase order** (Phase 0 → 9). Complete each phase's gate — unit tests green, gate checklist verified, deployed — before starting the next. Report gate results honestly, including failures.
5. **No scope additions.** The out-of-scope list in `08-implementation-plan.md §5` is binding.

## Escalation: stop and ask the user

You must **stop work and ask the user** — with a clear question, the options you see, and your recommendation — whenever ANY of the following occurs. Do not guess, do not pick "the reasonable default," do not proceed provisionally:

- **Judgment calls.** The docs and the legacy file together do not determine a choice (visual detail not covered by ported CSS, ambiguous wording, conflicting requirements between docs, a behavior the legacy file implements in a way the docs contradict).
- **Dependency surprises.** A pinned version won't install, has a breaking incompatibility, or a documented API doesn't exist as described. Report the exact error; do not swap in a different version or package on your own.
- **Parity doubts.** You cannot make ported behavior match the legacy app and are considering an approximation. Describe the difference and ask before accepting it.
- **Anything destructive or irreversible** beyond normal source edits in this repo (deleting files you didn't create, force-pushes, resetting history).
- **Blocked gates.** A phase gate fails and the fix isn't obvious after a genuine attempt. Present what failed, what you tried, and options.

When asking, be specific: one message, the decision needed, 2–4 options, your recommendation and why. Then wait.

## Manual work: the user does all account/cloud/external setup

You must never create accounts, provision cloud resources, enter credentials, accept terms of service, or configure third-party services. When a phase needs any of the following, **pause and hand the user precise step-by-step instructions** (portal clicks or exact CLI commands they run themselves), tell them exactly what result/value you need back, and wait for confirmation before continuing:

- **GitHub:** creating the repository, adding the remote URL, any repository settings or secrets. (You may run local `git init`/commits yourself; ask before the first push once the user has created the repo.)
- **Azure:** creating the Static Web App resource, connecting it to the GitHub repo, anything involving `az login`, subscriptions, or the Azure portal — follow the runbook in `docs/07-deployment-azure-swa.md` and adapt your instructions to it.
- **Secrets/tokens:** the SWA deployment token / GitHub Actions secrets — tell the user where to put them; never ask them to paste secret values into the chat.
- **Custom domain / DNS** (only if the user requests it; it's deferred in v1).
- Any other external service that may appear.

Local, non-account work you do yourself without asking: scaffolding, coding, unit tests, local builds and dev-server verification, and downloading the 17 public Salamander sample files per `docs/03-audio-engine.md §2` (announce it when you do it).

## Working style

- Track your progress against the phase plan; state which phase and step you're on when reporting.
- After each phase gate passes, give a short summary: what was built, gate results, anything the user should manually verify in the browser (especially audio behavior — you cannot hear it, so at each audio-relevant gate, list the specific listening checks the user should perform, e.g. "does the count-in accent the downbeat?").
- Commit locally at meaningful checkpoints with clear messages; one phase = at least one commit.
- If a session ends mid-phase, leave a `PROGRESS.md` note at the repo root stating exactly where you stopped and what's next.

Begin with Phase 0 from `docs/08-implementation-plan.md`. Its first steps (Vite scaffold, dependencies, tests wiring) are local work you can start immediately; the GitHub/Azure steps in Phase 0 are the first point where you'll pause and hand the user setup instructions.
