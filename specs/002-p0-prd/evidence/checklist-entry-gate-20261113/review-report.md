# Review record: P0 entry-gate checklist and assessment (2026-11-13)

**Risk**: HIGH (the assessment informs implementation entry gates).

**Reviewer**: `plan-review`, `gpt-6.1-sol`, read-only sandbox (confirmed in `result.json`). Git status and 1,132 file hashes were unchanged across each run.

## Initial review: CHANGES REQUIRED (verbatim report)

**CHANGES REQUIRED — HIGH-risk review.** Strictly read-only; no files, staging, commits or pushes changed.

Below, **A** means [entry-gate-assessment.md](/D:/Projects/loyalty-interchange-protocol-main/specs/002-p0-prd/checklists/entry-gate-assessment.md), and **C** means [entry-gate.md](/D:/Projects/loyalty-interchange-protocol-main/specs/002-p0-prd/checklists/entry-gate.md).

The assessment identifies real implementation blockers, but mixes those with requirements-quality failures. Its blanket statement that owner decisions cannot block T001 or the pure helpers is incorrect.

| ID | Severity | Location | Finding | Suggested fix |
|---|---|---|---|---|
| R01 | HIGH | C:78; A:103 — CHK045 | “First-name search only” contradicts **PD-013** (`01-decisions.md:1095–1097`) and **FR-006** (`spec.md:398`): owner search requires **first name plus last three phone digits**. FR-030 concerns cashier phone lookup; it does not establish customer own-account isolation. | Correct the checklist criterion. Cite `contracts/owner-api.md:65` for owner search and `data-model.md:18,34` for customer isolation. Reassess before marking Approved. |
| R02 | HIGH | A:35–62; A:93 — CHK010 and inherited blockers | “None” of §B’s owner decisions blocks T001/T010/T035/T048 is contradicted by **CHK019’s own M1 mapping**. `tasks.md:35,90,94` makes plan values part of T001/M1; the helpers inherit T001. CHK015 also names prototype 1.5. Furthermore, `journeys/README.md:16` prohibits unconditional journey acceptance, and the owner journey explicitly identifies OD-01/02/05/08 and unresolved JGs (`1.4-owner-onboarding-journey.md:126–128`). | Distinguish **no direct algorithm-level OD dependency** from **inherited entry dependencies**. Show owner decisions needed for M1 acceptance; do not automatically require all eighteen ODs to close. |
| R03 | HIGH | A:6,31 — B4 / CHK007 | The assertion that `feature-checklist` has no satisfaction rule is overstated. `tasks.md:63` and `plan.md:87` explicitly require the command run. Separately, the installed implement skill already defines checkbox handling: unchecked items require a stop and explicit proceed response (`.claude/skills/speckit-implement/SKILL.md:62–94`). “Owner review of this assessment” is not the recorded gate definition. | Treat the command-run requirement and checklist-state handling separately. Remove the invented undefined-gate blocker. Do not claim either gate closed without its evidence. |
| R04 | MEDIUM | A:28–33 — CHK004/006/008 | These classifications confuse an **unsatisfied operational prerequisite** with an **undefined requirement**. T001 specifies dated entry evidence (`tasks.md:96`); G-IMPLEMENT explicitly names separate authorization (`:34`); T079 is explicitly blocked and outside the approved six-card content scope (`:3,269`). | Mark the requirement-definition criteria satisfied where supported. Retain M1 and implementation authorization as operational blockers in a separate status column. |
| R05 | MEDIUM | A:33,124 — B6 | T079 is outside the defined first batch. Counting its conditional admission problem among current blockers overstates that list. Missing field 13 is also not its only obstacle: content approval and T010 completion are outstanding. | Move T079 to a separate future-admission note listing content approval, reviewed field 13, T010 and inherited gates. |
| R06 | MEDIUM | A:56 — CHK050 / OD-18 | “T076 and dependants” does not identify the implementation affected by OD-18. T076 is a gate-only record with no task prerequisites (`tasks.md:1426–1431`); T030/T037 do not depend on it. Research §5 instead identifies roadmap **3.3 and 3.6**. | Identify the above-5× owner-award paths in T030/T037 and affected callers. Report the missing explicit card linkage rather than implying T076’s dependency graph enforces it. |
| R07 | MEDIUM | A:70 — CHK040 | P0 inbound callbacks are not an unspecified implementation choice: `plan.md:106` explicitly says **“No inbound webhooks in P0”**; `contracts/operator-api.md:10` also says provisioning requests none. | Classify the existing exclusion as satisfied. Adding a callback would require reviewed scope/API decisions, not merely a deferred technical brief. |
| R08 | LOW | A:72 — CHK039 | The checklist asks whether security-review scope and disposition requirements are documented. Roadmap **5.1** already lists tenant isolation, authz, QR/OTP abuse, secrets and OTP/session code, with findings fixed or accepted in writing. SC-013/015 supply additional boundaries. A written threat model is a different deliverable. | Classify the stated criterion as satisfied; track a threat-model artifact separately if required by an existing task. |
| R09 | MEDIUM | A:71 — CHK063 | The deferred row combines specified details and an actual owner decision. Research **R-25:355–357** already defines logging, metrics and health checks; R-15 defines void escalation alerts. For unresolved-call freezes, **R-07:113–114 explicitly leaves escalation timing to OD-15**. | Cite the existing observability requirements. Keep technical routing details deferred, but preserve OD-15’s owner-decision boundary. |
| R10 | MEDIUM | A:69 — CHK057 | “Other success criteria are measurable as written” contradicts the assessment’s own SC-001/F-02 blocker. CHK057 expressly includes that timer and SC-003 measurement. The row answers only the SC-005 workload portion. | Classify CHK057 as mixed: benchmark profile deferred; SC-001 linked to CHK021’s blocker; identify remaining measurement protocols without declaring them all complete. |
| R11 | MEDIUM | C:67; A:53 — CHK037 | OD-06 says the provider lacks device flow or **an MFA claim** (`research.md:377`), not that mandatory MFA may be absent. FR-013 still requires enforced MFA. | Preserve the exact “MFA claim” wording and state that transport fallback cannot waive MFA. |
| R12 | LOW | A:111 — CHK056 | The cited `[VERIFY]` list does not assign a milestone to every item as claimed. For example, `plan.md:380–381` gives no explicit milestone for usage-event nonblocking or SDK-prefix verification. | Add the actual verification mapping to the assessment, or leave the “each with milestone” criterion partially open. |
| R13 | LOW | A:105 — CHK048 | The exact task-register gate names are **`FP-003-V5` and `FP-003-V6`**, not bare `V5`/`V6` (`tasks.md:27–28,1461`). | Use exact register identifiers; preserve SC-017 and the existing ordered gates. |
| R14 | LOW | A:91,109 — CHK005/054 | Evidence is incomplete. **PD-039 item 4** (`01-decisions.md:1907`) is the direct owner-approved source retaining pure-helper entry gates. The upstream inventory citation omits conditional **FP-004 / OD-09**, explicitly present in `plan.md:100` and `research.md:380`. | Add those references. Their approved/deferred boundaries remain unchanged. |

