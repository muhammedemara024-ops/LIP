---

description: "LIP task list template (project override): every task carries an Implementation Task Quality Standard card"
---

# Tasks: [FEATURE NAME]

**Status**: Draft — not approved. Gate 2 (owner approval of `plan.md` and `tasks.md`) is required before `/speckit-implement`.

**Input**: Design documents from `/specs/[###-feature-name]/`. The governing documents are `AGENTS.md`, `.specify/memory/constitution.md` and `.agents/rules/` — in particular **rule 05, the Implementation Task Quality Standard**, which this template implements.

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md. Gate 1 and any owner-requested separate planning gate must be recorded as approved in the applicable artifact's Status line before task generation (AGENTS.md §5). This template does not introduce a separate planning gate.

**Tests**: Mandatory for every task (constitution Article VII; rule 03; rule 05 field 8). This overrides the generic Spec Kit note that tests are optional.

**Organization**: by user story, as `/speckit-tasks` requires. When the approved plan defines milestones, phases follow those milestones and each task keeps its `[US#]` label where it serves a user story.

<!--
  ============================================================================
  The sections and the sample task below are ILLUSTRATIVE. /speckit-tasks MUST
  replace them with real tasks derived from the approved artifacts, after
  inspecting the repository. Do not invent paths, symbols or contracts.
  Do not keep the sample task in the generated tasks.md.
  ============================================================================
-->

## Readiness summary

| Count | ready | blocked | draft | mechanical | reasoning |
| --- | --- | --- | --- | --- | --- |
| Tasks | [n] | [n] | [n] | [n] | [n] |

**Blocked by open gates** (one row per gate; never resolved inside a task):

| Gate | Source | Blocked tasks |
| --- | --- | --- |
| [OD-xx / FP-xxx gate / spike / owner approval] | [path § section] | [T###, …] |

## Task format

Header line, in the format `/speckit-tasks` requires:

`- [ ] T### [P?] [US#?] <title> in <primary path>`

Followed, indented, by the card (rule 05 §1). Write `n/a` only where a field truly does not apply:

```text
  - Readiness: ready | blocked (<gate>) | draft (<missing field>)
  - Executor: mechanical | reasoning | blocked        Risk: LOW | MEDIUM | HIGH | CRITICAL — review: <AGENTS.md §5 requirement>
  - Objective: <what and why> (FR-…, SC-…, PD-…, R-…, contract §)
  - Scope: create <new path (from plan structure)>; modify <verified path>; untouched: <paths/areas>
  - Prerequisites: <T###>; <spike/verification>; <open gates or "none">
  - Steps:
    1. <specific step>
    2. <specific step>
  - Contracts: <inputs/outputs/status+error codes, DB changes, transaction boundary, lock order> — by reference: <doc § section>
  - Invariants: <rule> (<source>); …
  - Edge cases: <case> → <required behaviour>; …
  - Tests: <unit|integration|regression|contract|negative>: <scenario> → <expected outcome> [environment]; … (a regression or contract test for every affected existing behaviour named under Compatibility)
  - Acceptance: <objective Definition of Done>; evidence: <what proves it>
  - Verify: <command> → <expected result>; report <pass/fail/skip counts, environment>
  - STOP if: <ambiguity/contradiction/mismatch/untouched-scope/open-gate conditions; any risk of breaking approved behaviour, a published contract or existing data without an authorized mitigation>; escalate to the orchestrator
  - Compatibility: impact <modules/APIs/schemas/contracts/behaviours | none: why>; compat <backward-compatible: how | approved break: <ref> + migration plan>; data <additive | expand–contract | backfill | no schema change>; perf/ops <bottleneck, load assumption + source, impact | n/a: why>; failure/rollback <modes; rollback or forward recovery; migration reversible?> (rule 01 §5, rule 05 field 13)
```

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: project initialization and basic structure, taken from the plan's project structure.

- [ ] T001 [Example — replace] Create the package skeleton in [new path from plan.md "Project Structure"]
  - Readiness: draft (example)
  - Executor: mechanical        Risk: LOW — review: optional (AGENTS.md §5)
  - Objective: …
  - (all thirteen fields, as in the card above)

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: infrastructure that MUST be complete before any user story can be implemented.

**Checkpoint**: foundation ready; user-story phases can begin.

## Phase 3+: [Milestone or User Story] — [Title] (Priority: P#)

**Goal**: [what this phase delivers]

**Independent test**: [how to verify this phase on its own]

**Checkpoint**: [what must be demonstrably true at the end of the phase]

## Gated tracks (blocked until their gates pass)

Work behind an unresolved owner decision, a fork patch that is not authorized, or a pending spike appears here **only** as `blocked` tasks naming their gates and sources. These tasks have no implementation steps. Example: a fork-patch track that is not authorized lists its gates in order, from the source, and nothing more.

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: improvements that affect several stories (documentation, observability, hardening). They are held to the same card.

## Dependencies & Execution Order

- **Phase dependencies**: [which phases block which].
- **Task dependencies**: each card's Prerequisites line is authoritative; this section summarizes it.
- **Parallel opportunities**: `[P]` tasks touch different files and have no unfinished prerequisites.
- **Executor routing**: `mechanical` tasks may go to lower-cost implementer lanes. `reasoning` tasks go to a stronger lane or the orchestrator. `blocked` tasks are not assignable. Model routing lives in `.delegate/config.json`.

## Implementation Strategy

- **MVP first**: [smallest set of phases that delivers the first independently testable increment].
- **Incremental delivery**: [order of later phases].
- **Review and approval**:
  - Each task is reviewed according to its risk level (AGENTS.md §5).
  - Gate 2, implementation, commit and push are separate owner approvals.
