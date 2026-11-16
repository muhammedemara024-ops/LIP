---
name: code-review
description: "Review the changes since a fixed point (commit, branch, tag, or merge-base) along two axes: Standards (does the code follow this repo's documented coding standards?) and Spec (does the code match what the originating issue/spec asked for?). Runs both reviews in parallel sub-agents and reports them side by side. Use when the user wants to review a branch, a PR, work-in-progress changes, or asks to \"review since X\"."
---

Two-axis review of the diff between `HEAD` and a fixed point the user supplies:

- **Standards**: does the code conform to this repo's documented coding standards?
- **Spec**: does the code faithfully implement the originating issue / spec?

Both axes run as **parallel sub-agents** so they don't pollute each other's context, then this skill aggregates their findings. Start every sub-agent with a fresh context window.

Read `docs/agents/domain.md` and `docs/agents/issue-tracker.md` for this repository's configured tracker and standards locations.

## Process

### 1. Pin the fixed point

Whatever the user said is the fixed point (a commit SHA, branch name, tag, `main`, `HEAD~5`, etc.). If they didn't specify one, ask for it.

Capture the diff command once: `git diff <fixed-point>...HEAD` (three-dot, so the comparison is against the merge-base; or `git diff <fixed-point>` if reviewing uncommitted working-tree changes). Also note the list of commits via `git log <fixed-point>..HEAD --oneline`.

Before going further, confirm the fixed point resolves (`git rev-parse <fixed-point>`) and the diff is non-empty. A bad ref or empty diff should fail here, not inside two parallel sub-agents.

### 2. Identify the spec source

Look for the originating approved spec per `docs/agents/issue-tracker.md`, in this order:

1. A path the user passed as an argument.
2. A local spec file under `.scratch/<feature-slug>/spec.md` (and tickets under `.scratch/<feature-slug>/issues/*.md`) or `specs/<NNN-feature>/spec.md` matching the feature or branch.
3. Issue references in the commit messages (`#123`, `Closes #45`, etc.), fetched via `docs/agents/issue-tracker.md` if GitHub Issues were used.
4. If nothing is found, ask the user where the spec is. If they say there isn't one, the **Spec** sub-agent will skip and report "no spec available".

### 3. Identify the standards sources

Always include this repository's authoritative standards files in the **Standards** axis:
- `AGENTS.md`
- `.specify/memory/constitution.md`
- `.agents/rules/01-architecture-and-upstream.md`
- `.agents/rules/02-security-and-tenant-isolation.md`
- `.agents/rules/03-testing-and-verification.md`
- `.agents/rules/04-git-and-deployment-governance.md`
- `.agents/rules/05-implementation-task-quality.md` (the task card, including field 13)
- `docs/context/01-decisions.md`
- `docs/context/04-business-rules.md`
- `docs/context/07-fork-patches.md` (verify upstream LIP changes are logged)

Also search the repo for any additional `CODING_STANDARDS.md` or `CONTRIBUTING.md` files.

The Standards axis always applies the **compatibility and evolution checklist** of rule 01 §5. When the diff touches an API, schema, migration, contract or existing behaviour, each unmet item is a **hard** finding, not a judgement call:

1. An impact inventory exists (task card field 13 or the Tier 2 fix plan) and matches the diff.
2. Existing API responses, wire semantics, persisted data and approved behaviour are unchanged, or the break is owner-approved and has a migration plan.
3. Migrations are additive or expand–contract, idempotent and concurrency-safe, and preserve existing data. New tenant tables have RLS.
4. The tenant-isolation, ledger-immutability, authorization, concurrency and idempotency invariants hold.
5. Every affected existing behaviour has a regression test and every changed contract a contract test. No existing test was weakened or deleted to pass.
6. No speculative abstraction or premature service exists without a cited requirement.
7. Performance and operational impact are stated where they apply.
8. Failure modes and rollback or recovery are documented.

