---
name: to-tickets
description: Break a plan, spec, or the current conversation into a set of tracer-bullet tickets, each declaring its blocking edges, published to the configured tracker (edges as text in one file per ticket locally, or native blocking links on a real tracker).
---

# To Tickets

Break a plan, spec, or conversation into a set of **tickets**: tracer-bullet vertical slices, each declaring the tickets that **block** it.

Read `docs/agents/domain.md` and `docs/agents/issue-tracker.md` for this repository's configured domain vocabulary and tracker locations:
- **Glossary**: `docs/context/05-glossary.md`
- **Decisions**: `docs/context/01-decisions.md`
- **Business Rules**: `docs/context/04-business-rules.md`
- **Default Tracker**: `.scratch/<feature-slug>/issues/<NN>-<slug>.md` (use GitHub Issues only when explicitly requested by the user).

## Process

### 1. Gather context

Work from whatever is already in the conversation context. Confirm that **Gate 1 (Specification Approval)** has been approved by the user per `AGENTS.md`. If the user passes a reference (a spec path such as `.scratch/<feature-slug>/spec.md`, an issue number, or a URL) as an argument, read its full body.

### 2. Explore the codebase (optional)

If you have not already explored the codebase, do so to understand the current state of the code. Ticket titles and descriptions should use the project's domain glossary vocabulary (`docs/context/05-glossary.md`), and respect **Approved** decisions in `docs/context/01-decisions.md` and rules in `docs/context/04-business-rules.md`.

Look for opportunities to prefactor the code to make the implementation easier. "Make the change easy, then make the easy change."

### 3. Draft vertical slices

Break the work into **tracer bullet** tickets.

<vertical-slice-rules>

- Each slice cuts a narrow but COMPLETE path through every layer (schema, API, UI, tests): vertical, NOT a horizontal slice of one layer
- A completed slice is demoable or verifiable on its own
- Each slice is sized to fit in a single fresh context window
- Any prefactoring should be done first

</vertical-slice-rules>

Give each ticket its **blocking edges**: the other tickets that must complete before it can start. A ticket with no blockers can start immediately.

**Wide refactors are the exception to vertical slicing.** A **wide refactor** is one mechanical change (rename a column, retype a shared symbol) whose **blast radius** fans across the whole codebase, so a single edit breaks thousands of call sites at once and no vertical slice can land green. Don't force it into a tracer bullet; sequence it as **expand–contract**. First expand: add the new form beside the old so nothing breaks. Then migrate the call sites over in batches sized by blast radius (per package, per directory), each batch its own ticket blocked by the expand, keeping CI green batch to batch because the old form still exists. Finally contract: delete the old form once no caller remains, in a ticket blocked by every migrate batch. When even the batches can't stay green alone, keep the sequence but let them share an integration branch that all block a final integrate-and-verify ticket; green is promised only there.

### 4. Quiz the user

Present the proposed breakdown as a numbered list. For each ticket, show:

- **Title**: short descriptive name
- **Blocked by**: which other tickets (if any) must complete first
- **What it delivers**: the end-to-end behaviour this ticket makes work

Ask the user:

- Does the granularity feel right? (too coarse / too fine)
- Are the blocking edges correct: does each ticket only depend on tickets that genuinely gate it?
- Should any tickets be merged or split further?

Iterate until the user approves the breakdown.

### 5. Publish the tickets to the configured tracker (`docs/agents/issue-tracker.md`)

Publish the approved tickets:

- **Local files (Default)** → write one file per ticket under `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01` in dependency order (blockers first). Each file's "Blocked by" lists the numbers/titles it depends on. Use the per-ticket file template below: one ticket per file, never a single combined file.
- **GitHub Issues (Only when explicitly requested by the user)** → publish one issue per ticket in dependency order (blockers first) so each ticket's blocking edges can reference real identifiers. Apply the `ready-for-agent` triage label only to a ticket that passes rule 05's readiness check (§4). Otherwise label it `blocked` or `draft` and state the reason in the issue.

Work the **frontier**: any ticket whose blockers are all done. For a purely linear chain that means top to bottom.

Do NOT close or modify any parent issue.

**GATE 2 — Tickets & Test Seams Approval (`AGENTS.md` / Constitution Article IX)**: Stop after writing the tickets and wait for explicit user approval of the tickets and test seams before running `/implement`.

**LIP Implementation Task Quality Standard** (`.agents/rules/05-implementation-task-quality.md`):
- Every ticket carries the rule 05 card below its "What to build" line.
- A ticket is `ready-for-agent` only when it passes the rule 05 readiness check. Otherwise its Status is `draft`, or `blocked` with the gate named.
- Never resolve an open decision (`OD-xx`) or a fork-patch gate that is not authorized inside a ticket.

<local-ticket-template>

# <NN>: <Ticket title>

**What to build:** the end-to-end behaviour this ticket makes work, from the user's perspective, not a layer-by-layer implementation list.

**Blocked by:** the numbers/titles of the tickets that gate this one, or "None (can start immediately)".

**Status:** ready-for-agent | draft (<missing field>) | blocked (<gate>)

**Executor:** mechanical | reasoning | blocked — **Risk:** LOW | MEDIUM | HIGH | CRITICAL (review per `AGENTS.md` §5)

- **Objective:** what and why, citing requirement IDs.
- **Scope:** verified paths to modify; new paths, with their source; what stays untouched.
- **Prerequisites:** blocking tickets, spikes, open gates.
- **Implementation steps:** small, ordered, specific steps.
- **Contracts:** inputs, outputs, errors, DB changes, transaction boundaries, given by reference to doc sections.
- **Invariants:** security, tenancy, accounting, idempotency, concurrency and recovery rules, each with its source.
- **Edge cases:** each case → its required behaviour.
- **Tests:** each scenario → its expected outcome (unit, integration, regression, contract, negative), including a regression or contract test for every affected existing behaviour.
- **Verification:** commands → expected results; what to report.
- **STOP if:** the conditions under which the implementer escalates instead of guessing, including any risk of breaking approved behaviour, a published contract or existing data without an authorized mitigation.
- **Compatibility and evolution:** affected modules, APIs, schemas, contracts and existing behaviours; backward compatibility, or the approved break and its migration plan; data evolution; performance and operations; failure modes and rollback (rule 01 §5, rule 05 field 13).

- [ ] Acceptance criterion 1 (objective, with evidence)
- [ ] Acceptance criterion 2

</local-ticket-template>

<issue-template>

## Parent

A reference to the parent issue on the tracker (if the source was an existing issue, otherwise omit this section).

## What to build

The end-to-end behaviour this ticket makes work, from the user's perspective, not layer-by-layer implementation.

## Task card

**Status:** `ready-for-agent`, `blocked` or `draft`, with the reason. `ready-for-agent` only if rule 05's readiness check passes.

All thirteen rule 05 fields, exactly as in the local ticket template above, including **Compatibility and evolution** (rule 01 §5, rule 05 field 13). Every affected existing behaviour must map to a regression or contract test.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Blocked by

- A reference to each blocking ticket, or "None (can start immediately)". Omit this section when blockers were set as native edges.

</issue-template>

In either form, avoid code snippets: they go stale fast. Name file paths only as rule 05 requires: existing paths verified in the repository, and new paths taken from the approved plan and marked as new. Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), inline it and note briefly that it came from a prototype. Trim to the decision-rich parts, not a working demo, just the important bits.
