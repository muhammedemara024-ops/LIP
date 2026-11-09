---
name: ask-matt
description: Ask which skill or flow fits your situation. A router over the skills in this repo.
---

# Ask Matt

You don't remember every skill, so ask.

Before stating what a skill does or recommending a step be skipped, read that skill's SKILL.md: the summaries here are for orientation only.

> **LIP Repository Configuration (`AGENTS.md`)**:
> - **Domain & Decisions**: Configured in [`docs/agents/domain.md`](../../../docs/agents/domain.md) (`docs/context/05-glossary.md`, `docs/context/01-decisions.md`, `docs/context/04-business-rules.md`, `docs/context/07-fork-patches.md`). Never create a root `GLOSSARY.md` or `docs/adr/`.
> - **Issue Tracker**: Configured in [`docs/agents/issue-tracker.md`](../../../docs/agents/issue-tracker.md) (defaults to local Markdown files under `.scratch/<feature-slug>/`).
> - **Optional Spec Kit Workflow**: For large, complex multi-phase features, Spec Kit (`/speckit-specify` → `/speckit-clarify` → `/speckit-plan` → `/speckit-checklist` → `/speckit-tasks` → `/speckit-analyze` → `/speckit-implement`) is also installed under `.agents/skills/speckit-*`.
> - **Mandatory Gates & No Auto-Commit**: Tier 2 (Root Cause + Test Plan) and Tier 3 (Gate 1 Spec + Gate 2 Tickets/Plan) user approval gates always apply, and `/implement` never commits automatically.

A **flow** is a path through the skills. Most paths run along one **main flow**, and on-ramps merge onto it. Everything else is standalone, or a vocabulary layer that runs underneath.

## The main flow: idea → ship

The route most work travels. You have an idea and want it built.

1. **`/grill-with-docs`** sharpens the idea by interview. Start here whenever you are **working in a working directory**: it's stateful, retaining what it learns in `docs/context/05-glossary.md` and `docs/context/01-decisions.md` per `docs/agents/domain.md`. (Antigravity's native `/grill-me` slash command can also be used for interactive design alignment.)
2. **Branch: can you settle every question in conversation?** If a question needs a runnable answer (state, business logic, a UI you have to see), detour through a prototype, bridged by **`/handoff`** in both directions:
   - **`/handoff`** out, then open a fresh session against that file,
   - **`/prototype`** to answer the question with throwaway code,
   - **`/handoff`** back what you learned, and reference it from the original idea thread.
3. **Spec, Tickets, & Approval Gates (`AGENTS.md` Section 5)**:
   - **`/to-spec`** turns the thread into `.scratch/<feature-slug>/spec.md`, then **pauses at Gate 1** for explicit user approval.
   - **`/to-tickets`** splits the approved spec into tracer-bullet tickets under `.scratch/<feature-slug>/issues/<NN>-<slug>.md` with blocking edges and agreed test seams, then **pauses at Gate 2** for explicit user approval.
   - **`/implement`** executes the approved ticket(s) by driving **`/tdd`** (one red-green slice at a time at agreed seams) and closes out with **`/code-review`**, a two-axis review (Standards + Spec) of the diff, then **stops without committing** to report verification results.

   Reach for **`/tdd`** on its own when you want to build a concrete behaviour test-first at agreed seams, and **`/code-review`** on its own whenever you want to review a branch or working tree against a fixed point.

   When the work goes up as a pull request (upon explicit user request), **`/pr`** shapes the body: the smallest visual that shows the change, before/after evidence that it works, and a one-way or two-way door call.

4. **`/retro`** closes the loop. After a build, and especially one that went sideways, it looks back over the session and suggests changes to the agent's **environment**, not the code: navigation pointers, automated checks, the coding standards `/code-review` enforces, steering files, tooling.

### Context hygiene

Keep steps 1–3 in **one unbroken context window** (don't compact or clear until after `/to-tickets`) so the grilling, spec, and tickets all build on the same thinking. Each `/implement` can then start fresh, working from the ticket.

The limit on this is the **[smart zone](https://www.aihero.dev/ai-coding-dictionary/smart-zone)**: the window (~150k tokens on state-of-the-art models) within which the model still reasons sharply. If a session approaches it before `/to-tickets`, `/compact` at the nearest phase boundary and carry on (see Phase boundaries).

## On-ramps

A starting situation that generates work, then merges onto the main flow.

- **Something's broken (Tier 2 Bug Fix)** → **`/diagnosing-bugs`**. For the hard ones: the bug that resists a first glance, the intermittent flake, the regression that crept in between two known-good states. It refuses to theorise until it has a **tight feedback loop** (one command that already goes red on *this* bug), isolates root cause, **pauses at the LIP Tier 2 Approval Gate**, and then fixes with a regression test. Once the fix is in, run **`/retro`** in the same session to ask what would have prevented the bug; where the real finding is that there's no good seam to lock it down, that's a job for **`/improve-codebase-architecture`**.
- **Large, complex multi-phase features** → Either use the default Matt Pocock flow (`/grill-with-docs` → `/to-spec` → Gate 1 → `/to-tickets` → Gate 2 → `/implement`) or the optional **Spec Kit** flow (`/speckit-specify` → `/speckit-clarify` → Gate 1 → `/speckit-plan` → `/speckit-checklist` → `/speckit-tasks` → `/speckit-analyze` → Gate 2 → `/speckit-implement`).

## Codebase health

Not feature work, just upkeep.

- **`/improve-codebase-architecture`** runs whenever you have a spare moment to keep the codebase good for agents to operate in. It surfaces **deepening opportunities**; picking one _generates an idea_ you can take into the main flow at `/grill-with-docs`. It's the survey that finds the candidates; **`/codebase-design`** (below) is the bench you design the chosen one on.

## Vocabulary underneath

Two model-invoked references that run *beneath* the other skills, each the single source of truth for its vocabulary. Reach for them directly when the **words**, not the process, are the problem; or let the skills above pull them in.

- **`/domain-modeling`**: sharpen the project's *domain* language in `docs/context/05-glossary.md` and `docs/context/01-decisions.md` per `docs/agents/domain.md`.
- **`/codebase-design`** is the deep-module vocabulary (module, interface, depth, seam, adapter, leverage, locality) for designing a module's *shape*: a lot of behaviour behind a small interface at a clean seam. `/tdd` and `/improve-codebase-architecture` both speak it.

## Phase boundaries

A **phase** is a chunk of work inside a session: the grilling, the implementation, the QA. At the **boundary** between two of them you have five options:

- **Continue**: stay put. Costs nothing, loses nothing.
- **Clear / New Conversation**: start a fresh window when nothing here matters to what's next.
- **`/handoff`** writes a portable markdown file in the OS temp directory.
- **Subagent**: send a tightly-scoped task to its own window (`invoke_subagent`) and get a report back.
- **`/compact`** compresses this context.

Read [PHASE-BOUNDARIES.md](PHASE-BOUNDARIES.md) for the ordered decision tree.

## Standalone

Off the main flow entirely.

- **`/grilling`** is the interview primitive itself: rounds, the frontier, facts are the agent's job and decisions are yours.
- **`/prototype`** is a small, throwaway program that answers one design question: does this state model feel right, or what should this UI look like.
- **`/research`**: delegate reading legwork to a **background agent**: it investigates a question against **primary sources**, then leaves a cited Markdown file in the repo.
- **`/wait-what`** is the corrective for a message that didn't land. Use it mid-conversation, inside any other skill, and the agent re-pitches what it just said with the context you were missing, in plain English, using the `docs/context/05-glossary.md` vocabulary.
