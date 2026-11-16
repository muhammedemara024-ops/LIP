# Review record: PD-043 working name and the 1.5 prototype brief (2026-11-13)

**Risk**: HIGH. **Reviewer**: `plan-review`, gpt-6.1-sol, read-only (verified: hashes and git status unchanged).

## Initial review: CHANGES REQUIRED (verbatim)

**CHANGES REQUIRED.** The current changes preserve PD-029 and keep roadmap 1.5 unstarted. One approval-attribution issue and five brief-quality issues need correction.

Compared all four supplied baselines using `git diff --no-index` and reviewed the new brief against the cited local sources. No files were changed.

Standards finding:

| ID | Severity | Location | Finding | Suggested fix |
|---|---|---|---|---|
| S-01 | HIGH | [PD-043 item 3](D:/Projects/loyalty-interchange-protocol-main/docs/context/01-decisions.md:2025), approval attribution at line 2038 | Branding separation faithfully records the owner’s instruction, but “all supplied through **one brand value per locale**” selects an implementation mechanism and attributes its approval to the owner. That exact mechanism was not approved. The brief then treats it as binding. | Keep the separation principle Approved. Mark the single-value mechanism Proposed, or obtain explicit owner confirmation; adjust brief §2/§4 and AC-08 accordingly. |

The GUC, migration-name and identifier restrictions reasonably apply the authorized separation principle. The `crv_*` clause requires brand-neutral replacements; it neither selects a replacement prefix nor authorizes rebranding or migration.

Spec and brief findings:

| ID | Severity | Location | Finding | Suggested fix |
|---|---|---|---|---|
| F-01 | MEDIUM | [Brief §2](D:/Projects/loyalty-interchange-protocol-main/specs/002-p0-prd/prototype/1.5-prototype-brief.md:42) | Amendment propagation names PD-029 and the roadmap only. The approved [plan entry gates](D:/Projects/loyalty-interchange-protocol-main/specs/002-p0-prd/plan.md:75) also require the final name before 1.5; tasks’ `prototype` gate explicitly requires it. Option C would conflict with that gate after neutral-name acceptance. | For each option, identify the exact corresponding plan/task-gate revisions requiring approval. Preserve the final-name requirement for T058 and shipped rebranding. |
| F-02 | MEDIUM | [AC-01/AC-02](D:/Projects/loyalty-interchange-protocol-main/specs/002-p0-prd/prototype/1.5-prototype-brief.md:121) | Story-scenario coverage does not prove coverage of every P0 UI requirement. Missing explicit coverage includes customer history with branch, offline member-code prerequisites, support contact/fallback, and café content-language fallback—FR-120/121/131/141. The brief also omits the already-approved **seven-day** issued-reward indicator principle; only its detailed semantics remain F-12. | Trace every user-facing FR and applicable Approved decision, alongside story scenarios. Add these screens/states and the approved indicator principle. |
| F-03 | MEDIUM | [AC-01](D:/Projects/loyalty-interchange-protocol-main/specs/002-p0-prd/prototype/1.5-prototype-brief.md:121), screen exclusion at line 115 | Requiring a screen/state for every user-facing US1–US14 step includes US9 operator payment/subscription actions. This conflicts with the correctly stated CLI-only operator scope in [operator-api.md](D:/Projects/loyalty-interchange-protocol-main/specs/002-p0-prd/contracts/operator-api.md:3). | Allow explicitly justified CLI-only entries in the traceability matrix, citing the operator contract, without introducing Super Admin screens. |
| F-04 | MEDIUM | [Cashier screen list](D:/Projects/loyalty-interchange-protocol-main/specs/002-p0-prd/prototype/1.5-prototype-brief.md:95), owner-decision list at line 147 | FR-069 governs missing-accrual evidence during **points-void recovery**; it does not fully specify capture-time uncertain-accrual UX. That UX depends on research R-14 and OD-10/15/17. The decision list also omits relevant choices affecting included screens: OD-11 dashboard void authentication, OD-14 alert deduplication and OD-18 above-threshold awards. | Correct the citation and map these unresolved choices to their screens. Preserve existing fail-closed baselines without selecting recommendations. |
| F-05 | MEDIUM | [Sequencing §3](D:/Projects/loyalty-interchange-protocol-main/specs/002-p0-prd/prototype/1.5-prototype-brief.md:49), AC-09 at line 129 | The sequencing conflict is real. However, AC-09 verifies annotations and markers without requiring the existing ≤2-taps/cheap-Android and under-15-minute results. “NOT RUN” needs an explicit consequence. Option 1 also permits starting 1.5 before 1.3/1.4 completion, changing E1’s stated dependency. | Distinguish prototype preparation from measured acceptance. Retain the existing thresholds, specify evidence and unresolved scoring conditions, and state which tasks remain incomplete when tests are NOT RUN. Require an explicit dependency amendment if Option 1 is selected. |

Other checks passed:

- **Gate integrity:** an owner-approved amendment is needed to start 1.5 with a working name. Options A/B/C and the recommendation imply no approval. The roadmap Done-cell text explicitly says “Not started”; it does not claim progress or completion. Moving the explanatory note outside that column would improve scanning only.
- **Source fidelity:** PD-021/022 migration creation, café name/exact count, accept/decline, 15-minute expiry and owner attestation are consistent. PD-023 join minimization and PD-013/FR-006 visibility are consistent.
- **Preservation:** JG-04, JG-11, OD-01–OD-18 and unresolved F-items remain open. FP-003 remains unauthorized, with no attribution algorithm selected. No existing requirement is actually amended by these diffs.
- **Acceptance criteria:** most are observable design checks, but F-02/F-03/F-05 prevent the set from serving as complete, internally consistent acceptance evidence.

Owner decisions still needed:

- Final checked Arabic/Latin name, or the exact PD-029 amendment and corresponding gate changes.
- Journey acceptance basis, sequencing resolution and separate authorization to start 1.5.
- F-02 timing endpoints; F-11 tap interpretation and reference device; F-12 wizard bounds and indicator semantics.
- Starter/Growth/Premium prices and customer/branch/message limits; official WhatsApp authentication-rate verification. Capacity limits remain monitoring-only in P0.
- Accessibility target or explicitly none; prototype tool/storage; confirmation of the proposed branding mechanism.
- Disposition of screen-dependent unresolved decisions, including those identified in F-04. This does not require closing all eighteen ODs.

This was a read-only documentation review on Windows/PowerShell. Runtime tests and prototype measurements were not executed.

## Disposition

All six findings (S-01, F-01 to F-05) were accepted on evidence and fixed in `docs/context/01-decisions.md` (PD-043 item 3 and its date line) and in `specs/002-p0-prd/prototype/1.5-prototype-brief.md`.

## Round 1: CHANGES REQUIRED (verbatim)

**CHANGES REQUIRED.** Four findings are closed; S-01 and F-01 remain partially open.

| ID | Status | Evidence and disposition |
|---|---|---|
| **S-01** | **OPEN** | The approval attribution is corrected: [PD-043:2027](D:/Projects/loyalty-interchange-protocol-main/docs/context/01-decisions.md:2027) explicitly marks the mechanism Proposed; [brief:69](D:/Projects/loyalty-interchange-protocol-main/specs/002-p0-prd/prototype/1.5-prototype-brief.md:69) and [AC-08:142](D:/Projects/loyalty-interchange-protocol-main/specs/002-p0-prd/prototype/1.5-prototype-brief.md:142) require confirmation. However, [option B:37](D:/Projects/loyalty-interchange-protocol-main/specs/002-p0-prd/prototype/1.5-prototype-brief.md:37) still promises “The final swap is a one-value change.” Remove that promise or make it conditional on the separately approved mechanism. |
| **F-01** | **OPEN** | The propagation table correctly adds the plan and `prototype` gates, but [brief:50](D:/Projects/loyalty-interchange-protocol-main/specs/002-p0-prd/prototype/1.5-prototype-brief.md:50) incorrectly says `final-name` remains unchanged under B/C. Its actual wording still requires the name **before 1.5** ([tasks:64](D:/Projects/loyalty-interchange-protocol-main/specs/002-p0-prd/tasks.md:64)). Amend that timing clause while retaining the final-name prerequisite for T058/rebranding. Also include the repeated before-1.5 dependency in [spec:648](D:/Projects/loyalty-interchange-protocol-main/specs/002-p0-prd/spec.md:648). These are proposed propagation changes requiring owner approval. |
| **F-02** | **CLOSED** | [D1:76](D:/Projects/loyalty-interchange-protocol-main/specs/002-p0-prd/prototype/1.5-prototype-brief.md:76) and [AC-01:135](D:/Projects/loyalty-interchange-protocol-main/specs/002-p0-prd/prototype/1.5-prototype-brief.md:135) cover FRs and applicable Approved decisions. The customer inventory now includes the missing states and approved seven-day indicator principle ([brief:94](D:/Projects/loyalty-interchange-protocol-main/specs/002-p0-prd/prototype/1.5-prototype-brief.md:94)). |
| **F-03** | **CLOSED** | [AC-01:135](D:/Projects/loyalty-interchange-protocol-main/specs/002-p0-prd/prototype/1.5-prototype-brief.md:135) permits justified CLI-only operator entries, consistent with [operator-api:3](D:/Projects/loyalty-interchange-protocol-main/specs/002-p0-prd/contracts/operator-api.md:3). |
| **F-04** | **CLOSED** | [Brief:109](D:/Projects/loyalty-interchange-protocol-main/specs/002-p0-prd/prototype/1.5-prototype-brief.md:109) cites R-14 and retains the never-resend baseline. Owner-screen mappings appear at [brief:123](D:/Projects/loyalty-interchange-protocol-main/specs/002-p0-prd/prototype/1.5-prototype-brief.md:123); the expanded decision list is at [brief:162](D:/Projects/loyalty-interchange-protocol-main/specs/002-p0-prd/prototype/1.5-prototype-brief.md:162). No recommendation becomes decided behavior. |
| **F-05** | **CLOSED** | [Brief:61](D:/Projects/loyalty-interchange-protocol-main/specs/002-p0-prd/prototype/1.5-prototype-brief.md:61) requires an approved dependency amendment. [AC-09:143](D:/Projects/loyalty-interchange-protocol-main/specs/002-p0-prd/prototype/1.5-prototype-brief.md:143) preserves both thresholds, separates preparation from measurement, retains scoring decisions and explicitly blocks M1/T001 when measurements are NOT RUN. |

The two residual issues above are the remaining mechanism assumption and inaccurate gate-propagation claim. I found no additional invented rules, implied approvals or actual gate weakening. Task 1.5 remains unauthorized; unresolved decisions and FP-003 restrictions remain preserved.

Read-only review on Windows/PowerShell. No edits, staging, commits or pushes. Runtime tests and prototype measurements were not executed.

### Round 1 disposition

S-01 residual: the "one-value change" promise is now conditional on the proposed mechanism. F-01 residual: the `final-name` timing clause and the spec.md Dependencies line are added to the propagation table as proposed, owner-approved changes. Both were accepted and fixed in the brief only.

## Round 2 (final): APPROVED

S-01 and F-01 are CLOSED; F-02 to F-05 remain closed. There are no new issues.

The verdict approves the reviewed documents only. Task 1.5 remains unauthorized.

Fable was not required, because no disagreement remained. A Fable review is still mandatory before any push.
