# Specification Analysis Report — P0 task refinement

**Status**: Codex/Sol author analysis, 2026-11-13. No independent final verdict; no Gate 2 or implementation authorization. This report records two installed `/speckit-analyze` read-only passes, with separately user-authorized documentation remediation between them. It does not invoke `/speckit-implement` or substitute for the mandatory independent Fable verdict.

## Inputs and method

Installed workflow: `.agents/skills/speckit-analyze/SKILL.md`. Each pass uses `python -B .specify/scripts/python/check_prerequisites.py --json --require-spec --require-tasks --include-tasks`; the active feature resolves to `specs/002-p0-prd` and the actual spec, plan and tasks exist. No `.specify/extensions.yml` is present; no before/after analysis hooks are configured, executed or installed.

Analysis reads the actual PRD overview, stories, FR/SCs and edge cases; the approved plan architecture, structure, phases, entry gates and risks; task headers, fields, dependencies, requirements and tests; the constitution and rules. Cross-checks use approved PD-005 A2, PD-007, PD-008 A1, SC-012, research R-07 and the data-model/contracts. Requirement/story mapping is both inspected semantically and checked structurally. The validator's field-presence tests do not certify the correctness of implementation algorithms.

No task package regeneration ran. T001–T078 remain the same IDs; the 18 OD cards, upstream-track card and FP-003 card were preserved. Selected card fields and the derived coverage register were patched in place. File-level detail for three pure seams was added within the plan's existing modules; no application file was created. PRD, research, decisions and fork-patch source content remained unchanged.

## Findings and disposition

Stable finding IDs refer to the first pass. “Resolved” means this objectively verifiable documentation defect was corrected and inspected in the second pass; it never means an OD, implementation gate or independent verdict was satisfied.

| ID | Category | Severity | Location | First-pass finding | Final disposition |
| --- | --- | --- | --- | --- | --- |
| I1 | Inconsistency | HIGH | research R-07 step 3; data-model §4 lip_calls; T013 | Blanket lease-generation summary could discard legitimate late attempt evidence | **Resolved.** Data-model/T013 now distinguish lease-authorized dispatch, unconditional recording of actual late attempt evidence, nonterminal-status guard, R-07 definitive outcomes, atomic domain effects and admission-token slot deletion. Exact vectors are in execution-briefs Journal outcome guards. Remaining worker constants/files are I6. |
| I2 | Inconsistency | HIGH | data-model §1/§2; T006/T012/T015 | Universal ULID statement conflicts with explicitly declared UUID keys and UUID GUC cast | **Resolved.** Column-specific UUID declarations and references remain UUID; text LIP/business-id formats and fresh ULID admission token retain existing contracts. No UUID version or missing column type was selected. |
| I3 | Underspecification | HIGH | data-model §§2–4; schema-brief register | Per-column SQL types/nullability and full per-table policy manifest are incomplete | **Unresolved.** Explicit type boundaries are clarified, but sources do not supply every missing detail. A reviewed reasoning schema/policy brief is required before related migration/RLS/directory cards can be assigned. No new schema decision was invented. |
| I4 | Ambiguity | HIGH | owner-api settings/branch maintenance; T023/T046 | Unlisted per-setting and branch-action stage permissions cannot be inferred from the A2 table or missing RO marker | **Unresolved.** Fixed approved cells are enumerated; genuinely unspecified fields/actions remain owner questions. No blanket deny/allow default, new role permission or implicit approval was introduced. |
| I5 | Testability | MEDIUM | T028; PD-005 A2 | Fixed stage-cell requirements were referenced without an explicit testable cell enumeration | **Resolved.** execution-briefs transcribes exactly 30 grace/read-only/suspended cells, checked against the approved decision, with all cell tests and date boundaries. T028 excludes unknown action mappings; those remain I4. |
| I6 | Underspecification | MEDIUM | T002/T013/T032 and full-module execution briefs | Unpinned library versions, internal file/test/command manifests, lease/source constants and proposed reservation TTL leave technical choices to implementers | **Unresolved, partially reduced.** Exact typed contracts, eight source/test paths, vector outcomes and runnable strict-tsc/Vitest commands are pinned for T010/T035/T048 with no new dependency. Unspecified Next.js/i18n/QR/Playwright choices, TTL600 and complex-module details remain blocked. |
| I7 | Granularity | MEDIUM | T006/T045/T055 | Complete schema, eight-page UI and multi-area readiness cards may exceed one fresh implementation context | **Unresolved.** These remain blocked reasoning cards requiring per-file/vertical decomposition after their missing inputs are available. Field completeness does not make them Flash-ready. No fabricated decomposition through unapproved contracts was scheduled. |
| I8 | Dependencies | MEDIUM | T002/T058; pure-seam prerequisites; T028 prerequisite wording | A task's brief was also its own entry gate; pure policies unnecessarily waited on live operations; explanatory later-card references could be read as dependency edges | **Resolved.** T002/T058 produce their brief rather than require their own output; pure T010/T035/T048 depend on entry evidence, not unrelated DB/live awards. T028 lists only actual prerequisites. The resulting 121-edge graph is acyclic. M1, checklist, owner and domain gates remain. |
| I9 | Coverage precision | LOW | T010/T035/T048 objectives/tests and trace index | Pure-helper descriptions mixed unit proofs with live time-zone/storage/auth claims | **Resolved.** Pure scope/contracts/tests are explicit; live Cairo/PG/window/crash proofs remain in reasoning/integration cards. FR-133 is explicitly mapped to T028/T044/T049 rather than claimed by the money helper. Trace index matches actual card objectives. |
| I10 | Executor classification | HIGH | T011/T026/T042/T045 | Complete host-routing/PWA/dashboard changes were marked mechanical despite missing state/file briefs and security-sensitive integration | **Resolved.** Reclassified as reasoning. Only narrow pinned pure seams and documentation-only cards retain prospective mechanical routing. No model routing/configuration changed. |