All referenced files and named PD/FR/OD identifiers inspected exist. The substantive citation errors and unsupported conclusions are listed above; the assessment supplies no numeric source-line citations to audit for line-number drift.

The following accounts for **all 64 items**:

| Items | Classification judgment |
|---|---|
| CHK001–003, 005, 009, 031–036, 038, 041, 044, 046, 048, 051–055, 059–061, 064 | Retain Approved, with citation corrections above where noted. |
| CHK004, 006–008 | Requirement-definition criteria are satisfied; operational prerequisites remain open. |
| CHK010 | Mixed: pure seams select no direct OD, but inherit outstanding entry dependencies. |
| CHK011–020, 023–028, 037, 043, 047, 049–050, 062 | Owner-decision classification is appropriate; correct dependency scope and wording above. |
| CHK021–022 | Retain Blocker through the Phase 1 acceptance requirements. |
| CHK029–030, 058 | Retain the reported consistency/coverage findings. |
| CHK039–040 | Existing requirements satisfy the stated criteria; Deferred is unsupported. |
| CHK042 | Retain Deferred, gated before the named schema cards; no authority to invent policy. |
| CHK045 | Correct the contradictory criterion, then reassess. |
| CHK056 | Evidence incomplete for the criterion as written. |
| CHK057, 063 | Mixed; cannot be classified wholly as technical deferral. |

For the six-card batch, **G-IMPLEMENT remains outstanding for every card**. T001 additionally requires **M1 and feature-checklist evidence**; T002/T010/T035/T048/T058 inherit T001, and T058 explicitly requires the final name. M1 includes journeys, prototype, plan values and naming dependencies. B1/B2/B3/B5 therefore describe real outstanding work, with overlaps; B4 and conditional B6 overstate the current blocker list.

Both files preserve unresolved ODs and FP-003’s unauthorized status, and neither presents the point-lot formula as safe. No checkbox is ticked, and neither claims checklist execution has closed an entry gate. However, CHK045 contradicts an approved requirement, while the B4 explanation invents a gate interpretation; those prevent an unqualified governance pass.

Checklist structure conforms to the template: title, metadata, ownership/marker notes, category sections, sequential CHK identifiers and notes are present. **64/64 items have traceability markers (100%); 64 unchecked, 0 checked.** They assess written requirements and planning artifacts rather than execution behavior. The 40-item limit is a soft cap, so 64 is not itself a violation.

Owner decisions remain necessary for:

- Final Arabic/Latin name, plan values, prototype and journey acceptance; F-02 timing and F-11 tap/device definitions.
- The assessment’s identified open policy choices: F-01, recovery mechanisms, F-10 customer-stage cells, F-12 ranges/window semantics, retention and accessibility scope.
- OD-01/02/03/05/06/07/08/10/11/12/13/15/16/17/18 at their affected work. OD-04/09/14 also remain open; this review resolves none.
- F-05 support-triage details and F-07 invitation reissue/race behavior, omitted from the assessment’s owner-decision inventory.
- Separate named implementation authorization; any explicit response allowing implementation with unchecked checklist items remains separate from substantive task gates.

No tests were run; this was document and dependency review on the Windows workspace.

## Disposition

All of R01–R14 were accepted on evidence and fixed in `specs/002-p0-prd/checklists/entry-gate.md` (CHK037, CHK045) and in a rewrite of `entry-gate-assessment.md`.

## Round 1: CHANGES REQUIRED

This report file was missing at the time, so the R01–R14 closures could not be mapped. New findings:
- N01 (CHK010 criterion broader than its evidence);
- N02 (circular sequence between B1 and B3);
- N03 (the "three more" count).

All three were accepted and fixed.

## Round 2 (final): APPROVED

All of R01–R14 and N01–N03 are CLOSED, with file:line evidence. There are no new findings. All 64 items are accounted for exactly once, with 64 unchecked and 0 checked.

The verdict approves the reviewed documents only. Implementation authorization and the substantive gates remain open.

Fable was not required, because no Opus–Sol disagreement remained. A Fable review is still mandatory before any push.
