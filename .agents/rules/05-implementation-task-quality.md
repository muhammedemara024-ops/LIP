---
trigger: always_on
description: Implementation Task Quality Standard — every implementation task or ticket must be explicit and self-contained enough for a lower-cost coding model to execute without making architectural or business decisions
---

# Implementation Task Quality Standard

Applies to every workflow that produces implementation work items:
- `/speckit-tasks` → `specs/<NNN-feature>/tasks.md` (through `.specify/templates/overrides/tasks-template.md`);
- `to-tickets` → `.scratch/<feature-slug>/issues/`;
- any task or brief written for a delegate implementer lane (`AGENTS.md` §5).

`/speckit-analyze`, `code-review` and the reviewers check work items against this standard. This standard overrides any generic skill or template instruction that conflicts with it. Examples:
- "tests are optional";
- "avoid file paths";
- a one-line task with no task card.

**Goal:** a lower-cost coding model can execute each `ready` task reliably, with no architectural or business decision left to it. Anything such a model would have to decide must already be decided in the task, or the task is not ready.

## 1. Required task card

Each task keeps its tool-required header line (for Spec Kit: `- [ ] T### [P?] [US#?] <title> in <primary path>`). Below the header it carries a card with all thirteen fields. Write "n/a" only where a field truly does not apply.

1. **Objective:** what to implement and why, citing the requirement IDs (FR-, SC-, PD-, R-, contract section).
2. **Scope:**
   - Files and modules to create or modify. Existing paths must be verified in the repository; new paths must come from the plan's project structure and be marked *new*.
   - What must remain untouched.
3. **Prerequisites:**
   - Blocking tasks.
   - Required spikes or verifications.
   - Every unresolved decision gate the task depends on (open `OD-xx`, fork-patch gates, owner approvals).
4. **Implementation steps:** small, ordered, technically specific steps. Banned phrases include "implement the feature", "handle errors appropriately", "add validation as needed", "follow best practices" and "etc.".
5. **Contracts:**
   - Inputs, outputs and API responses with status and error codes.
   - Database changes (tables, constraints, indexes, RLS), transaction boundaries and lock order.
   - Give these by reference to the exact section of the approved contract or data model, not copied, unless the task narrows them.
6. **Invariants:** the security, tenant-isolation, accounting, idempotency, concurrency and recovery rules this task must never violate, each cited to its source.
7. **Edge cases:** missing records, duplicates, timeouts, retries, crashes, races and invalid states, each with the required behaviour.
8. **Tests:** exact unit, integration, regression and negative scenarios with expected outcomes. Name the environment where it matters, for example Linux + PostgreSQL 17 (rule 03). Tests are mandatory, never optional. They include a regression test for every affected existing behaviour named in field 13 and a contract test for every changed or added API, schema or contract (rule 01 §5).
9. **Acceptance criteria:** an objective Definition of Done and the evidence required to show it.
10. **Verification:** the commands to run, their expected results, and what to report (exact pass/fail/skip counts, rule 03).
11. **Failure handling (STOP conditions):** the situations in which the implementer must stop and escalate instead of guessing. Always include these:
    - a contract or document is ambiguous or contradicts another;
    - a needed file, symbol or behaviour differs from what the task states;
    - an invariant or test cannot be satisfied as written;
    - the change would touch an untouched-scope item, an upstream LIP file not named in the task, or an unresolved gate;
    - the change risks breaking approved behaviour, a published contract or existing data without an authorized mitigation (rule 01 §5).
12. **Risk and review:**
    - Risk level (LOW / MEDIUM / HIGH / CRITICAL) by potential impact.
    - The review required under `AGENTS.md` §5.
    - The **executor class** (§3).
13. **Compatibility and evolution** (rule 01 §5):
    - **Impact:** the affected modules, APIs, schemas and migrations, contracts and existing behaviours, each with a verified path or contract section. "None" must be stated and justified.
    - **Compatibility:** backward-compatible (state how), or the approved breaking change (decision or artifact reference) and its migration plan.
    - **Data evolution:** the migration approach (additive, expand–contract, backfill) and how existing data is preserved, or "no schema change".
    - **Performance and operations:** the realistic bottleneck, the load assumption with its source, and the operational impact; or "n/a" with the reason.
    - **Failure and rollback:** failure modes, rollback or forward-recovery steps, and whether any migration is reversible.
    - Every affected existing behaviour maps to a regression or contract test in field 8.

## 2. Decomposition rules

- **Small and verifiable.** One coherent change per task that a single verification run can prove, sized for one fresh context window.
- **Decide first.** Design decisions are separated from mechanical implementation; architectural ambiguity is resolved before a task is assigned to a lower-cost model.
- **No hidden approvals.** A proposed or open decision (`OD-xx`) never becomes an approved default inside a task. A task that depends on one is `blocked` and names it.
- **Gated work stays gated.** Fork patches recorded as not authorized (for example **FP-003**) and every owner authorization gate are preserved:
  - no task implements, schedules or presumes them;
  - gated tracks appear only as `blocked` tasks naming their gates.
- **Reference, don't copy.** Cite approved governance, contracts and architecture documents by path and section instead of pasting them into every task.
- **Inspect, don't invent.** Do not invent file paths, symbols or technical contracts. Inspect the repository first, and take new structure only from the approved plan.
- **Precise criteria.** Prefer testable acceptance criteria to long explanations.
- **Additive first.** Sequence a breaking or wide change as expand–contract. Never bundle an unapproved break into a task (rule 01 §5).

## 3. Executor class (model routing stays in `.delegate/config.json`)

Each task declares one class:

- **`mechanical`:** fully specified; eligible for lower-cost implementer lanes.
- **`reasoning`:** needs a stronger model or the orchestrator. Default for:
  - concurrency, locking, transaction boundaries and recovery;
  - RLS and authorization;
  - ledger and accounting logic;
  - security primitives;
  - upstream LIP or fork-patch changes;
  - migrations on existing data;
  - anything whose correctness cannot be fully pinned by the task's tests.

  Such a task may be `mechanical` only if its card fully pins the algorithm and its tests.
- **`blocked`:** has an unresolved prerequisite gate; not assignable.

## 4. Readiness check

A task may be marked `ready` (Spec Kit) or `ready-for-agent` (tickets) only when all of these hold:
- all thirteen fields are complete;
- field 13 names every affected existing behaviour, and each one maps to a test in field 8;
- the task contains no breaking change that lacks owner approval and a migration plan;
- no prerequisite gate is open;
- every existing path has been verified;
- every contract reference resolves.

Otherwise mark it `draft` or `blocked` with the reason.

A task list reports these counts: `ready` / `blocked` / `draft` tasks, and `mechanical` / `reasoning` tasks. Reaching the end of task generation is not approval: Gate 2 still applies (`AGENTS.md` §5).

**Transition (2026-11-13).** Field 13 was added on 2026-11-13. A task or ticket written earlier stays `blocked` or `draft` until field 13 is added and reviewed under `AGENTS.md` §5. Adding it never widens the task's approved scope. If the analysis finds an unapproved break, the task stays blocked and is escalated.