## Severity totals

| Severity | First pass | Resolved after refinement | Final unresolved |
| --- | --- | --- | --- |
| CRITICAL | 0 | 0 | 0 |
| HIGH | 5 | 3 | 2 |
| MEDIUM | 4 | 2 | 2 |
| LOW | 1 | 1 | 0 |
| **Total** | **10** | **6** | **4** |

The existing OD-01–OD-18, FP-003 and deployment/legal/pilot prerequisites are tracked gates, not 19 silently “resolved findings.” All remain as recorded. No constitutional rule was diluted; no critical defect is being waived. The four unresolved findings affect implementation readiness and prevent an unconditional “ready for implementation” assessment.

## Coverage summary and dependencies

| Requirement group | Has tasks? | Authoritative task mapping | Notes |
| --- | --- | --- | --- |
| 110 FRs | 110/110 | tasks.md Requirement coverage index, checked against each Objective | No missing or invented FR IDs; gated requirements count as mapped, not delivered |
| 17 SCs | 17/17 | Same coverage index | Includes required performance/security/SLO evidence and blocked SC-017 |
| SC-010/SC-011 post-launch outcomes | Separately mapped | T044/T056 and related report/protocol work | Not claimed implemented target attainment; excluded from the 125-item buildable analysis inventory |
| 14 stories | 14/14 | tasks.md User-story traceability and independent tests | E1–E19/US scenarios and dedicated story labels retained |
| FP-003/points pilot | Blocked mapping | T078, T038/T039 shell/evidence only | No reversal/enablement schedule; ordered gates(a)–(e),V5/V6,SC-017 remain |

- Explicit dependency edges: **121**, all referenced task IDs exist, graph acyclic. Gate inheritance remains transitive; closing task dependencies never closes an OD or owner gate.
- No task is unmapped to a requirement; no direct requirement mapping was replaced by “coverage” inferred only from repeated global boilerplate.
- Every card retains the rule-05 fields, required expected outcomes, verification evidence requirements and STOP conditions for contradictions, mismatched files/symbols, unsatisfied tests/invariants, untouched/upstream scope and open gates.
- Exact test/file scopes are now present for the three isolated pure seams. Broad reasoning-card tests remain prospective and cannot certify missing execution details.
- No `[P]` flag claims current executable parallel work. Once common gates pass, T010/T035/T048 have disjoint file scopes; they do not need a real customer, credential, server, DB or new framework.
- Constitution alignment: no additional constitutional conflict found in the refined, blocked planning scope. Full implementation conformity still requires executed tests, independent reviews and owner gates.

