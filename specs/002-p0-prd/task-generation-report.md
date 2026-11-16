# P0 task-generation report

**Status**: Author verification only. Ready for independent review; not an independent verdict, Gate 2 approval or authorization to implement. Planning Gate approval and task-generation authorization dated 2026-11-12 are reconciled in plan.md.

**Refinement update (2026-11-13).** This document preserves the generation-run findings below as historical results. The existing 78 cards were subsequently refined in place; current classifications, 121-edge dependency verification, resolved source-summary defects and remaining blockers are recorded in [analysis-report.md](analysis-report.md). [execution-briefs.md](execution-briefs.md) pins three isolated pure seams. Planned routing at that refinement was 5 mechanical / 53 reasoning / 20 gate-only, with readiness 0 ready / 78 blocked / 0 draft (historical). **Current (2026-11-13, after Gate 2 decisions):** 79 cards (T079 added for PD-039); 6 mechanical / 53 reasoning / 20 gate-only; 0 ready / 79 blocked / 0 draft; 121 edges, acyclic. Gate 2 is approved in scoped form; see tasks.md Status. The older generation script must not overwrite the refined tasks.

## Approval investigation

The plan, research, data-model and contract index retained pre-approval Status text. Repository records showed planning reviews, not the original owner approval message. The owner's continuation message explicitly confirms that the Planning Gate was already approved and `/speckit-tasks` separately authorized on 2026-11-12. That confirmation is recorded as provenance; no original transcript or new authorization was invented. The exact earlier failure to synchronize headers cannot be attributed to a particular session from these files alone.

Updated only planning metadata/scope statements in plan.md, research.md, data-model.md, contracts/README.md and quickstart.md. The previous governance-audit handoff now records that its missing-approval conclusion was superseded. Product requirements and OD recommendations were not changed.

## Pending governance review and permission to generate

AGENTS §5, *When Fable is required*, says: **“HIGH and CRITICAL: Fable's verdict is mandatory, even when Opus and Sol agree.”** Rule 04 §4 restates mandatory final-verdict review and that a missing/failed/non-read-only review counts as no review. These remain binding. They do not state that the separate governance verdict must precede drafting this P0 task package.

AGENTS §5's short-prompt protocol requires preceding owner gates to be recorded and the review policy applied; the owner-confirmed planning approval and separate task-generation authorization satisfy the relevant drafting gate. No pending verdict was relabelled approved or replaced. This is permission to produce review artifacts only. The separate governance review and HIGH-risk task-package independent reviews remain outstanding; no implementation or publication followed.

## Generated package

Installed `.agents/skills/speckit-tasks/SKILL.md` was used. `python -B .specify/scripts/python/setup_tasks.py --json` resolved this feature, all four optional design inputs and `.specify/templates/overrides/tasks-template.md`. No `.specify/extensions.yml` exists, so no before/after hooks were run or installed.

- 78 numbered cards: 58 prospective work items and 20 gate-only records (18 ODs, upstream roadmap 2.7, FP-003).
- 123 explicit dependency edges; all point to earlier IDs; graph acyclic.
- 127/127 FR/SC IDs mapped explicitly; no invented requirement IDs; all 14 user stories mapped. Coverage includes blocked work and post-launch measurement protocols and does not mean implementation coverage.
- Each card has the rule-05 fields, source/contract references, expected test outcomes, scope and STOP conditions.
- Current readiness: **0 ready / 78 blocked / 0 draft**. Every card has the common outstanding Gate 2 plus separate implementation authorization; decision/evidence prerequisites also propagate transitively.
- Planned routing after gates: **9 mechanical / 49 reasoning / 20 gate-only**. No card is currently assignable; no claim that every card is Flash-ready. Exact module-internal source/test files must be pinned before delegation, as rule 05 requires. The two model names/routing configuration were not changed.
- No `[P]` marker claims currently executable parallel work. Conditional disjoint-file opportunities are listed for after prerequisites pass.
- OD-01–OD-18 remain Proposed, with dedicated blocked records and the authoritative questions in research §5. Temporary OD-15 B and OD-17 “never” behavior is limited to the plan's development/verification baseline, not production acceptance.
- FP-003 has no code/formula/enablement instructions or implementation schedule. T078 retains ordered gates (a)–(e), V5/V6 and SC-017. Its candidate attribution formula remains unproven.

