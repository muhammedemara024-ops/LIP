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

1. Follow the `tdd` skill (`.agents/skills/tdd/SKILL.md`) where possible, testing strictly at the pre-agreed seams.
2. Run typechecking (`npm run typecheck`) regularly, single test files regularly, and the required verification suite (`npm run typecheck`, `npm run docs:check`, `npm run launch:check`, `npm run public-safety:check`, `npm test`) at the end.
3. If any upstream LIP code or behavior is modified, log the patch in `docs/context/07-fork-patches.md`.
4. Once done, follow the `code-review` skill (`.agents/skills/code-review/SKILL.md`) to review the work along both the **Standards** and **Spec** axes.
5. **NEVER commit, push, or deploy automatically.** Stop after verification and code review, report the exact verification results, and wait for explicit user authorization before committing.
