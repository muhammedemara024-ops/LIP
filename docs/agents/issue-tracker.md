# Issue Tracker & Specification Storage (`docs/agents/issue-tracker.md`)

How engineering skills (`to-spec`, `to-tickets`, `implement`, `code-review`) store and read specifications and implementation tickets in this repository.

## 1. Default Tracker: Local Markdown under `.scratch/<feature-slug>/`

By default, specifications and implementation tickets live as local Markdown files under `.scratch/<feature-slug>/`:

- **Feature directory**: `.scratch/<feature-slug>/`
- **Feature specification (`to-spec`)**: `.scratch/<feature-slug>/spec.md`
- **Implementation tickets (`to-tickets`)**: One file per vertical-slice ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01` in dependency order (blockers first), never a single combined tickets file.
- **Blocking edges**: Recorded in a `**Blocked by:**` line near the top of each ticket file (`None (can start immediately)` or ticket numbers/titles).
- **Status**: Recorded in a `**Status:**` line near the top of each ticket file (`draft`, `blocked`, `ready-for-agent`, `in-progress`, `done`). `ready-for-agent` requires the readiness check of the Implementation Task Quality Standard ([`.agents/rules/05-implementation-task-quality.md`](../../.agents/rules/05-implementation-task-quality.md)).

*(Note: When the optional Spec Kit workflow `/speckit-*` is used for large, multi-phase features, artifacts live under `specs/<NNN-feature>/` as `spec.md`, `plan.md`, and `tasks.md`.)*

## 2. Optional Tracker: GitHub Issues (Only When Explicitly Requested)

When the user explicitly requests publishing to or reading from GitHub Issues:

- Use the GitHub CLI (`gh`) against `origin` (`muhammedemara024-ops/LIP`).
- **Safety check**: This repository is a fork whose `upstream` remote points to `craveup-oss/loyalty-interchange-protocol`. Before running any `gh issue` or `gh pr` command, always pass `--repo muhammedemara024-ops/LIP` (or verify with `gh repo view --json nameWithOwner`) and **never** create issues or PRs on `craveup-oss/loyalty-interchange-protocol`.
- Do not create or modify GitHub Issues unless explicitly requested by the user.

## 3. Mandatory Approval Gates

Regardless of whether `.scratch/<feature-slug>/`, `specs/<NNN-feature>/`, or GitHub Issues is used:

- **Gate 1 (Specification Approval)**: After producing `spec.md` (`/to-spec` or `/speckit-specify`), **STOP** and obtain explicit user approval before generating tickets or implementation plans.
- **Gate 2 (Tickets / Plan Approval)**: After producing tickets (`/to-tickets`) or `plan.md` + `tasks.md` (`/speckit-plan` + `/speckit-tasks`), **STOP** and obtain explicit user approval before running `/implement` or `/speckit-implement`.
- **No Auto-Commit**: `/implement` must **never** commit, push, or deploy automatically.
