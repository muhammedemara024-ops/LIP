# PD-047 Revision 3 — consolidated report

**Status, 2026-11-15:** Revision 3 drafted; **U-b selected by the owner**. **PD-047 remains PROPOSED and unapplied.** The current PD-047 independent review is **PASS — REVIEW ONLY**. **G01's independent review remains OPEN**, despite its applied five-file comparison PASS. No Gate 2 is opened and no implementation, staging, commit, push or deployment is authorized.

## Draft result and scope

[Revision 3](../../specs/002-p0-prd/backend-first-amendment.md) separates M1-B backend entry, T084 documentation preparation, M1-UI/UI entry, and real-staging acceptance/M1-done. T084 cannot depend on ui-entry. T085 receives the final T083/T082 OWN-08 flow, T057 live OTP and T053 staging configuration; official measurements cannot gate the implementation that produces them. Mixed PM-S/PM-1–PM-9 milestones distinguish backend entry from complete roadmap acceptance; T055 retains after-M4 and complete PM-6/7/8 conditions.

All UX thresholds and source requirements remain, including the seven raw timing events, invite-acceptance start, <15-minute onboarding, separately timed <3-minute wizard, <=2 taps per cashier step, AR RTL/EN LTR, 360/320px, 200% text, WCAG 2.2 AA, OTP paste/autofill and unresolved staff-PIN decision. Historical D1–D4, journeys, approvals and NOT RUN/NOT SCORED records were not modified. Every FR/SC/US/PD identifier in Revision 2 is retained.

Repository write scope: the amendment plus graph_v3.py, review-brief.md, this report and byte-preserved revision2-baseline.md under this directory. Canonical decisions, roadmap, plan/tasks, PRD, contracts, governance, fleet configuration and existing historical evidence are unchanged.

## Validation actually executed

Windows; Node v22.22.0; Python 3.13.9. No application/staging test result is claimed.

| Check | Exact outcome |
| --- | --- |
| python -B -I .scratch/backend-first-20261115-revision3/graph_v3.py | PASS: 85 task cards, 188 task edges; expanded graph 180 nodes / 532 edges; acyclic |
| Author graph/document assertions | **30 passed, 0 failed, 0 skipped** |
| Negative regression cases | **7 cycles and 2 missing-condition cases correctly rejected** |
| Reviewer-authored independent targeted checks | **13 passed, 0 failed, 0 skipped**, confirmed in the external events log |
| node --import tsx scripts/check-docs-mirror.ts | exit 0; **10 mirror pairs OK** |
| node --import tsx scripts/check-launch-surface.ts | exit 0; launch surface OK |
| node --import tsx scripts/check-public-safety.ts | exit 0; **703 tracked files** passed; this does not claim untracked drafts were covered by that scanner |
| git diff --no-index --check -- revision2-baseline.md amendment.md (using full repository paths) | no whitespace error; Git emitted only line-ending conversion notices |
| Requirement/decision identifier preservation | PASS; no Revision 2 identifier lost |
| Protected workspace / Git index | 973 existing tracked/untracked non-ignored files outside allowed paths unchanged; staged diff unchanged, before and after reviewer work |

No TypeScript source changed. npm run typecheck was not run because its tsc build emits artifacts outside the draft scope; Vitest/browser/device/live-service/pilot suites were not run because this turn authorizes drafting only. There is no full-suite pass claim. No completed fleet test was repeated.

## Independent review and evidence

Configured lane verified by the installed fleet resolver: **plan-review / codex / gpt-6.1-sol / high / read-only**. The child session's runtime turn context confirms model/effort, approval_policy=never and sandbox_policy.type=read-only. No alternative lane or model was used.

The ordinary sandboxed shell remains CodexSandboxOffline with networking disabled. The tool-approved host execution surface successfully reached the provider while preserving the reviewer's native read-only sandbox. No network/security/ACL settings or routing changed.

1. The initial child connected but misunderstood its role and returned BLOCKED while trying to dispatch another reviewer. That is not a substantive review or sign-off.
2. A clarification in the **same** session produced one HIGH and two MEDIUM findings. Its final feedback was captured, but the relay reported timeout/exit 1. It is retained as feedback, not successful sign-off.
3. The author accepted the findings, with no technical disagreement:
   - separated PM-6/PM-9 backend entry from UI/final completion, and made the wider mixed-milestone split explicit;
   - preserved T059–T078 approval as gate records;
   - expanded T085 F-02/data-use/measurement-protocol conditions and added missing-condition regressions.
   The author also restored omitted explicit requirement citations.
4. Evidence-resolution follow-up 1 completed through the same read-only lane: **relay status completed, exit 0; PASS — REVIEW ONLY**, all three findings closed; no remaining material issue in the targeted follow-up. The reviewer independently rejected the two old PM cycles and removal of either measurement permission.

Thread: 01a1dffe-4d67-7d10-b39a-106449cd9ad2.
Reviewed content byte SHA-256: **f49cefe4a9167f8033c9b472871320a9b0dc3b61888dba649dc53c82bfd078d8**.
External evidence directory: [resolution result](D:/Wanees-Delegation-Evidence/2026-11-15/pd047-revision3-review-resolution1/result.json), [verdict](D:/Wanees-Delegation-Evidence/2026-11-15/pd047-revision3-review-resolution1/final.txt), [events](D:/Wanees-Delegation-Evidence/2026-11-15/pd047-revision3-review-resolution1/events.jsonl), [exact reviewed amendment](D:/Wanees-Delegation-Evidence/2026-11-15/pd047-revision3-review-resolution1/reviewed-amendment.md). The preceding role-clarification/timeout artifacts remain preserved alongside it.

