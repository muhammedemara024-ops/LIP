# Open owner decisions M-01 and A11Y-01: analysis and recommendations

**PD-047/U-b adoption note (2026-11-15):** U-b settles only the route question in M-01: implement backend first, then final UI, with official UX evidence through T085 on real staging. Remaining M-01 decisions are M-01-staging protocol/placement and M-01-M5 evidence reuse versus pilot re-measurement; neither is decided here. A11Y-01 remains open for the staff-PIN mechanism/alternative and shared-device accountability. Existing analysis/recommendations remain nonbinding; no threshold, policy or permission is inferred.

**Status**: **Analysis only, 2026-11-13. Nothing here is approved.**
- Both items stay open owner decisions (PD-045 item 3, PD-044 item 4).
- A recommendation is not a default (AGENTS.md §4).
- No PIN, OTP, roadmap or gate text is changed by this file.
- **Not reviewed by Sol yet**: its two relay attempts failed on the usage limit (`specs/002-p0-prd/evidence/entry-1.5-apply-20261113/review-report.md`).

## M-01 — Where does real-app verification sit relative to M1?

### Facts (verified)

| # | Fact | Source |
| --- | --- | --- |
| M-F1 | M1 = "PRD v1.0 + clickable Arabic prototype approved" | `docs/context/06-roadmap.md` milestone table |
| M-F2 | Implementation needs roadmap 1.2–1.6 done, including the accepted prototype, before any implementation task | `plan.md` Entry gates item 4; PD-039 item 4 and its clarification |
| M-F3 | 1.3 and 1.4 are done only when (a) and (b) are both recorded; (b) is measured on a testable 1.5 prototype | Roadmap rows 1.3 and 1.4; PD-045 item 1 |
| M-F4 | Prototype runs are provisional for navigation and taps. Device performance, camera, OTP delivery and service timing need later real-app verification | PD-045 item 3 (the owner's statement) |
| M-F5 | The award-flow goal is already verified on the real app: SC-003 and PD-028 require a median award flow ≤ 10 s "on real pilot transactions", a week-4 M5 go/no-go gate | `spec.md` SC-003; PD-028; roadmap Phase 5 DoD |
| M-F5a | The onboarding goal has **no stated real-app measurement basis**. PD-028 lists "owner onboarding under 15 minutes (task 1.4)" as an M5 operational gate, and the M5 DoD repeats it. But SC-001 ("invite acceptance to a published program and printable branch QR in under 15 minutes") does not say whether it is measured on the prototype or the real app. PD-028 ties it to task 1.4, whose part (b) is now prototype-based (PD-045) | PD-028; roadmap M5 DoD; `spec.md` SC-001 |
| M-F6 | Other real-app checks already exist: real-number OTP (task 2.4, needs 0.11); customer sees the award within 2 s (task 3.3, SC-004); the stamp wizard in under 3 min (task 3.7, SC-002); the staff PWA installs on Android and iOS (task 4.6); unassisted onboarding and join → earn → redeem (M4, SC-009); the load test (task 5.2) | Roadmap 2.4, 3.3, 3.7, 4.6, 5.2, M4 DoD; `spec.md` SC-002, SC-004, SC-009 |

### The risk

If 1.3 (b) and 1.4 (b) had to include real-device, camera, OTP-delivery or service timing, they would need the real app. The real app needs implementation, implementation needs M1 (M-F2), and M1 needs 1.3 and 1.4 (M-F3). That is a loop with no exit.

### Options (none approved)

| Option | What it means | Effect |
| --- | --- | --- |
| **A — Two evidence classes** | 1.3 (b) and 1.4 (b) are completed by **prototype evidence**, scored only after F-02 and F-11, and labelled *provisional*. Each item that needs the real app is listed in a **carry-forward register** and mapped to a later gate: OTP delivery → 2.4; the award flow → SC-003 at the pilot (M-F5); device and camera performance → a check the owner names; real-app onboarding time → see M-F5a | No loop. No threshold changes. The award flow is re-measured on real transactions. Onboarding needs the clarification below |
| B — Hold M1 for real-app results | 1.3 and 1.4 stay open until real-app checks | Loop: implementation can never start |
| C — Split M1 into M1a (design) and M1b (real app) | Implementation after M1a only | Same effect as A, but it changes the milestone structure, so it is a larger roadmap amendment |

**Agent recommendation (not a default): Option A.**
- It reuses gates that already exist (M-F5, M-F6) instead of adding a milestone, except for the two gaps below.
- It keeps the thresholds unchanged.
- It makes the provisional status visible.

It needs:
1. an owner-approved one-line roadmap clarification on rows 1.3 and 1.4 naming the two evidence classes;
2. a carry-forward register. *Proposed home:* a section in `D3-figma-requirements.md` §9, copied into the 1.3 and 1.4 measurement records;
3. a mapping of each register item to a later task. Two items have **no** exact existing home:
   - **Device and camera performance.** Roadmap 4.6 checks only that the staff PWA installs. No row checks camera scanning or rendering on a cheap Android phone. The owner names the home, for example a 4.6 or 5.x acceptance line.
   - **Real-app onboarding time (M-F5a).** The owner states whether PD-028's onboarding gate at M5 is met by the task 1.4 (b) prototype result, or re-measured on the real app during the pilot. Either answer leaves the 15-minute threshold unchanged.

**Safeguards that any option must keep:**
- A prototype result is never reported as real-device, camera, OTP-delivery or timing evidence.
- Every prototype record names the prototype version and states "prototype".
- An item that is NOT RUN stays NOT RUN.

## A11Y-01 — How does the staff PIN step meet WCAG 2.2 SC 3.3.8?

### Facts (verified)

From W3C *Understanding SC 3.3.8 Accessible Authentication (Minimum)*, fetched 2026-11-13:
- **The criterion:** "A cognitive function test (such as remembering a password or solving a puzzle) is not required for any step in an authentication process unless that step provides at least one of the following". The four exceptions are:
  - Alternative: "Another authentication method that does not rely on a cognitive function test";
  - Mechanism: "A mechanism is available to assist the user in completing the cognitive function test";
  - Object Recognition;
  - Personal Content.
- **Mechanisms, quoted:** "Examples of mechanisms that satisfy this criterion include: support for password entry by password managers to reduce memory need, and copy and paste to reduce the cognitive burden of re-typing."
- **Failure, quoted:** "if user agents and password managers are actively blocked from filling in the fields … the page would fail this criterion unless an alternative is provided".
- **Verification codes, quoted:** "A service that requires manual transcription of a verification code is not compliant … it must be possible for a user to at least paste the code".
- The page has **no** statement about shared devices or kiosks.

| # | Fact about our product | Source |
| --- | --- | --- |
| A-F1 | Cashiers sign in with a PIN on a device registered to a branch | FR-014, PD-010 |
| A-F2 | Profiles are picked on a shared counter device; the owner staff profile has its own PIN | `contracts/staff-api.md` `GET /profiles`, `POST /sessions`; FR-016 |
| A-F3 | A staff PIN never grants owner privileges; owner-only actions need an OTP to the owner's phone | FR-016 |

### Analysis

- A remembered, café-specific PIN is a password, and so a cognitive function test. **Inference:** the W3C names "remembering a password", and does not separately classify PINs.
- So the PIN step conforms only if paste and password-manager filling are not blocked (Mechanism), or if an alternative method exists.
- **Design consequence.** A PIN entered **only** through a custom on-screen keypad, with no fillable field, would block both mechanisms. That fails unless an alternative exists.
- **Accountability tension.** On a shared counter device, a browser password manager that saves several staff PINs lets anyone at that device sign in as any saved profile. That weakens per-staff attribution (FR-020 records the staff member). The risk comes from how a café operates its devices, not from the field itself.

### Options (none approved; FR-014, FR-016 and PD-010 unchanged in every option)

| Option | What changes | Conformance | Accountability |
| --- | --- | --- | --- |
| **1 — Fillable PIN field** | The PIN is a real input field (numeric keyboard, masked) that never blocks paste or autofill. An on-screen keypad may sit alongside it | Mechanism exception met | Unchanged by design. Saving PINs on a shared device becomes an operations question. *Possible* guidance to cafés: do not save staff PINs on counter devices. That is guidance, not a technical control, and not a new rule unless the owner adopts it |
| 2 — Non-cognitive alternative per staff member | A second method, for example a personal staff QR badge scanned by the device | Alternative exception met | A badge can be shared or lost; it is new scope (device, enrollment and revocation design) |
| 3 — Keypad-only PIN, no alternative | Nothing changes | **Fails SC 3.3.8** | Strongest local control |

**Agent recommendation (not a default): Option 1.**
- It is the smallest change: a UI constraint only, like the OTP rule in PD-044 item 4.
- It keeps the PIN rules.
- It meets the criterion through the Mechanism exception.

The owner decides whether to accept the shared-device risk, and whether to add operations guidance. Option 3 would contradict PD-044's AA target, so it would need an owner-approved, documented exception.

**Until A11Y-01 is decided:**
- CSH-03 stays **DD(A11Y-01)** in D1, and no AA claim is made for it.
- D3 draws the PIN screen as a field plus keypad, labelled "decision-dependent".