## Classification and readiness

**Task count stays 78**: 58 prospective work items and 20 gate-only records. Current executor/readiness classification is **0 mechanical assignable / 0 reasoning assignable / 78 blocked**; ready0/blocked78/draft0. Gate 2 and explicit implementation authorization are outstanding for all cards.

Prospective routing after their gates: **5 mechanical / 53 reasoning / 20 gate-only**. The five mechanical candidates are T001 documentation evidence, T010 pure digits/piasters, T035 pure stamp plan, T048 pure availability classifier and T058 rebrand inventory. T001/T058 are documentation only; they authorize no shipped edits. Security primitives, RLS, journal/erasure/concurrency, auth, live accounting, migrations, full UIs and deployment retain reasoning classification. No setting of model routes was changed.

## Recommended first implementation batch

First establish T001's recorded entry evidence: roadmap M1/1.2–1.6 and owner-approved prototype/plan values, feature checklist, independent review requirements, Gate 2 and **separate** implementation authorization. The recorded 0.7/0.8 baseline is not reopened or falsely reported rerun. M1/checklist are not yet recorded complete by this refinement.

After those prerequisites, a bounded first code batch is **T010 + T035 + T048**, each confined to its exact pure-file manifest in execution-briefs.md. They can be reviewed separately and worked in parallel because their file sets are disjoint. They demonstrate no live mutation or production readiness and leave all OD/FP-003 tracks blocked. Subsequent backend/frontend batches must wait for their missing reasoning briefs and decisions. This is a recommendation, not an execution schedule or owner permission.

## Verification evidence and limits

Environment: Windows PowerShell host, Node `v22.22.0`. `npm.cmd` invokes the repository scripts without changing PowerShell policy. The read-only artifact verifier reports **29 passed / 0 failed** structural/source/workspace checks, including exact 30-cell matrix comparison, typed-identifier/guard corrections, exact task/trace-index agreement, no app file creation and preservation of unrelated baseline file hashes and staged index.

Repository checks: typecheck PASS; docs:check PASS (10 mirror pairs); launch:check PASS; public-safety:check PASS (703 tracked files only); Spec Kit integration status OK (agy default/installed, zero modified/missing managed files, invalid paths or unchecked manifests); git diff --check PASS with line-ending warnings. Untracked task/brief files are additionally covered by explicit document/link/whitespace verification; the tracked-file safety scan alone is not claimed to cover them.

Application tests: **0 executed** in this documentation-only session; no Vitest/browser/live PostgreSQL pass/fail/skip counts or Linux target proof are claimed. The pure function sources and tests do not exist yet. The verifier is an artifact check, not the application regression suite. No application code, migration, staging, commit, push, hook, governance, routing or GitHub setting changed. The staged `.gitattributes` and unrelated tracked/untracked contents remain intact.

## Next actions and approval boundary

The package is ready for **independent HIGH-risk review**, including the unresolved findings. It is **not recommended for blanket Gate 2 approval as an executable backlog** until the remaining technical/owner inputs and broad-card decomposition have been reviewed. A scoped approval must retain all named blocks; approval of a pure batch cannot authorize its blocked neighbors.

Obtain the configured read-only technical review and mandatory independent Fable final verdict on this package, plus the still-pending separate governance review. No analysis here claims either verdict. The owner resolves I4/OD questions and approves any necessary architectural choices; the orchestrator pins remaining reasoning execution briefs. Then request explicit owner Gate 2 approval and a separate, named implementation-batch authorization. No implementation proceeds from this report alone.

## Orchestrator disposition of the unresolved findings (Opus, 2026-11-13)

