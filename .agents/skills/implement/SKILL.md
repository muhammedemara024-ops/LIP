---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
---

Implement the work described by the user in the spec or tickets.

## LIP Repository Governance & Preconditions

Before modifying any code:
1. Verify that **Gate 1 (Specification Approval)** and **Gate 2 (Tickets / Plan & Test Seams Approval)** have been explicitly approved by the user per `AGENTS.md` and `.specify/memory/constitution.md` (Article IX).
2. Read `docs/agents/domain.md` (`docs/context/05-glossary.md`, `docs/context/01-decisions.md`, `docs/context/04-business-rules.md`, `docs/context/07-fork-patches.md`) and `docs/agents/issue-tracker.md`.
3. If the user passes a ticket or spec reference, read it from `.scratch/<feature-slug>/` (or `specs/<NNN-feature>/` or GitHub Issues if explicitly specified) and state its title before starting. If the reference is ambiguous, ask.

## Execution

0. Execute only tasks or tickets marked ready under the Implementation Task Quality Standard (`.agents/rules/05-implementation-task-quality.md`), within their stated scope. If any of the task's **STOP if** conditions occurs, or the task leaves a design or business decision open, stop and escalate to the orchestrator instead of guessing. Before changing code, check the card's **Compatibility and evolution** field (rule 05 field 13, rule 01 §5) against the repository. Confirm every affected existing behaviour and contract it names, and write or locate their regression and contract tests first. If the field is missing or wrong, or the change would break approved behaviour, a published contract or existing data without an authorized mitigation, STOP and escalate.
1. Follow the `tdd` skill (`.agents/skills/tdd/SKILL.md`) where possible, testing strictly at the pre-agreed seams.
2. Run typechecking (`npm run typecheck`) regularly, single test files regularly, and the required verification suite (`npm run typecheck`, `npm run docs:check`, `npm run launch:check`, `npm run public-safety:check`, `npm test`) at the end.
3. If any upstream LIP code or behavior is modified, log the patch in `docs/context/07-fork-patches.md`.
4. Once done, follow the `code-review` skill (`.agents/skills/code-review/SKILL.md`) to review the work along both the **Standards** and **Spec** axes.
5. **NEVER commit, push, or deploy automatically.** Stop after verification and code review, report the exact verification results and the compatibility evidence (affected behaviours and their tests, migration and rollback notes), and wait for explicit user authorization before committing.