After the PASS, only review-status/provenance metadata was reconciled in the amendment; its graph manifest, decision text, acceptance criteria and approval boundaries are identical to the reviewed snapshot. The validator's independent-review label now directs readers here and makes no independent verdict itself. Final working proposal SHA-256: **666431e0645aebd913d0351bd4a6b205051c8575d35995fd76c4888cc8d61ccf**.

The G01 independent review was not restarted or completed by this PD-047 review. BE-7 remains blocked by that separate review. No final-verdict is triggered: findings were resolved with evidence, no material disagreement remains and no push is requested.

## Exact remaining owner decisions and approvals

The detailed current register is [amendment §10](../../specs/002-p0-prd/backend-first-amendment.md#10-earliest-executable-batch-after-approval). U-b is settled; the current PD-047 review findings are closed. Outstanding items are:

| Scope | Remaining decision or approval | Timing |
| --- | --- | --- |
| G01 | Separate independent review evidence; not owner approval, not the completed five-file comparison | BE-7 remains blocked |
| PD-047 | Explicit owner ratification of Revision 3 sequencing, M1 split and precise partial amendments to PD-039/044/045; permission for the synchronized adoption edits in §9 | Before applying PD-047 |
| Revised Gate 2 package | Separately prepare/approve full plan/tasks changes, T083–T085 cards/test seams/field 13, revised T002/T058 and synchronized graph; branding T080–T082 remains separately unapproved | Before changed cards execute; no new Gate 2 approval here |
| Checklist / first batch | Explicit CHK001–CHK082 disposition; named implementation authorization for T001 and revised T002 | Before T001, then T002; prior T010/T035/T048 authorization remains scoped and blocked |
| Backend policies | F-01 OTP fallback/failure accounting; F-10 customer-operation stage cells; JG-08 pre-publication refusal contract; F-12 wizard bounds/expiry semantics; scoped OD-01–OD-18; missing schema/benchmark/journal briefs | Before the affected backend card, never guessed during implementation |
| Recovery / other journey limitations | F-03 customer recovery, F-04 reused-number security design, F-05 duplicate triage, F-06 owner recovery and F-07 invitation race/reissue mechanisms remain limited by their existing approvals and blockers | Their tagged recovery/invitation scope; U-b changes none |
| UI entry | Final Arabic/Latin name plus required checks; owner acceptance of the D1–D4/T084 implementation direction; reviewed per-card content and AA criteria; separately named UI implementation authorization | M1-UI / affected UI cards |
| A11Y-01 | Staff PIN SC 3.3.8 assisting mechanism/alternative and shared-device accountability choice | T021 and UI entry |
| F-02 / F-11 | Exact invite-acceptance timing events; reference cheap Android, tap convention and camera/rendering performance protocol | Before official T085 scoring |
| M-01-staging / data use | Ratify T085 placement/protocol and explicit fixture/test-identity/real-number/real-data scope; the U-b route itself is already selected | T085 |
| M-01-M5 | Whether M5 onboarding uses the real-staging record or also requires a pilot re-measurement | T056/M5; SC-003 still requires real pilot transactions |
| Plans | Owner-approved 1.6 plan limits/prices; verified rate evidence is not plan approval | T046, plan panel, M1-done |
| Branding | Separate Gate 2/contracts and D-1–D-7 dispositions; T080 entry-only T001 correction does not approve its branding content | T080–T082 |
| Operations / fork patch | Tagged legal, company, providers, cost, deployment, messaging, restore and pilot permissions; FP-003 verification gates and separate authorization | Their tagged cards; no first-batch waiver |

[research.md §5](../../specs/002-p0-prd/research.md#5-open-owner-decisions-raised-by-planning) remains the exact OD-01–OD-18 question register, with recommendations still Proposed. [JG consolidation](../../specs/002-p0-prd/journeys/jg-consolidation-review.md) remains authoritative for the scoped journey follow-ups. No blanket resolution or approval is inferred.

## Integrity record

- Revision 2 exact byte snapshot SHA-256: 9c9c1c529c0a1f05fda5ba9acfc702200ad6f26522acb8bf698714b6a8cd32bb.
- Source tasks SHA-256: 9d9b0fa1ca4f01878fa0851cd1f8d0d4074592a25cf5ef067272d180d54608c9.
- Protected 973-file aggregate SHA-256: e0fde1dfbd97104fd8a48bac686ca4e76b029faa0b67f7170a7ab0ddaee65b13.
- Staged-diff SHA-256: b7ee2e81588226f66a44e04ca22995a329646d436e257aa6e505423908a27d6a.
- Fleet configuration SHA-256 (21 lanes unchanged): f206b52a28f03a320ba38ca4a1b8ec0fabead2c4568801e9e9f38c427ce47385.

No implementation, application staging, Git staging, commit, push, deployment, production-data operation or security-setting change occurred.