Owner context: the Planning Gate is approved and closed (owner, 2026-11-13). Tasks were not regenerated; T001–T078 are unchanged. This section records dispositions only. It approves nothing and decides no OD.

| ID | Disposition | What unblocks it | Blocks the first pure batch? |
| --- | --- | --- | --- |
| I3 HIGH | **Escalated: technical design amendment.** Per-column SQL types, nullability, UUID generation and the per-table RLS policy manifest are not in any approved source. Choosing them is architecture work on an approved plan artifact, so it cannot be filled in from task text. | An orchestrator-authored schema/policy manifest (amendment to data-model.md §§1–4), reviewed by plan-review (Sol, mandatory for HIGH; Fable only on unresolved disagreement), then owner-approved as a plan amendment. Afterwards T006 is decomposed per I7. | No |
| I4 HIGH | **Escalated: owner product decision.** Stage cells not fixed by PD-005 A2 (questions Q1–Q5 below). Recommendations are Proposed, never defaults. | A dated owner answer recorded in docs/context/01-decisions.md (PD-005 A2 amendment) and then transcribed into execution-briefs Stage-policy cells. T028 may still build the fixed 30 cells. | No |
| I6 MEDIUM | **Accepted as a gate, unchanged.** Library versions, journal constants, `source.system` and the reservation TTL stay unselected; T002 (reasoning) and the T013/T032 reasoning briefs produce them for review. R-16's 600 s stays a proposal. | T002 output reviewed; reservation-ttl gate closed by a reviewed brief. | No |
| I7 MEDIUM | **Accepted as a gate, unchanged.** T006/T045/T055 must be split (per table/policy group, per dashboard page, per evidence area) before any of them can be marked ready. Splitting now would use unapproved inputs (I3 manifest, prototype, legal texts). | I3 manifest, approved prototype (roadmap 1.5) and legal texts (0.10 / 5.4) respectively. | No |

**I4 owner questions** (affected: T023, T046; source: contracts/owner-api.md `GET/PUT /settings`, branch rows; PD-005 A2 is silent):

- Q1. In **read-only** and **suspended**, may the owner change each setting: main language, amount label, large-bill threshold, reward expiry (7–90 days)? (Reward expiry may count as a program change, which A2 already denies in both stages; confirm.)
- Q2. In read-only and suspended, may the owner **create a branch** (`POST /branches`)?
- Q3. In read-only and suspended, may the owner **update a branch's names or hours** (`PUT /branches/{id}`)?
- Q4. In read-only and suspended, may the owner **deactivate** and, separately, **reactivate** a branch?
- Q5. In read-only and suspended, may the owner **issue a device enrollment code** (`POST /devices/enrollments`), **re-verify a staff phone or reset a PIN** for existing staff, and **issue their own owner-profile PIN setup code** (`POST /owner-staff-profile/pin-setup-code`)? (OD-01 stays separate.)
- Q6. In read-only and suspended, may the owner **edit the program draft** (`PUT /program/draft`, which carries no RO✗ marker, unlike publish and texts) without publishing it?
- Grace: every A2 action is allowed in grace; confirm that Q1–Q6 are also allowed in grace.

Proposed recommendation, not a default: protective or cleanup actions (deactivate, PIN reset or re-verify of existing staff) are allowed in every stage, like revocation; growth actions (create or reactivate a branch, new device enrollment) follow the A2 "Add staff" row (grace only); presentation settings and the large-bill threshold are allowed in every stage; reward expiry follows the program-change row.

**Lower-cost execution precision.** The T010, T035 and T048 sections of execution-briefs.md now pin the remaining executor choices: exact input grammar, failure-versus-exclusion rules, ratio definitions, error assertions and additional exact vectors. Each pin is read from PD-007, PD-008 A1, SC-012, contracts/README Money or `packages/reference/src/engine.ts`, or is an internal-helper detail that changes no product rule. Two orchestrator-chosen internal-helper interpretations are presented to the owner at Gate 2. They are not derived from the contract: the bill-amount grammar rejects `45.` and `.5` (fail-closed), and the formatter emits no thousands grouping (PD-007 shows none).