On top of whatever the repo documents, the Standards axis always carries the **smell baseline** below: a fixed set of Fowler code smells (_Refactoring_, ch.3) that applies even when a repo documents nothing. Two rules bind it:

- **The repo overrides.** A documented repo standard always wins; where it endorses something the baseline would flag, suppress the smell.
- **Always a judgement call.** Each smell is a labelled heuristic ("possible Feature Envy"), never a hard violation. Like any standard here, skip anything tooling already enforces.

Each smell reads *what it is* → *how to fix*; match it against the diff:

- **Mysterious Name**: a function, variable, or type whose name doesn't reveal what it does or holds. → rename it; if no honest name comes, the design's murky.
- **Duplicated Code**: the same logic shape appears in more than one hunk or file in the change. → extract the shared shape, call it from both.
- **Feature Envy**: a method that reaches into another object's data more than its own. → move the method onto the data it envies.
- **Data Clumps**: the same few fields or params keep travelling together (a type wanting to be born). → bundle them into one type, pass that.
- **Primitive Obsession**: a primitive or string standing in for a domain concept that deserves its own type. → give the concept its own small type.
- **Repeated Switches**: the same `switch`/`if`-cascade on the same type recurs across the change. → replace with polymorphism, or one map both sites share.
- **Shotgun Surgery**: one logical change forces scattered edits across many files in the diff. → gather what changes together into one module.
- **Divergent Change**: one file or module is edited for several unrelated reasons. → split so each module changes for one reason.
- **Speculative Generality**: abstraction, parameters, or hooks added for needs the spec doesn't have. → delete it; inline back until a real need shows.
- **Message Chains**: long `a.b().c().d()` navigation the caller shouldn't depend on. → hide the walk behind one method on the first object.
- **Middle Man**: a class or function that mostly just delegates onward. → cut it, call the real target direct.
- **Refused Bequest**: a subclass or implementer that ignores or overrides most of what it inherits. → drop the inheritance, use composition.

### 4. Spawn both sub-agents in parallel

Issue both sub-agent calls together, in the foreground, and aggregate the reports they return.

**Standards sub-agent prompt** should include:

- The full diff command and commit list.
- The list of standards-source files you found in step 3, **plus the compatibility and evolution checklist and the smell baseline from step 3**, both pasted in full (the sub-agent has no other access to them).
- The brief: "Report, per file/hunk where relevant, (a) every place the diff violates a documented standard: cite the standard (file + the rule); (b) every unmet item of the compatibility and evolution checklist, as a hard violation when the diff touches an API, schema, migration, contract or existing behaviour; and (c) any baseline smell you spot: name it and quote the hunk. Distinguish hard violations from judgement calls: documented-standard breaches can be hard, but baseline smells are always judgement calls, and a documented repo standard overrides the baseline. Skip anything tooling enforces. Under 500 words."

**Spec sub-agent prompt** should include:

- The diff command and commit list.
- The path or fetched contents of the spec.
- The brief: "Report: (a) requirements the spec asked for that are missing or partial; (b) behaviour in the diff that wasn't asked for (scope creep); (c) requirements that look implemented but where the implementation looks wrong. Quote the spec line for each finding. Under 400 words."

If the spec is missing, skip the Spec sub-agent and note this in the final report.

### 5. Aggregate

Present the two reports under `## Standards` and `## Spec` headings, verbatim or lightly cleaned. Do **not** merge or rerank findings, because the two axes are deliberately separate (see _Why two axes_).

End with a one-line summary: total findings per axis, and the worst issue _within each axis_ (if any). Don't pick a single winner across axes: that's the reranking the separation exists to prevent.

## Why two axes

A change can pass one axis and fail the other:

- Code that follows every standard but implements the wrong thing → **Standards pass, Spec fail.**
- Code that does exactly what the issue asked but breaks the project's conventions → **Spec pass, Standards fail.**

Reporting them separately stops one axis from masking the other.