## Remaining quality findings for independent reviewers

| ID | Severity | Source / cards | Finding and required follow-up |
| --- | --- | --- | --- |
| A1 | HIGH | research R-07 step 3; data-model §4 lip_calls; T013 | Outcome/attempt updates describe different lease-generation guards. A stronger-lane approved execution brief must distinguish late-attempt recording, status transition and domain-effect fencing before assignment. No algorithm was silently selected. |
| A2 | HIGH | data-model §1 Identifiers, §2 tables; T006/T015 | General ULID statement and explicit UUID keys need a consistent per-column type manifest and full role/table policy matrix before migrations. |
| A3 | HIGH | owner-api settings row; T023/T028/T046 | Per-setting and branch-create stage cells are not all fixed by PD-005 A2. Enumerate fixed cells; send unspecified owner-visible cells to the owner. No inferred deny/allow default. |
| A4 | MEDIUM | research R-04/R-16/R-24; T002/T032 | Exact new library versions, module-internal source/test files, browser test commands and reservation backstop TTL are not pinned by the plan. T002/execution briefs must close those details before lower-cost delegation. 600s remains a proposal. |
| A5 | MEDIUM | broad module cards, especially T006/T045/T055 | Independent review should assess fresh-context sizing after exact file/test manifests exist and split broad schema, eight-page UI or readiness work into smaller cards where needed. Field completeness alone does not certify single-context implementation readiness. |

These findings block affected implementation readiness. They do not resolve or replace any OD, introduce product policy, or claim a clean independent verdict. The task package is ready to be examined by reviewers; it is not yet a fully pinned executable Flash backlog. Gate 2 should preserve every named block and follow the required independent reviews.

## Verification evidence

Environment: Windows PowerShell, Node `v22.22.0`; npm invoked with `npm.cmd`. No application code was implemented. No Vitest/browser/live PostgreSQL test suite was run in this documentation-only generation session; application pass/fail/skip counts are not available, and no Linux/Pilot readiness claim is made.

| Check | Result |
| --- | --- |
| Artifact validator | 14 passed, 0 failed; 78 cards, 123 acyclic edges, 127 requirement IDs, all 14 story labels, all 18 OD records, FP-003 blocked, no template placeholders, valid local Markdown targets, no trailing whitespace, unchanged staged blob, no hooks |
| `npm.cmd run typecheck` | PASS, exit 0; workspace and Admin |
| `npm.cmd run docs:check` | PASS, exit 0; 10 mirror pairs |
| `npm.cmd run launch:check` | PASS, exit 0 |
| `npm.cmd run public-safety:check` | PASS, exit 0; 703 tracked files; does not include untracked tasks/planning files |
| `specify integration status` | PASS; agy default/installed; 0 modified/missing managed files, invalid paths or unchecked manifests |
| `git diff --check` | PASS; line-ending warnings only |

Reproduce author checks using `specs/002-p0-prd/evidence/governance-audit-2026-11-12/validate_tasks.py` (read-only). The accompanying generation script creates documentation only and is not application implementation. Required upstream files and existing task scopes were inspected; missing module-internal filenames are explicitly blocked rather than invented. Review lane identities/model routing and all unrelated work remain unchanged. The only staged item is the original `.gitattributes` blob `f843449`; no staging/commit/push occurred.

## Next gate

Run the configured read-only plan-review and mandatory independent Fable final-verdict on the task package, and obtain the pending Fable governance review. Resolve or retain explicit blocks on the findings above. The owner then reviews the concrete plan/tasks package for Gate 2; implementation still needs its own authorization and each task's prerequisites. No reviewer can resolve OD-01–OD-18 or authorize FP-003 in the owner's place.