**Entry-gate finding (no change made).** plan.md Entry gates require roadmap 1.2–1.6 (journeys, prototype, plan values), the final name and `/speckit-checklist` before **any** implementation task, including the pure seams. Starting the pure batch earlier would need an explicit owner amendment of that entry gate; this report does not assume one.

## Fable read-only review (2026-11-13) and follow-up

The `final-verdict` lane ran read-only and was verified: `result.json` model `claude-fable-5-1`, `readOnly` true, `readOnlyViolation` false, status completed, exit 0. A hash and `git status` comparison showed the reviewer changed no file. Verdict: **APPROVED WITH CONDITIONS**. The review covered the task package and the pending governance changes. It started under the previous risk-based policy, before the owner adopted disagreement-based escalation on 2026-11-13.

| Fable finding | Disposition |
| --- | --- |
| 1 High: T029/T044 depend on T010 in `apps/web`, but the BFF has no money module | New `bff-money-home` gate and STOP in T029/T044; T010 removed from T028 prerequisites (graph now 120 edges). The parser's BFF home is an owner/architecture question; no plan amendment was made. |
| 2 Medium: T035 candidate-check order ambiguous | Fixed: own-prefix filter first, structural checks only on own-prefix candidates; gift and foreign vectors added. |
| 3 Medium: I4 omitted program draft and owner-profile PIN | Fixed: Q5 extended, Q6 added. |
| 4 Low: standalone tsc missed base strictness flags | Fixed in every pure-seam command (briefs and cards). |
| 5 Low: normalize import unstated | Fixed. |
| 6 Low: grammar and grouping presented as contract-derived | Fixed: labelled as orchestrator choices for the owner at Gate 2. |
| 7–9 Low, governance: duplication, template labels, managed skill "optional" text | Accepted as notes. The override and rule 05 prevail; managed skills are not hand-edited. Label alignment is deferred to a later governance pass. |

## Sol read-only review (2026-11-13) and follow-up

The `plan-review` lane ran with model `gpt-6.1-sol`, effort high, in the read-only sandbox; status completed, exit 0. A hash and `git status` comparison showed no file changed. Scope: the disagreement-based governance edit and the post-Fable package changes. Verdict: **AGREE WITH CHANGES**. Opus accepted all three changes, so no disagreement remains and no Fable adjudication is required.

| Sol finding | Disposition |
| --- | --- |
| 1 Medium: T010 risk understated (integer-money invariant) | Fixed: T010 is now HIGH; it keeps the prospective mechanical routing of its fully pinned algorithm. |
| 2 Medium: stale "outstanding Fable governance verdict" readiness text | Fixed: replaced with the current AGENTS §5 policy and the dated review history. |
| 3 Low: card review wording omitted "material technical" and blurred the two Fable triggers | Fixed in all 78 cards. |

Sol independently confirmed: 78 cards, 120 dependency edges, acyclic; 0 ready / 78 blocked; prospectively 5 mechanical / 53 reasoning / 20 gate-only; all vectors recompute; T035 ordering is fail-closed and cannot over-cancel; no FP-003 or OD is touched.

## Owner Gate 2 decisions (2026-11-13)

- **I4 resolved** by PD-005 A3 (owner-approved, with Q5/Q6 refinements). The `stage-cells` gate is closed for T023 and T046; actions outside A2/A3 still go to the owner.
- **`bff-money-home` resolved** by PD-039 item 1. New card T079 (blocked structure, prospective mechanical, HIGH) builds `apps/bff/src/money/`. T029 and T044 now depend on T079 instead of T010. Graph: 79 cards, 121 edges.
- **C1/C2 approved** (PD-039 items 2–3); **entry gates retained** (PD-039 item 4).
- **Gate 2 approved in scoped form**: content T001, T002, T010, T035, T048, T058; gate records T059–T078; all other cards blocked structure. No implementation authorization.
- Still unresolved: I3 (schema/RLS manifest), I6 (versions, TTL, constants), I7 (decomposition), OD-01–OD-18; FP-003 not authorized.
