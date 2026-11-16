# Review record: proposed 1.5 entry amendment package (2026-11-13)

**Risk**: HIGH. **Reviewer**: `plan-review`, gpt-6.1-sol, read-only (verified: hashes and git status unchanged).

## Initial review: CHANGES REQUIRED (verbatim)

**CHANGES REQUIRED.** The package preserves the intended safety boundaries, but its impact inventory and approval list need one governance correction and two exactness fixes. Review remained strictly read-only.

| ID | Severity | Location | Finding | Suggested fix |
| --- | --- | --- | --- | --- |
| R-01 | HIGH | Assessment P2.2, impact table and approval #1; [PD-039 item 4](D:/Projects/loyalty-interchange-protocol-main/docs/context/01-decisions.md:1907) | PD-039 explicitly says the plan’s Entry gates “stay exactly as written.” P2.2 changes that text without explicitly reconciling this Approved decision. Equivalent implementation restrictions do not eliminate the documentary conflict. | Add a narrow, dated PD-039 clarification/amendment permitting this prototype-sequencing edit while retaining all implementation prerequisites. Include it within approval #1; no sixth approval grouping is necessary. |
| R-02 | MEDIUM | Assessment P3 follow-on list; [cashier protocol](D:/Projects/loyalty-interchange-protocol-main/specs/002-p0-prd/journeys/1.3-cashier-journey.md:108) | The list names only the cashier Status, missing the operative restriction: scoring waits until “JG-11 is decided and the reference profile and the prototype are approved.” That leaves an approved-prototype prerequisite after the proposed sequencing change. | Explicitly include this paragraph. Distinguish a versioned, testable measurement prototype from final 1.5 acceptance. Preserve JG-11/F-11 and reference-profile approval requirements. |
| R-03 | LOW | Assessment P2.3; [current gate row](D:/Projects/loyalty-interchange-protocol-main/specs/002-p0-prd/tasks.md:64) | The “Before” quotation is inaccurate: the source says `before1.5/rebrand`, without a space. | Copy the current text exactly; normalize spacing in “After” only. |

The remaining P2/P3 “Before” quotations match the current files. Another omitted inventory location is [recovery procedures line 105](D:/Projects/loyalty-interchange-protocol-main/specs/002-p0-prd/journeys/1.2-recovery-procedures.md:105), which defers future evidence until the procedure and prototype are approved. Record it as **unchanged**: it is outside the requested 1.3/1.4 measurement reordering and does not add a measurement criterion to roadmap 1.2.

The substantive safety checks otherwise pass:

- P1/P2 retain final-name clearance, domain availability and conflict checks before prototype acceptance, 2.1, T058 and other branding-dependent work outside the prototype.
- P3 retains **≤ 2 taps per step on a cheap Android phone** and **under 15 minutes**, including invite acceptance as the timer start. Documentation acceptance alone cannot complete 1.3 or 1.4.
- M1, T001, T058 and implementation entry remain substantively unchanged. The plan’s wording changes, so its documentary impact is not nil.
- The assessment consistently presents amendments as proposed and unapplied. The spelling conclusion is correct across the five cited source locations: **ونيس — Wanees**.
- JG-04/JG-11, OD-01–OD-18 and F-01–F-12 remain unresolved. FP-003 remains unauthorized; its attribution algorithm remains unresolved.

The WCAG statements are accurate. SC 2.5.8 is AA in WCAG 2.2; its minimum target rule includes spacing and other exceptions. [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). SC 3.3.8 is also AA and permits specified alternatives or assistance mechanisms; the PIN/OTP issue is correctly framed as a check, not a finding of incompatibility. [W3C authentication guidance](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html). Figma evidence cannot establish shipped-UI conformance, which requires evaluation of implemented full pages and complete processes. [W3C conformance guidance](https://www.w3.org/WAI/WCAG22/Understanding/conformance.html).

Scope (a) adds a prototype design target; scope (b) adds a product requirement requiring PRD and task-card review. **Both scopes still require the separate P2.4 PRD Dependencies amendment.** The proposal’s Figma measurement limitations are appropriately acknowledged.

**Owner-decision items, separate from review findings:**

1. Approve PD-029 A1 and each propagation, **including the PD-039 reconciliation above**.
2. Approve P3’s documentation/measurement split and dependency change.
3. Accept journey documentation on the explicitly decision-dependent basis.
4. Approve Figma, both locales and the selected WCAG scope.
5. Separately authorize starting non-production 1.5 under the aligned brief.

These five groupings are otherwise sufficient for the selected direction. Nothing currently listed as “not needed to start” must move to the start gate: F-02/F-11 and R2 await scoring; final-name clearance awaits acceptance; other unresolved values remain visibly decision-dependent.

Standards: three findings, highest HIGH. Spec/exactness: two shared findings, highest MEDIUM. No tests or verification suites were run; this was a document and source review.

## Disposition

R-01 to R-03 were accepted on evidence:
- R-01: P1a adds the PD-039 item 4 clarification, folded into approval 1.
- R-02: the operative 1.3 scoring rule now names a versioned measurement prototype, distinct from 1.5 acceptance; the 1.2 recovery line is recorded as unchanged.
- R-03: the before1.5 quote is now verbatim.

The impact table now records that the plan document changes even though implementation entry is unchanged in effect.

## Round 1: APPROVED

R-01 to R-03 are CLOSED, and there are no new issues. The verdict covers the proposed package only; the owner approvals are still pending. Fable was not required. A Fable review is still mandatory before any push.
