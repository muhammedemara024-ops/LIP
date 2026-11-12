# Feature Specification: [Product] — P0 PRD v1.0 (multi-tenant café loyalty SaaS)

**Feature Branch**: `002-p0-prd` (no git branch created; spec directory only)

**Created**: 2026-11-12

**Status**: Approved at Gate 1 (project owner, 2026-11-12) — PRD v1.0 only. Clarified 2026-11-12; Gate 1 audit changes applied 2026-11-12 (decisions PD-030 to PD-037); Gate 1 interpretations PD-038 P1–P10 approved by the owner 2026-11-12 (P3, P6, P7 and P8 with revisions). Final independent review: Fable 5.1 APPROVED WITH CONDITIONS; its documentation conditions were closed and its closure check returned APPROVED (2026-11-12). Gate 1 approval is limited to this PRD and its approved product requirements; it does **not** approve FP-003 implementation and its unresolved point-lot attribution algorithm; application code changes; running `/speckit-plan` or `/speckit-tasks`; committing or pushing; pilot readiness. SC-017 and the FP-003 implementation blockers (Dependencies) remain mandatory before any points-program pilot

**Input**: User description: "Create the P0 PRD v1.0 specification for our multi-tenant café loyalty SaaS. Use the approved PD-001 through PD-029 decisions, business rules, product brief, gap analysis, architecture map, and Phase 1 Task 1.1 acceptance criteria as authoritative sources."

**Roadmap task**: 1.1 (PRD v1.0: scope, roles/permissions matrix, user stories, business rules, out-of-scope).

## How to read this specification

- **Authority.** This PRD restates approved decisions; it does not change them. Order of authority (docs/context/README.md): `docs/context/01-decisions.md` (Approved entries only) > `spec/` > `docs/context/04-business-rules.md` > other context documents. Where this PRD and those sources ever disagree, the sources win and this PRD must be corrected.
- **Decision references.** "(PD-0xx)" points to the approved decision a requirement comes from; "(BR)" points to `04-business-rules.md`. Requirements with no reference are PRD-level product requirements derived from the roadmap acceptance criteria.
- **Gate 1 interpretations.** "(PD-038 Pn)" cites an interpretation drafted by the agent and approved by the owner on 2026-11-12, four of them with owner revisions (Constitution Article III; the owner's words are recorded in `01-decisions.md`).
- **Two priority scales.** *Product priority* uses P0 (first sellable release), P1 (after MVP proof), P2 (later). Everything in the user stories below is **P0**. The *story priority* label on each story (Story priority 1–3) is only the delivery order inside P0.
- **Name.** `[Product]` is the temporary product name (PD-029).
- **Dependency labels.** **[0.10]** = depends on the legal opinion of roadmap task 0.10; **[0.11]** = depends on the company registration of task 0.11 for live messaging; **[VERIFY]** = technical behaviour that still needs executable verification before it can be relied on.
- **No implementation.** Technology, data layout and interfaces are out of scope for this document and belong to `/speckit-plan`.

## Clarifications

### Session 2026-11-12

- Q: How should a wrong bill amount be corrected once the customer has left the counter? → A: Option A with safeguards. Customer present: the existing full void, reconciled, then a genuine re-capture with the customer's code. Customer absent: the original purchase and visit stay; the owner posts a classified `correction` adjustment for the exact points difference (positive or negative), computed with the earning rules in force at the original purchase, linked to that purchase, with fresh owner authentication, a mandatory reason, idempotency and audit. It is not a purchase, visit, redemption or reward issuance and does not count in KPIs. Stamp programs: a wrong amount alone does not change stamps; a purchase that should not have earned uses the full void. "Fresh code" means fresh owner authentication, never a customer code. Refinement: a later, genuinely distinct correction of the same purchase is allowed when new evidence justifies it (fresh owner authentication, mandatory reason, separate audit, idempotent); each correction is computed against the original purchase plus all corrections already applied, so the same discrepancy is never credited or clawed back twice. **Superseded in part (Gate 1 decision D2, PD-030):** the customer-absent `correction` path, including later distinct corrections, is deferred to P1; the customer-present path and the stamp rule stand.
- Q: Is the café's join QR the same printed branch QR that members scan to create a pending purchase claim, or a separate code? → A: Option A — one printed Branch QR per branch. A non-member who scans it signs in and joins that café, attributed to that branch; joining alone never creates a purchase or grants value; the customer may then explicitly start a separate pending claim in the same branch context. An existing member who scans it can create a pending claim under the approved claim rules. One QR per branch is rotated; the server rejects rotated-out and deactivated-branch QR credentials. Affected pending claims follow the existing expiry, cancellation and reconciliation rules; the 15-minute claim lifetime and all claim safeguards are unchanged. Confirmed (FR-032): rotation invalidates the old QR for new scans only and does not cancel already-created valid claims, which keep their own 15-minute lifetime and normal confirmation rules; branch deactivation still cancels them.
- Q: What counts as one "visit" when the KPIs and the 30-day repeat rate are calculated? → A: Option A — one visit per café per `Africa/Cairo` calendar day with at least one successful, non-voided qualifying purchase at that café (any branch). Same-day purchases, including across branches of the same café, are one visit. A repeat needs a qualifying purchase on a different Cairo day within the 30-day window. Redemption-only orders, owner adjustments, migration credits, idempotent retries and synthetic transactions never count. (Gate 1: "synthetic transactions" means test, probe or monitoring transactions, not real purchases represented as synthetic order lines — FR-159, PD-038 P3.) Purchase and accounting records stay separate; only visit analytics are aggregated. If a day's only qualifying purchase is voided, the day stops counting; if another remains, it still counts. The same definition applies to visit frequency, first-visit date, repeat rate and week-8 reporting.
- Q: What service availability should P0 commit to for awarding and redeeming during the pilot? → A: Option A — an internal SLO (not a contractual SLA or customer-facing guarantee): award and redemption availability measured separately, each ≥ 99.5% per calendar month over 08:00–02:00 `Africa/Cairo` daily (overnight portion included), measured by representative end-to-end checks of real service capability, not server uptime or HTTP status alone. Every outage longer than 5 minutes is logged (start, end, affected cafés, affected operations, recovery details) and reviewed weekly during the pilot. Monitoring gaps never count as uptime; they are reported separately and investigated. PD-003 is unchanged: no offline cashier awards or retroactive purchases; owner `service_recovery` adjustments remain the only recovery mechanism.
- Q: When the owner works the counter, which identity do they use to award and redeem? → A: Option A — a dedicated owner staff profile (own PIN, own verified phone), usable only on registered branch devices, following the same cashier limits, verification and audit rules. Audit keeps both the owner identity and the acting staff profile, with branch, device and operation type. A staff PIN never grants owner privileges; owner-only actions need fresh owner authentication and explicit authorization even when started from that session. The PD-003 owner self-award exception stays, specifically identified and audited. The 10-minute self-void limit and 5× bill safeguard still apply; any approved owner override (PD-008 owner void, owner adjustment above 5×) is explicit, authenticated and audited, never a silent bypass. No duplicate owner account; owner credentials are never exposed to staff sessions.
- Q (`/speckit-specify` Q1): Should P0 enforce plan limits? → A (owner, verbatim): "Q1: A. P0 defines and monitors plan limits but does not enforce subscription capacity limits automatically. Enforcement remains in P1 Task 6.3. Existing security limits, billing-stage restrictions, tenant isolation, and accounting safeguards remain fully enforced." (PD-035)
- Q (`/speckit-specify` Q2): How large must the week-8 cohort be for a conclusive result? → A (owner, verbatim): "Q2: A, with clarification. Require at least 100 eligible customers across the pilot cafés for a conclusive exploratory Week 8 repeat-rate assessment. Below 100, label INCONCLUSIVE. Always report numerator, denominator, measured rate, and per-café descriptive breakdowns. This is not a statistically proven causal lift or an automatic go/no-go gate." (PD-036)
- Q (`/speckit-specify` Q3): Should P0 support owner partial refunds? → A (owner, verbatim): "Q3: A, with safeguards. P0 supports full voids only, not direct partial-refund clawbacks. For a corrected bill amount, complete the authorized full void and its reconciliation first, then record a new purchase for the corrected amount using a distinct operation identity. Never create the replacement purchase while the original void is unresolved. Preserve audit linkage and all loyalty-accounting invariants." (PD-030)
- Gate 1 decisions (owner, 2026-11-12), recorded in `01-decisions.md`: D1 → points voids reverse the original accrual through fork patch FP-003, design only (PD-037); D2 → customer-absent amount corrections deferred to P1, and owner `service_recovery` is not an equivalent accounting correction (PD-030); D3 → plan limits monitored without enforcing customer, branch or message caps (PD-035); D4 → each visit attributed to the branch of its day's first qualifying purchase, recomputed after voids (PD-032); D5 → conservative SLO: 99.5% per operation, at least 99.5% monitoring coverage, no PASS unless met with missing minutes counted as unavailable (PD-033); D6 → owner clarification answers recorded as Approved with provenance (PD-030 to PD-036), agent-derived interpretations recorded as Proposed (PD-038).
- PD-038 owner decisions (2026-11-12): P1, P4, P9 and P10 approved as written; P2 approved including the minimum-eligible-spend rule; P5 approved with acquisition-branch cohorts labelled separately from branch activity; P3 (test café isolation), P6 (a definite failure stays FAIL whatever the coverage), P7 (no double debit of already-expired points; formula validated by regression tests before implementation approval) and P8 (ledger recovery, verified zero-accrual versus uncertain states) approved with revisions.

## Roles and permissions matrix (P0)

Roles (PD-014): **Super Admin** (platform operator), **Owner** (one per café), **Cashier** (staff on a registered branch device), **Customer**. Branch Manager is P1. Every permission is enforced by the server; the café and branch always come from the signed-in session or registered device, never from what a client sends (PD-014).

| Capability | Super Admin | Owner | Cashier | Customer |
| --- | --- | --- | --- | --- |
| Provision a café and send the owner invite (PD-011) | ✓ | — | — | — |
| Record offline payments; set or extend plan and period end (PD-005 A1, PD-017) | ✓ | — | — | — |
| Read customer directory data (audited with a reason, PD-013) | ✓ | — | — | — |
| Create/edit branches, opening hours; deactivate/reactivate a branch (PD-026) | — | ✓ | — | — |
| Rotate a leaked Branch QR (PD-005 A2) | — | ✓ | — | — |
| Create/deactivate staff, register/revoke devices (fresh OTP for staff changes, PD-010) | — | ✓ | — | — |
| Create, publish and change the program and rewards (fresh OTP, PD-010, PD-025) | — | ✓ | — | — |
| Post a classified manual adjustment (fresh OTP; cashier cap 0, PD-003) | — | ✓ | — | — |
| Paper-card migration (from the owner staff profile on a registered device, with fresh owner authentication, PD-021, FR-016) | — | ✓ | — | — |
| Award a purchase / confirm a pending claim | — | ✓ via owner staff profile (PD-014, FR-016) | ✓ own branch | — |
| Reserve and capture a reward at the counter | — | ✓ via owner staff profile (FR-016) | ✓ own branch | — |
| Void own purchase within 10 minutes (PD-008) | — | — | ✓ | — |
| Void any purchase / settle a *needs owner* void (PD-008 A1) | — | ✓ | — | — |
| See customer first name + card progress | — | ✓ | ✓ | own cards |
| See visit history + last 3 phone digits; search by first name + last 3 digits (PD-013) [0.10] | — | ✓ | — | own |
| Export customers | — | ✗ (P0) | ✗ | — |
| View fraud alerts and mark reviewed (PD-027) | — | ✓ | — | — |
| See plan, period end and subscription stage (PD-017, PD-018) | ✓ | ✓ | — | — |
| Join a café, show member QR, show reward QR, revoke own devices, delete account | — | — | — | ✓ |
| Accept or decline a pending paper-card migration (PD-022) | — | — | — | ✓ |

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Customer joins a café and holds a digital loyalty card (Story priority 1)

A café customer scans the printed Branch QR of the branch they are in, signs in with their Egyptian mobile number and a one-time code, gives a first name once, and immediately sees that café's card. The same account later joins other cafés without retyping anything (PD-001, PD-004, PD-023).

**Why this priority**: Nothing else works without a customer account and a card per café.

**Independent Test**: With one published café program, a new phone number completes join → OTP → first name → card visible; the same number then joins a second café without being asked for a name again, and each café sees only its own member.

**Acceptance Scenarios**:

1. **Given** a café with a published program, **When** a new customer scans one of its Branch QRs, enters a valid Egyptian mobile number and the correct one-time code, and enters a first name, **Then** a universal customer account and a card for that café are created, the join is attributed to the scanned branch, and the card shows zero progress; joining alone creates no purchase and grants no stamps or points.
2. **Given** an existing customer of café A, **When** they join café B, **Then** no first name is requested again, café B gets its own independent card, and café A cannot see café B's membership.
3. **Given** the join screen, **When** it is shown, **Then** marketing consent for that café is optional, unchecked by default, and declining it does not block joining.
4. **Given** a first visit on any device, **When** the app opens, **Then** it is in Arabic (right-to-left) regardless of browser or phone language, and the customer can switch to English, with the choice remembered (PD-007).
5. **Given** a non-Egyptian or malformed mobile number, **When** it is submitted, **Then** it is rejected before any code is sent.
6. **Given** a café in the suspended stage, **When** a new customer tries to join it, **Then** joining is refused with a clear message, while existing members keep their cards (PD-005 A2).
7. **Given** too many code requests or wrong codes, **When** limits are exceeded, **Then** sending or verifying is refused per the approved limits (PD-004, PD-020).

---

### User Story 2 — Cashier awards a purchase by scanning the customer's code (Story priority 1)

At the counter the customer opens their card, which shows a rotating code bound to their device and that café. The cashier, signed in with a PIN on a registered branch device, scans it, types the bill amount, sees a preview of what will be earned, and confirms (Method B, PD-003 A1, PD-008).

**Why this priority**: This is the core value loop and the preferred anti-fraud capture path.

**Independent Test**: On a registered device at an active branch, scanning a valid customer code and confirming an amount posts the correct stamps or points once; repeating the same submission does not award twice.

**Acceptance Scenarios**:

1. **Given** a signed-in cashier and a customer showing a valid code, **When** the cashier scans, types an amount and confirms, **Then** the customer's balance increases exactly once and the customer sees it within 2 seconds.
2. **Given** a confirm screen, **When** it is shown, **Then** it displays the typed amount and the stamps/points that will be earned, as calculated by the loyalty engine (never estimated on the device).
3. **Given** an amount above the café's large-bill threshold, **When** entered, **Then** it must be typed a second time; **Given** an amount above 5 × the threshold, **Then** it is rejected and can only be awarded by the owner as a classified adjustment (PD-008, PD-020).
4. **Given** a code that was already used, has expired, belongs to another café or to a revoked device, **When** scanned, **Then** the award is refused with a clear error.
5. **Given** a cashier whose verified phone number belongs to the scanned customer account, **When** they try to award, **Then** it is refused; the owner can do it with an audit record (PD-003).
6. **Given** the cashier's device is offline, **When** they try to award, **Then** nothing is granted and a clear error is shown; no retroactive cashier award is possible later (PD-003).
7. **Given** a zero amount, **When** confirmed, **Then** nothing is earned (minimum eligible spend ≥ 1 piaster, PD-012).
8. **Given** a café in the suspended stage, **When** a cashier tries to award, **Then** it is refused (PD-005 A2).
9. **Given** a genuinely new award to the same customer at the same café within 10 minutes, **When** the cashier confirms, **Then** an extra confirmation is required that shows no customer information beyond first name and card progress; an automatic retry of the same submission never triggers it (PD-027).
10. **Given** a stamp program, **When** a purchase completes the card, **Then** exactly one reward is issued per threshold reached and the card resets (PD-012).

---

### User Story 3 — Customer redeems a free-item reward at the counter (Story priority 1)

The customer opens an earned reward (stamp program) or picks one of the café's points rewards; the app only displays a reward code. The cashier scans it, the reward is held, the cashier hands over the item and confirms; an abandoned hold is released automatically (PD-015, PD-024, BR rewards).

**Why this priority**: Rewards are the reason customers participate.

**Independent Test**: A customer holding one issued stamp reward redeems it once at the counter; a second attempt, a concurrent attempt from another cashier, and an attempt from the customer's phone all fail.

**Acceptance Scenarios**:

1. **Given** an issued stamp reward, **When** the cashier scans the reward code and confirms hand-over, **Then** the reward is consumed exactly once.
2. **Given** two cashiers scanning the same reward at the same time, **When** both confirm, **Then** only one succeeds.
3. **Given** a points program with several rewards, **When** the customer picks one and the cashier confirms, **Then** the cost recorded is the cost at the moment the hold was created, even if the owner changes the cost meanwhile (PD-025).
4. **Given** an order that already used a reward, **When** a second reward is attempted for the same order, **Then** it is refused (one reward per order, PD-015).
5. **Given** a hold not confirmed within 120 seconds, **When** time passes, **Then** the hold is released and the reward or points become available again (PD-020).
6. **Given** a balance smaller than the reward cost, **When** redemption is attempted, **Then** it is refused; a redemption never takes a balance below zero (PD-015).
7. **Given** a customer who redeems without buying anything, **When** the cashier records the redemption, **Then** it is recorded as a redemption-only visit that earns nothing (PD-008 A1).
8. **Given** the customer app, **When** the customer taps "Redeem", **Then** it only shows the reward code; the app can never hold or consume a reward itself (PD-003).
9. **Given** a café in any subscription stage, **When** a customer redeems what they hold, **Then** it is allowed (PD-005 A2).

---

### User Story 4 — Owner onboards a café by invitation and publishes a program (Story priority 1)

The Super Admin provisions the café and sends a single-use invite bound to the owner's phone. The owner accepts it, signs in with a one-time code, creates a branch with opening hours, builds a stamps or points program without technical knowledge, publishes it, and prints the branch QR — all in under 15 minutes from invite acceptance (PD-010, PD-011, PD-012, PD-024, PD-026).

**Why this priority**: Without a published program no café can operate; onboarding speed is a pilot gate (PD-028).

**Independent Test**: A non-technical person goes from invite acceptance to a published "5 drinks → 1 free" program and a printable branch QR, timed, without help.

**Acceptance Scenarios**:

1. **Given** a valid invite, **When** the owner accepts it within 72 hours with the bound phone number and a correct code, **Then** the owner account is created and the invite cannot be used again (PD-011).
2. **Given** an expired, used, or other-number invite, **When** used, **Then** it is refused.
3. **Given** the program wizard, **When** the owner creates a stamp program, **Then** it offers exactly one free-item reward, the card always resets on reward, and stamps never expire (PD-012, PD-024).
4. **Given** the program wizard, **When** the owner creates a points program, **Then** it suggests 5 points per 100 EGP, allows up to 5 active free-item rewards with positive whole-number costs, and offers point expiry of 180, 365 (default), 545 or 730 days, or never (PD-020, PD-024).
5. **Given** reward names, **When** entered, **Then** a name in the café's main language is required and the second language is optional (PD-007).
6. **Given** a publish attempt, **When** the owner confirms, **Then** a fresh one-time code is required and the publish is audited (PD-010).
7. **Given** a published program, **When** the owner tries to change the program type or the stamp threshold, **Then** it is refused (PD-012, PD-025).
8. **Given** a café in the read-only or suspended stage, **When** the owner tries to publish or change the program, **Then** it is refused (PD-005 A2).

---

### User Story 5 — Mistakes are fixed safely with voids and owner corrections (Story priority 1)

A cashier who typed a wrong amount voids their own purchase within 10 minutes and, with the customer still present, re-captures it. The owner can void any purchase. In stamp programs a void cancels only as many stamp rewards issued since the purchase as are needed and restores their stamps, so the card ends in a valid state. In points programs a void reverses exactly what the purchase earned. A void interrupted by a failure is completed safely or escalated. P0 has no partial refunds and no amount correction once the customer has left (PD-008, PD-008 A1, PD-003 A2, PD-019, PD-030, PD-037).

**Why this priority**: Financial integrity of balances is a pilot gate (zero data-integrity incidents, PD-028).

**Independent Test**: In a stamp program, void a purchase that completed a card while the reward is still unredeemed; the reward is cancelled, the card balance ends between 0 and threshold − 1, and replaying the void after a simulated crash changes nothing further.

**Acceptance Scenarios**:

1. **Given** a cashier's own purchase less than 10 minutes old, **When** they void it, **Then** all value it granted is clawed back once and the void is audited; **Given** another cashier's purchase or one older than 10 minutes, **Then** the cashier cannot void it.
2. **Given** a stamp purchase that earned a stamps, a current card balance cur and threshold t, **When** it is voided, **Then** the system computes once k = max(0, ⌈(a − cur) / t⌉), cancels k candidate rewards (issued, unreserved `stamp-<member>-<n>` rewards numbered above the purchase's saved marker, newest first), claws back the purchase, restores k × t stamps when k > 0, and the final balance cur + k × t − a lies in [0, t) (PD-008 A1).
   - *k = 0*: t = 5, the purchase earned 1 stamp and completed a card, later purchases bring cur to 2 → k = 0: no reward is cancelled, no stamps are restored, and the final balance is 1.
   - *k = 1*: t = 5, cur = 0 right after the purchase that earned 1 stamp and issued a reward → that reward is cancelled, 5 stamps are restored, the final balance is 4.
   - *C1*: some candidates are redeemed or reserved but at least k are cancellable → the void cancels k cancellable ones and succeeds.
   - *C2*: an owner gift reward exists → it is never a candidate (its id never starts with `stamp-`).
   - *C4*: a crash after the clawback step → recovery replays the saved plan (cur, a, t, k, chosen reward ids, exact request bodies) and never recomputes it; no extra stamps are restored.
3. **Given** a stamp program and fewer cancellable rewards than needed, a program republished since the purchase, a balance outside [0, threshold), or another void open for that member, **When** a void is requested, **Then** it is blocked and sent to the owner (PD-008 A1). **Given** a points program, **Then** these stamp-only preconditions do not apply: a points void after an earn-rate republish proceeds and reverses the original accrual (FR-068); it runs under the same per-member serialization and is refused while another void for that member is in progress (PD-038 P10).
4. **Given** a stamp void in progress for a member, **When** any purchase, redemption, owner adjustment, migration, campaign or import would change that member's balance or rewards, **Then** it is refused with a clear message until the void is reconciled; only the void's own steps and the owner's settlement of a *needs owner* void are allowed through (PD-008 A1). **Given** a points void in progress, **Then** the same block applies, with durable blocking, and only successful reconciliation clears it (PD-038 P10).
   - **Given** the owner submits a settlement of a *needs owner* void, **When** reconciliation has not yet verified every expected effect (reward cancellations, clawback and, when required, the stamp restore, including the settlement), **Then** the block stays; neither the settlement submission, an escalation nor an administrative closure clears it (PD-008 A1 *Recovery*).
5. **Given** a stamp void interrupted by a failure, **When** recovery runs, **Then** it completes using the saved plan without creating a second effect; after 15 minutes it is marked *needs owner*, after 24 hours escalated to the Super Admin, and the block lifts only after every expected effect is verified (PD-008 A1, PD-020). **Given** an interrupted points void, **Then** it is replayed forward only with the same adjustment id and body, never creating a second effect (FP-003 item 7, PD-037); the *needs owner*/escalation timeline and the block-until-reconciled rule apply to points voids too (PD-038 P10).
6. **Given** an owner correction, **When** posted, **Then** it needs a fresh one-time code, a classification and a reason, is audited, and a stamp adjustment outside a void must keep the balance within [0, threshold) (PD-003, PD-008 A1, PD-010).
7. **Given** a points purchase, **When** voided, **Then** exactly the points it earned (net of earlier adjustments to it) are reversed, even if the earn rate, multiplier or expiry setting changed since; points of that purchase that already expired are not debited again, while its points already spent on rewards are still reversed (PD-038 P7); the soonest-expiring points are consumed first and the balance may go negative (FR-068, PD-037, PD-020, BR).
8. **Given** a wrong bill amount and the customer still at the counter, **When** it is corrected, **Then** the full void completes and reconciles first, the corrected amount is re-captured with the customer's code as a new operation, a re-capture attempted while the void is unresolved is refused, and the audit links the original purchase, the void and the re-capture (FR-171).
9. **Given** a purchase recorded at 200 EGP instead of 120 EGP and the customer has left, **When** the owner reviews it, **Then** P0 offers no amount correction: the purchase stays as recorded unless the owner voids it in full, and no manual adjustment is offered, linked or labelled as an amount correction (FR-172, FR-173, PD-030).
10. **Given** a points purchase whose accrual result is missing from our records, **When** a void is requested, **Then** the result is recovered from the loyalty platform's ledger records, never by sending the purchase again; **Given** a complete, authoritative ledger read shows the purchase earned exactly 0, **Then** it is voided with no points reversal; if it was a qualifying purchase (for example above the minimum eligible spend but with points rounded down to 0) its visit is removed as for any void, and a purchase below the minimum eligible spend never created a visit (FR-159); **Given** such a read shows a positive accrual (matching our stored result when we still have one), **Then** the void proceeds under FR-068; **Given** neither can be verified (no accrual found, more than one, an incomplete read, or records that disagree), **Then** nothing is posted, zero is never assumed, the member stays blocked and the void goes to reconciliation (*needs owner* after 15 minutes) (FR-069, PD-038 P8).
11. **Given** a stamp purchase with a wrong amount above the minimum eligible spend, **When** the owner reviews it, **Then** no stamp change is made; **Given** the purchase should not have earned at all, **Then** the full void is used (FR-174).

---

### User Story 6 — Customer claims a purchase by scanning the branch QR (Story priority 2)

When the customer's code cannot be scanned, the customer scans the printed Branch QR (the same code used to join, one per branch) and explicitly starts a pending claim showing their first name and a short claim code. The cashier types the claim code and the bill amount; nothing is granted until then (Method A, PD-003, PD-020).

**Why this priority**: Fallback path; the staff scan remains preferred.

**Independent Test**: A pending claim grants nothing until a cashier at that branch types the correct code and amount; three wrong codes cancel it; it expires after 15 minutes.

**Acceptance Scenarios**:

1. **Given** a customer scanning a branch QR, **When** the claim is created, **Then** it is worth nothing until confirmed and the customer has at most one open claim at that branch.
2. **Given** an open claim, **When** the cashier types the correct claim code and an amount, **Then** the purchase is awarded once.
3. **Given** three wrong codes on a claim, **When** entered, **Then** the claim is cancelled; **Given** 15 minutes pass, **Then** it expires (PD-020).
4. **Given** a rotated-out Branch QR or the QR of a deactivated branch, **When** scanned, **Then** the server rejects it and neither a join nor a claim is created (PD-005 A2, PD-026).
5. **Given** a café in the suspended stage, **When** a cashier tries to confirm a claim, **Then** it is refused (PD-005 A2).
6. **Given** a non-member who just joined through a Branch QR, **When** they choose to claim a purchase, **Then** a separate pending claim is created for that branch only after an explicit action; the join itself granted nothing.
7. **Given** an open claim when its branch's QR is rotated, **When** the cashier types its code within 15 minutes, **Then** it is confirmed under the normal rules; rotation stops new scans of the old QR only; **Given** the branch is deactivated instead, **Then** the open claim is cancelled (PD-026).

---

### User Story 7 — Owner manages staff, devices and branches (Story priority 2)

The owner adds cashiers (phone verified by one-time code at creation), registers branch devices, sets each branch's weekly opening hours, rotates a leaked branch QR, revokes a lost device or a former employee, and can deactivate a branch (PD-003, PD-010, PD-014, PD-026).

**Why this priority**: Required to operate more than one person or branch safely.

**Independent Test**: A revoked device or deactivated branch can no longer award, confirm claims or redeem, while all history and customer balances remain.

**Acceptance Scenarios**:

1. **Given** the owner creates or deactivates a staff member, **When** they confirm, **Then** a fresh one-time code is required and the action is audited (PD-010).
2. **Given** a staff member's phone number change, **When** requested, **Then** it needs owner approval (PD-003).
3. **Given** a lost device, **When** the owner revokes it, **Then** it can no longer act, in every subscription stage (PD-005 A2).
4. **Given** a cashier of branch X, **When** they try to act for branch Y or another café, **Then** it is refused (PD-014).
5. **Given** a branch deactivation, **When** confirmed, **Then** its devices, staff sessions and branch QR stop working immediately, open claims there are cancelled and open reward holds there are released, with no double redemption or lost balance; customers keep balances and rewards for the café's other active branches (PD-026).
6. **Given** opening hours with an overnight shift or a closed day, **When** saved, **Then** they are stored in Cairo time and used only for alerts, never to block a purchase (PD-026).
7. **Given** a leaked branch QR, **When** the owner rotates it, **Then** the old QR stops working, in every subscription stage (PD-005 A2).
8. **Given** the owner at the counter, **When** they sign in with their owner staff profile PIN, **Then** they can award and redeem under the same limits as a cashier, each action is audited with both the owner identity and the staff profile, and any owner-only action from that session (for example voiding another cashier's purchase or awarding above 5 × the threshold) prompts for fresh owner authentication and is audited as an override (FR-016).
9. **Given** someone who knows the owner staff profile PIN but not the owner's phone, **When** they attempt an owner-only action, **Then** it is refused (FR-016).
10. **Given** the owner awards their own customer account from the owner staff profile, **When** confirmed, **Then** it succeeds and is recorded as an owner self-award audit entry; **Given** an ordinary cashier tries the same for their own account, **Then** it is refused (FR-028).

---

### User Story 8 — Owner sees customers, transactions, rewards and KPIs (Story priority 2)

The owner dashboard has 8 pages — Overview, Customers, Programs, Transactions, Rewards, Branches, Staff, Settings — with Overview KPIs, a "needs attention" section, branch filters, and the plan, period end and subscription stage (PD-013, PD-017, PD-018, PD-026, PD-027).

**Why this priority**: Owners must see value to keep paying; KPIs feed the pilot review.

**Independent Test**: Overview numbers reconcile with recorded activity in a controlled scenario; customer data shown is limited to the approved fields.

**Acceptance Scenarios**:

1. **Given** the Customers page, **When** the owner views a customer, **Then** only first name, card progress, visit history (with branch) and the last 3 phone digits are shown, and search works only by first name plus last 3 digits [0.10] (PD-013).
2. **Given** the Overview, **When** shown, **Then** it displays total customers, active in last 30 days, visits (as defined in FR-159), rewards redeemed (counted from confirmed redemptions), customers near a reward, and customers inactive 30 days, and these reconcile with the recorded activity (PD-015, PD-018).
3. **Given** an activity report (visits, awards, redemptions, transactions), **When** a branch filter is applied, **Then** only that branch's activity is shown; visits are counted at the branch they are attributed to (FR-162), so branch visit totals add up to the café total (PD-026, PD-032). **Given** the 30-day repeat rate, **When** a branch filter is applied, **Then** it is shown as an acquisition-branch cohort report, labelled as such, whose repeats may happen at any branch (FR-163).
4. **Given** Overview and Settings, **When** shown, **Then** they display the plan, period end date and current subscription stage (PD-017, PD-018).
5. **Given** a customer export request, **When** attempted, **Then** no export exists in P0 (PD-013).
6. **Given** a café over a plan limit (for example more customers than its plan allows), **When** the Super Admin views it, **Then** usage against the limit is visible (PD-038 P9), and no join, branch, staff or message action is refused because of the limit in P0 (FR-095, PD-035).

---

### User Story 9 — Super Admin records payments and the subscription stage follows the period end (Story priority 2)

Payment is collected offline; the Super Admin records each payment and sets or extends the plan and period end. After the end date the café automatically moves through grace (days 1–7), read-only (days 8–37) and suspended (day 38 onward) in Cairo calendar days, with the approved permission table; recording a payment restores full service immediately (PD-005 A1, PD-005 A2, PD-017, PD-020).

**Why this priority**: The business model depends on it; it is P0 by PD-017.

**Independent Test**: Advance a café past its period end and check each stage's allowed and refused actions against the PD-005 A2 table; record a payment and confirm immediate restoration.

**Acceptance Scenarios**:

1. **Given** a payment record, **When** submitted twice by accident, **Then** it is recorded once; payment records are never edited or deleted, only reversed by a new entry (BR).
2. **Given** any change to plan or period end, **When** saved, **Then** it is audited with actor, before/after and time.
3. **Given** each stage, **When** each action in the PD-005 A2 table is attempted, **Then** it is allowed or refused exactly as the table says, including redemptions, voids, corrections, revocations and branch QR rotation remaining allowed when suspended.
4. **Given** a lapsed café, **When** a payment extends the period, **Then** full service returns immediately.
5. **Given** the stage engine, **When** a café is read-only or suspended, **Then** customers' balances are never removed.

---

### User Story 10 — Customer manages their own card, devices and account (Story priority 2)

The customer sees each card's progress, rewards, visit history with branch, balances expiring soon (with date and time in Cairo), their registered devices (at most 3, revocable), can edit their first name, switch language, sign out of all devices, change their phone number, and delete their account across all cafés (PD-003 A1, PD-004, PD-007 C1, PD-016, PD-023, PD-026).

**Why this priority**: Trust and privacy obligations; reduces support load.

**Independent Test**: A customer revokes a device and its codes stop working; a customer deletes their account and their personal data is erased while café ledgers remain consistent.

**Acceptance Scenarios**:

1. **Given** a fourth device, **When** registered, **Then** it is refused until another is revoked (PD-003 A1).
2. **Given** points or rewards expiring soon, **When** the customer opens the app, **Then** they see them with date and time in Cairo; no reminder message is sent in P0 (PD-016, PD-007 C1).
3. **Given** a deletion request, **When** processed, **Then** every membership is closed and personal data erased while the pseudonymous ledger is kept; if a void is in progress for one of the memberships, deletion waits until it is resolved (BR, PD-008 A1).
4. **Given** a signed-in customer, **When** they change their phone number, **Then** a one-time code is sent to the **new** number and must be entered; on success every existing session and device secret is revoked; **Given** a customer who is not signed in, or a wrong or expired code, **Then** the change is refused and the number is unchanged (FR-018, PD-004, PD-003 A1).
5. **Given** a deletion request, **When** the customer confirms, **Then** a fresh one-time code to their phone is required first; **Given** no code or a wrong one, **Then** nothing is deleted (FR-009, PD-004).
6. **Given** a customer signed in on several devices, **When** they choose "sign out of all devices", **Then** every session ends; **Given** a signed-out device, **Then** it can no longer show a member code until the customer signs in again (FR-017, PD-004).
7. **Given** a customer, **When** they edit their first name, **Then** the new name is stored once on the account and shown to every café they belong to; joining another café never asks again (FR-019, PD-023).

---

### User Story 11 — Owner moves paper stamp cards onto digital cards (Story priority 3)

During the café's first 60 days after its first publish, the owner (from the owner staff profile on a registered device, after fresh owner authentication, FR-016) creates a pending migration of a customer's paper-card stamps; the customer accepts it in the app, the owner attests the paper card was collected or marked VOID, and the stamps are posted once (PD-021, PD-022).

**Why this priority**: Removes the main switching objection for cafés with paper cards; needed only at launch.

**Independent Test**: A pending migration posts only after both confirmations; a second migration for the same member is refused; a migration that would complete the card is refused.

**Acceptance Scenarios**:

1. **Given** a stamp program in its first 60 days and an allowed stage, **When** the owner creates a migration of n stamps where current balance + n ≤ threshold − 1, **Then** a pending migration is created and nothing is posted yet.
2. **Given** current balance + n ≥ threshold, **When** requested, **Then** it is refused (PD-021).
3. **Given** a pending migration, **When** the customer accepts and the owner attests, **Then** the stamps are posted once after an atomic re-check of window, stage, limit, balance and void status; **When** declined or not accepted within 15 minutes, **Then** it can never be posted (PD-022).
4. **Given** a member who already has a successful migration, **When** another is requested, **Then** it is refused; concurrent requests never post twice.
5. **Given** a points program, day 61, or the read-only/suspended stage, **When** a migration is requested, **Then** it is refused (PD-005 A2, PD-021).
6. **Given** a posted, declined, expired or refused migration, **When** audited, **Then** the record shows balances before and after, stamps, time, owner, device, branch, reference, both confirmations and the outcome.

---

### User Story 12 — Owner is alerted to suspicious activity (Story priority 3)

The system raises alerts — never blocks — for rapid awards to one customer, activity outside branch opening hours, and a staff member concentrating awards on a few customers; the owner sees them in Overview and marks them reviewed (PD-027).

**Why this priority**: Reduces cashier collusion risk; not needed for the earn/redeem loop to work.

**Independent Test**: Scripted activity crossing each threshold produces exactly one alert per rule and window, and no transaction is blocked.

**Acceptance Scenarios**:

1. **Given** more than 3 awards to one customer at one café in a rolling 60 minutes, **Then** one rapid-awards alert is raised.
2. **Given** an award, redemption or claim confirmation more than 30 minutes outside the branch's opening hours (overnight shifts respected), **Then** an out-of-hours alert is raised.
3. **Given** a staff member with at least 20 awards in a rolling 7 days, more than 40% to their top 3 customers, **Then** a staff-concentration alert is raised.
4. **Given** an alert, **When** shown, **Then** it lists rule, branch, staff member, time, masked customer (first name + last 3 digits) and linked transactions, inside Overview (no extra dashboard page); marking it reviewed is audited and changes no transaction (PD-018, PD-027).
5. **Given** repeated triggers in the same window, **Then** alerts are deduplicated; no alert is sent by WhatsApp, SMS or push in P0.

---

### User Story 13 — Owner changes the program safely after launch (Story priority 3)

After launch the owner can rename rewards, change the stamp reward item, change the points earn rate or reward costs, and add or deactivate points rewards; every change applies only to the future and never alters rewards already issued or holds already open (PD-025).

**Why this priority**: Needed within weeks of launch, not on day one.

**Independent Test**: After changing a reward's cost and name, an earlier issued reward and an open hold keep their original terms.

**Acceptance Scenarios**:

1. **Given** a reward rename, **When** saved, **Then** customers see the new name for future rewards, and the change does not block cashier voids of earlier stamp purchases (PD-025, PD-008 A1).
2. **Given** a stamp reward item change, **When** saved, **Then** rewards issued earlier keep their original description and stay redeemable until their own expiry.
3. **Given** an earn-rate or reward-cost change, **When** saved, **Then** it affects only later purchases and new holds; a later void of an earlier points purchase still reverses exactly what that purchase earned (FR-068, PD-037).
4. **Given** a points reward deactivation, **When** saved, **Then** no new holds can be made on it and open holds finish or are released normally; a sixth active reward is refused.
5. **Given** any change, **When** saved, **Then** fresh owner authentication is required, the change is audited, and it is refused in the read-only and suspended stages.

---

### User Story 14 — Support and account recovery (Story priority 3)

Customers and owners reach a platform WhatsApp support number (phone fallback). Support staff never change balances; balances are fixed only through voids or classified owner adjustments. Customer and owner recovery follow procedures written in task 1.2 (owner recovery: out-of-band identity check, revoke all sessions, audited) (PD-019).

**Why this priority**: Required before the pilot, low build effort.

**Independent Test**: A support-assisted owner recovery revokes all of the old owner sessions and leaves an audit record; no support role can change a balance.

**Acceptance Scenarios**:

1. **Given** a support contact, **When** a balance error is reported, **Then** support can only direct it to the owner's void/adjustment flows; no support action changes a balance.
2. **Given** an owner recovery, **When** completed, **Then** every existing owner session is revoked and the recovery is audited [0.10].
3. **Given** a Super Admin read of customer directory data, **When** performed, **Then** a reason is required and recorded (PD-013).

---

### Edge Cases

- A customer's rotating code is shown on a screenshot and replayed: refused as already used, with a clear error.
- The same purchase is submitted twice (double tap, network retry): it is awarded once; a reused submission with a different amount is rejected as a conflict.
- Two cashiers redeem the same reward simultaneously: one succeeds.
- The cashier's device loses the connection mid-award: nothing is awarded unless the server confirmed it; retrying the same submission is safe.
- A void is requested while a migration for the same member is pending: the void's member block refuses the migration posting until the void is reconciled.
- An owner deactivates a branch while a reward hold is open there: the hold is released; the reward or points stay available at other branches.
- A café crosses from grace to read-only during an owner's program edit: the publish is refused at the moment of submission.
- A café is suspended while a pending claim is open: the claim cannot be confirmed; it expires.
- The program is republished between a stamp purchase and its void: the void goes to the owner instead of running automatically.
- A customer deletes their account while a pending migration exists: the pending migration is cancelled (it was never posted).
- A customer's phone changes owner (recycled number): handled by the account recovery procedures of task 1.2.
- Point expiry falls during Egypt's daylight-saving change: displayed date and time follow `Africa/Cairo`.
- Arabic-Indic or Persian digits are typed for an amount or code: they are normalized to Western digits.
- An alert threshold is crossed only by idempotent retries: no alert is raised.
- The owner voids a points purchase after the earn rate changed: the void reverses exactly the points the purchase earned, not a recalculation at the new rate (FR-068, PD-037).
- A points void is larger than the customer's current points: the balance may go below zero (PD-015, PD-020).
- The owner voids a points purchase whose points already expired: the expired part is not debited again; any part already spent on rewards is still reversed (FR-068, PD-038 P7).
- Our record of a purchase's accrual result is lost after a failure: it is recovered from the loyalty platform's ledger records, never by re-sending the purchase; if the outcome stays uncertain, the void waits blocked for reconciliation (FR-069, PD-038 P8).
- A wrong amount is noticed after the customer left: P0 offers no amount correction; the purchase stays as recorded unless the owner voids it in full (FR-172, PD-030).
- A customer buys at two branches of the same café on the same Cairo day: one visit. A purchase at 23:50 and another at 00:10 Cairo time: two visits on different days.
- The only purchase of a day is voided a week later: that day no longer counts as a visit in any report produced after the void.
- A customer buys at branch A at 09:00 and branch B at 11:00 on the same Cairo day: one visit, attributed to branch A; if the 09:00 purchase is voided, the visit is attributed to branch B (FR-162).
- Egypt's daylight-saving change shortens or lengthens that day's SLO window (for example 1,020 or 1,140 minutes instead of 1,080): availability uses the actual elapsed minutes (SC-012).
- The first week of the pilot has no customer with a 30-day history: the repeat rate reads NOT YET MEASURABLE, never 0% (PD-028).

## Requirements *(mandatory)*

### Functional Requirements

**Tenancy, privacy and data minimisation**

- **FR-001**: The system MUST isolate every café's data so that one café can never read or change another café's customers, transactions, rewards, staff or reports (BR, constitution Article IV).
- **FR-002**: The system MUST keep one universal customer account per phone number with a separate, non-transferable card per café (PD-001).
- **FR-003**: The system MUST collect at join only an OTP-verified Egyptian mobile number and a first name; birthday, last name, gender and email MUST NOT be collected in P0 (PD-023) [0.10].
- **FR-004**: Personal data MUST be kept only in the platform customer directory; it MUST NOT appear in loyalty-engine records, logs, URLs, analytics or message payloads beyond what sending requires (PD-006, PD-013, BR).
- **FR-005**: Marketing consent MUST be optional, unchecked by default, recorded per café with purpose, policy version, source and time, and declining MUST NOT block enrollment (PD-023, BR).
- **FR-006**: Owners MUST see only first name, card progress, visit history and last 3 phone digits, and search only by first name plus last 3 digits; cashiers MUST see only first name and card progress; there is no export in P0 (PD-013) [0.10].
- **FR-007**: Every Super Admin read of customer directory data MUST require and record a reason (PD-013).
- **FR-008**: Account deletion MUST close every membership and erase personal data while keeping the pseudonymous ledger, and MUST wait while a void is in progress for any of the customer's memberships (BR, PD-008 A1).
- **FR-009**: Account deletion MUST require a fresh one-time code sent to the customer's own phone; without a correct code nothing is deleted (PD-004).

**Sign-in and sessions**

- **FR-010**: Customers and owners MUST sign in by phone number and one-time code with the approved code, resend, rate and attempt limits, bot check and platform-wide sending circuit breaker (PD-004, PD-010, PD-020) [0.11 for live delivery].
- **FR-011**: Owner sessions MUST last 30 days sliding and customer sessions 90 days sliding; every session MUST be revocable (PD-010, PD-020).
- **FR-012**: Fresh owner authentication (a new one-time code sent to the owner's own phone; never a customer's code) MUST be required to create or deactivate staff, publish or change the program or rewards, post a manual adjustment, migrate a paper card, or change the owner's phone (PD-010, PD-021, PD-025).
- **FR-013**: The Super Admin MUST sign in through an external identity provider with enforced multi-factor authentication; no Super Admin password is stored (PD-010). Provider choice is task 2.2.
- **FR-014**: Cashiers MUST sign in with a PIN on a device registered to a branch of the café (PD-010).
- **FR-015**: Owner invites MUST be single-use, bound to the owner's phone, valid 72 hours and stored so that the raw invite cannot be recovered (PD-011) [0.11].
- **FR-016**: The owner MUST have a dedicated owner staff profile — exactly one per café (PD-038 P1) — (own PIN, own OTP-verified phone), usable only on registered branch devices, linked to the single owner account (no duplicate owner account). Counter operations from it MUST follow the same cashier limits, verification and audit rules as any cashier. A staff PIN MUST never grant owner privileges; owner-only actions (voiding another's purchase, settling a *needs owner* void, manual adjustments, awarding above 5 × the large-bill threshold, paper-card migration) MUST require fresh owner authentication and explicit authorization even when started from that session, and MUST be audited as explicit overrides, never silent bypasses. Owner credentials and sessions MUST never be exposed to ordinary staff sessions (PD-034, PD-010, PD-014).
- **FR-017**: A customer MUST be able to "sign out of all devices", ending every one of their sessions (PD-004).
- **FR-018**: A customer phone-number change MUST require being signed in and a one-time code sent to the new number, and MUST revoke every existing session and device secret on success (PD-004, PD-003 A1).
- **FR-019**: The customer MUST be able to edit their first name; it is stored once on the universal account and never asked again when joining another café. No name rules beyond those already approved are added (PD-023).

**Capture of purchases**

- **FR-020**: Purchase value MUST be granted only from an authenticated staff session at an allowed branch of that café, recording staff, device and branch (PD-003).
- **FR-021**: The staff scan path MUST accept only a customer code that is device-bound, single-use, valid at most 60 seconds and bound to that customer, device and café; replays MUST fail with a clear error (PD-003 A1).
- **FR-022**: A customer MUST have at most 3 active devices and MUST be able to see and revoke them (PD-003 A1).
- **FR-023**: A purchase MUST be recorded as one bill amount typed by the cashier (label per café: "Amount paid" default, or "Subtotal before service & VAT"); the customer never types the amount (PD-008).
- **FR-024**: The confirm screen MUST show the amount and the stamps/points to be earned as calculated by the loyalty engine (PD-008).
- **FR-025**: Amounts above the café's large-bill threshold (default 2,000 EGP) MUST be typed twice; amounts above 5 × the threshold MUST be refused for cashiers (PD-008, PD-020).
- **FR-026**: The same purchase MUST never earn twice, including on retries with a new submission (BR).
- **FR-027**: No value MUST be granted while offline, and cashiers MUST NOT award missed purchases retroactively; the owner MAY post a classified `service_recovery` adjustment with a reason (PD-003).
- **FR-028**: A staff session MUST NOT award, confirm a claim or redeem for the customer account matching the staff member's own verified phone. The PD-003 owner exception applies only to the owner staff profile (FR-016) and MUST be recorded as a distinct, identifiable owner self-award audit entry (PD-003).
- **FR-029**: The branch-QR path MUST create only a pending claim (customer's first name + short claim code unique among open claims at that branch); the cashier MUST type the code and the amount; 3 wrong codes cancel the claim; claims expire after 15 minutes; at most one open claim per customer per branch (PD-003, PD-020).
- **FR-030**: There MUST be no cashier lookup of customers by phone number in P0 (PD-003).
- **FR-031**: Each branch MUST have exactly one printed Branch QR used both to join the café and to start a pending claim. A non-member scan leads to sign-in and joining, attributed to that branch, and MUST NOT create a purchase or grant value; a pending claim MUST require a separate explicit customer action. An existing member's scan MAY start a pending claim under FR-029 (PD-031).
- **FR-032**: The server MUST reject a rotated-out Branch QR and the QR of a deactivated branch for both joining and claiming. Rotation MUST NOT cancel open claims, which keep their 15-minute lifetime and safeguards; branch deactivation cancels them (FR-081, PD-031).

**Loyalty programs and rewards**

- **FR-040**: A café MUST have exactly one active program, stamps or points; type and stamp threshold MUST be immutable after the first publish (PD-012, PD-025).
- **FR-041**: Stamp programs MUST issue one reward per threshold reached, reset the card on issue, and never expire stamps (PD-012).
- **FR-042**: Points programs MUST support point expiry of 180, 365 (default), 545 or 730 days, or never; "never" vs "expiring" is locked after the café's first purchase; duration changes apply only to points earned afterwards; customers are warned 30 days before (PD-020).
- **FR-043**: Minimum eligible spend MUST be at least 1 piaster (PD-012).
- **FR-044**: Rewards MUST be free items only; a stamp program has exactly one reward; a points program has at most 5 active rewards, each with a positive whole-number cost (PD-015, PD-024).
- **FR-045**: Reward expiry MUST default to 30 days after issue, configurable 7–90 days (PD-020).
- **FR-046**: Issued rewards and open holds MUST keep an immutable snapshot of their terms; program changes apply only to future events (PD-024, PD-025).
- **FR-047**: Reward names and descriptions MUST be editable without republishing the loyalty program (PD-025).
- **FR-048**: Program and reward changes MUST be owner-only, audited, and refused in the read-only and suspended stages (PD-025, PD-005 A2).
- **FR-049**: The program wizard MUST NOT offer product/category exclusions, discount rewards, multiple programs or tiers (PD-008, PD-012, PD-015).

**Redemption**

- **FR-050**: Redemption MUST run only from a staff session as hold → confirm, or hold → release; the customer app only displays the reward code (PD-003, BR).
- **FR-051**: A reward MUST never be consumed twice, including concurrent attempts (BR).
- **FR-052**: At most one reward per order MUST be enforced, including concurrent attempts (PD-015).
- **FR-053**: A redemption MUST never take a balance below zero (PD-015).
- **FR-054**: A hold not confirmed within 120 seconds MUST be released automatically (PD-020).
- **FR-055**: A redemption without a purchase MUST be recorded as a zero-value redemption-only visit that never earns (PD-008 A1).
- **FR-056**: Stamp rewards MUST be redeemed only through their issued reward (PD-008 A1, PD-012).

**Voids, corrections and recovery**

- **FR-060**: A cashier MUST be able to void only their own purchase within 10 minutes; the owner MUST be able to void any purchase (PD-008, PD-020).
- **FR-061**: In stamp programs a void MUST follow the approved stamp-restore procedure: plan computed once from the stamps stored on the purchase record, saved and replayed, never recomputed; final balance within [0, threshold) (PD-008 A1, PD-003 A2).
- **FR-062**: In stamp programs a void MUST be blocked and sent to the owner when any PD-008 A1 precondition fails. The stamp-only preconditions (enough cancellable rewards, no republish since the purchase, balance within [0, threshold)) MUST NOT block points voids; the authorization rules of FR-060 apply to every void, and a points void is serialized per member and refused while another void for that member is in progress (PD-038 P10).
- **FR-063**: While a stamp void is in progress for a member, every operation that can change that member's balance or rewards MUST be refused with a clear message until the void is reconciled. The only operations allowed through are the void's own steps and the owner's settlement of a *needs owner* void. A settlement submission, an escalation or an administrative closure MUST NOT clear the block; only successful reconciliation of every expected effect does (PD-008 A1 C8 and *Recovery*). The same block, durable blocking and recovery MUST apply to points voids (PD-038 P10).
- **FR-064**: Interrupted stamp voids MUST be recovered forward only, without duplicate effects; *needs owner* after 15 minutes; Super Admin escalation after 24 hours; the block lifts only after authoritative verification of every expected effect (PD-008 A1, PD-020). Interrupted points voids MUST be replayed forward only with the same adjustment id and request body, without duplicate effects (PD-037, FP-003 item 7); the same escalation timeline and block-until-reconciled rule MUST apply to points voids (PD-038 P10).
- **FR-065**: Manual adjustments MUST be owner-only (cashier cap 0), carry a classification (`bonus`, `gift`, `migration`, `service_recovery`, `correction`), a reason and a stable business id, and a stamp adjustment outside a void MUST keep the balance within [0, threshold) (PD-003, PD-008 A1).
- **FR-066**: The only system-generated stamp addition MUST be the stamp-restore correction inside a permitted void; nobody can request it or type its amount (PD-003 A2).
- **FR-067**: Ledger history MUST be append-only; corrections are new entries (BR).
- **FR-068**: A void of a points purchase MUST reverse exactly the points that purchase earned, net of earlier adjustments to the same order, regardless of later earn-rate, multiplier or expiry-policy changes. Points of that purchase that already expired MUST NOT be debited again, while its points already spent on rewards are still reversed (PD-038 P7). How a void's and an expiry's points are attributed to point lots is unresolved: the candidate formula in FP-003 is not proven safe when points are consumed by redemptions or other voids before expiry and is not an implementation-ready algorithm; the attribution algorithm needs separate owner approval, source-level verification and executable regression tests before FP-003 implementation approval. It consumes the soonest-expiring points first and may take the balance below zero (PD-037, PD-025, PD-020). The upstream loyalty engine does not do this today; fork patch FP-003 (design approved, not implemented, `07-fork-patches.md`) is required before the pilot. [VERIFY]
- **FR-069**: A points void MUST use the purchase's original accrual. A missing or unconfirmed accrual result MUST be recovered only from the loyalty platform's authoritative ledger records, never by re-sending the purchase for accrual, and MUST fail closed: the evidence counts only when it is authoritative and complete (every accrual entry of the member in the program read to the end without error while the member is blocked) and shows exactly one accrual entry for the purchase; until that read is verified as possible (FP-003 V4), every missing result is uncertain. A verified positive accrual (matching the stored result when one exists) is reversed under FR-068; only a purchase whose own accrual verifiably earned 0 may be voided without a points reversal; any state in which neither is verified MUST post nothing, MUST NOT assume zero, and MUST keep the member blocked for reconciliation under FR-063 and FR-064. FP-003 covers points only; P0 programs never enable a credit policy (PD-038 P8, PD-037, PD-012). [VERIFY]

**Paper-card migration**

- **FR-070**: The system MUST support a one-time paper stamp-card migration per member per program, stamp programs only, owner-only from the owner staff profile on a registered device (FR-016), with fresh owner authentication, during the first 60 days after the café's first publish and only in stages that allow `migration` (PD-021, PD-005 A2).
- **FR-071**: Migrated stamps MUST satisfy current balance + migrated ≤ threshold − 1 (PD-021).
- **FR-072**: A migration MUST be posted only after customer acceptance in the app and owner attestation that the paper card was collected or marked VOID; pending migrations expire after 15 minutes; at most one pending per member per program; expired or declined requests can never post (PD-022).
- **FR-073**: Posting MUST re-check window, stage, limit, balance and void status atomically, and MUST be idempotent and safe under concurrent requests (PD-022).
- **FR-074**: Every migration outcome MUST be audited with balances before/after, stamps, time, owner, device, branch, reference, both confirmations and outcome (PD-021, PD-022).

**Branches, staff and devices**

- **FR-080**: Every active branch MUST take part in the café's single program; customers earn and redeem at any active branch (PD-026).
- **FR-081**: Branch deactivation MUST be owner-only and audited, immediately block the branch's devices, staff sessions and branch QR, keep history, balances and rewards, cancel open claims and release open holds there without double redemption or balance loss (PD-026).
- **FR-082**: Each branch MUST have weekly opening hours in `Africa/Cairo` with overnight shifts and closed days, used only for alerts (PD-026).
- **FR-083**: The owner MUST be able to rotate a branch QR in every subscription stage (PD-005 A2).
- **FR-084**: A cashier MUST act only for their own branch; cross-branch and cross-café actions MUST be refused (PD-014).
- **FR-085**: Staff phone numbers MUST be verified by one-time code at creation; changing one needs owner approval (PD-003).
- **FR-086**: Revocation of staff, devices and sessions MUST work in every subscription stage (PD-005 A2).

**Subscription billing (manual)**

- **FR-090**: The Super Admin MUST record offline payments with café, amount in integer piasters, method, reference, payment date and recorded-by; a double submit records once; records are append-only with reversing entries (PD-005 A1, BR).
- **FR-091**: The Super Admin MUST be able to set or extend the plan and period end; every change is audited (PD-017, BR).
- **FR-092**: The subscription stage MUST follow the period end date automatically (grace days 1–7, read-only 8–37, suspended 38+, Cairo calendar days) and enforce the PD-005 A2 permission table exactly (PD-005 A2, PD-020).
- **FR-093**: Recording a payment that extends the period MUST restore full service immediately; balances are never removed by any stage (PD-005 A2).
- **FR-094**: The owner MUST see plan, period end and current stage on Overview and Settings (PD-017, PD-018).
- **FR-095**: Plan limits (customers, branches, messages) MUST be defined per plan (task 1.6) and monitored in P0; each café's usage against its plan's limits is visible to the Super Admin through P0 operator tools (PD-038 P9). P0 MUST NOT enforce subscription capacity limits: no join, branch creation, staff creation or message is refused because a plan limit is reached; enforcement is P1 task 6.3. The platform MUST keep authoritative, uncapped customer and branch counts for monitoring. Loyalty-platform usage recording, if used at all, MUST stay outside the join, award and redeem success paths, and its failure or refusal MUST never block them. Security limits (sign-in, code and rate limits, the sending circuit breaker), billing-stage restrictions (PD-005 A2), tenant isolation and accounting safeguards remain fully enforced (PD-035).

**Owner dashboard and reporting**

- **FR-100**: The owner dashboard MUST have exactly 8 pages: Overview, Customers, Programs, Transactions, Rewards, Branches, Staff, Settings (PD-018).
- **FR-101**: Overview MUST show total customers, active in last 30 days, visits, rewards redeemed (from confirmed redemptions), near-reward customers, inactive 30 days, and a "needs attention" section including fraud alerts (PD-018, PD-027).
- **FR-102**: Reports MUST be filterable by branch, and customer history MUST show the branch of each visit; visit counts under a branch filter use the attribution of FR-162 (PD-026, PD-032).
- **FR-103**: Points redemption reports MUST count confirmed redemptions, not ledger entries (PD-015, PD-018).

**Fraud alerts**

- **FR-110**: Fraud alerts MUST be alert-only; an anomaly alone MUST never block a transaction (PD-027).
- **FR-111**: The system MUST raise rapid-award, out-of-hours and staff-concentration alerts with the PD-027 platform-fixed thresholds, deduplicated by rule, subject and window, ignoring idempotent retries (PD-027, PD-020).
- **FR-112**: A genuinely new award to the same customer at the same café within 10 minutes MUST require explicit cashier confirmation showing no extra customer data (PD-027).
- **FR-113**: Owners MUST be able to mark alerts reviewed (audited); alerts never alter transactions and are never sent by message in P0 (PD-027).

**Customer app**

- **FR-120**: The customer app MUST show each card's progress, rewards, visit history with branch, and balances expiring soon with date and time in Cairo (PD-016, PD-007 C1, PD-026).
- **FR-121**: The member code MUST be displayable offline on an installed app that was opened online before on that device (PD-003 A1).
- **FR-122**: The customer MUST be able to accept or decline a pending paper-card migration (PD-022).

**Localization and money**

- **FR-130**: Every surface MUST default to Arabic (right-to-left) regardless of device language, with English second and a remembered choice (PD-007).
- **FR-131**: Each café's main content language MUST be required for program, reward and branch names; the other language is optional and falls back to the main one (PD-007).
- **FR-132**: Money MUST be stored as integer piasters and displayed per PD-007 (zero piasters hidden); digits are shown as Western digits and Arabic-Indic/Persian input is normalized (PD-007, constitution Article V).
- **FR-133**: All day-based rules and displayed times MUST use `Africa/Cairo` (PD-007).

**Messaging and support**

- **FR-140**: P0 MUST send only one-time-code messages; transactional and marketing messages are not sent in P0 (PD-016) [0.11].
- **FR-141**: Support MUST be a platform WhatsApp number with phone fallback, separate from code and marketing senders; support staff MUST never change balances (PD-019) [0.10, 0.11].
- **FR-142**: Customer and owner recovery MUST follow the procedures produced by task 1.2; owner recovery uses an out-of-band identity check, revokes all sessions and is audited (PD-019) [0.10].

**Audit and integrity**

- **FR-150**: Every staff and owner write MUST be audited with actor, branch, device, operation type and time (roadmap 2.9); actions from the owner staff profile MUST record both the owner identity and the acting staff profile (FR-016).
- **FR-151**: Every non-purchase source of value (manual adjustment, migration, import) MUST carry a stable business id and be idempotent (PD-003).
- **FR-152**: Operator recovery and Super Admin actions on customer data MUST be audited (PD-008 A1, PD-013).

**Operational reliability (internal)**

- **FR-155**: Award and redemption availability MUST be measured separately by representative end-to-end checks of real service capability, every minute of the SLO window (PD-033). The checks MUST run against a dedicated non-customer test café that runs on the same production path as the pilot cafés, uses only test identities whose staff, devices and credentials can act only on the test café, and is excluded from billing, plan-usage monitoring and all customer and business analytics (PD-038 P3). Every outage of awarding or redemption longer than 5 minutes within the window MUST be logged with start and end time (Cairo), affected cafés, affected operations and recovery details, and reviewed weekly during the pilot. Monitoring gaps MUST be logged separately with their total minutes and investigated. These records support SC-012 and create no customer-facing or contractual commitment.
- **FR-156**: Outages MUST NOT change the PD-003 rules: no offline cashier award and no retroactive cashier award; the owner's classified `service_recovery` adjustment remains the only recovery path for purchases lost to an outage.

**Pilot measurement**

- **FR-159**: A **visit** MUST be defined as one café × customer × `Africa/Cairo` calendar day with at least one successful, non-voided qualifying purchase at any branch of that café (PD-032). A *qualifying purchase* is a real customer purchase captured by a staff session (staff scan or a confirmed pending claim), not voided, whose bill amount met the café's minimum eligible spend and channel rules in force at the time of purchase; its representation as a synthetic order line (PD-008) does not exclude it, and a purchase below the café's minimum eligible spend is not a qualifying purchase and creates no visit (PD-038 P2). Several purchases that day, including at different branches of the same café, MUST count as one visit. Redemption-only orders, owner adjustments of any classification, paper-card migration credits and idempotent retries MUST NOT count, and neither may test, probe or monitoring transactions (PD-038 P3). Voiding the only qualifying purchase of a day MUST remove that visit; if another qualifying purchase that day remains, the visit remains. Purchase and accounting records are never merged; only visit analytics aggregate them.
- **FR-160**: Visit frequency, first-visit date, the 30-day repeat rate (a repeat = a qualifying purchase on a different Cairo calendar day within 30 days after the first visit) and the week-8 assessment MUST all use the FR-159 visit definition. The system MUST report weekly per café the 30-day repeat rate (or NOT YET MEASURABLE), visit frequency, redemption rate, and the share of customers who joined by staff scan versus branch QR, using the PD-028 and PD-032 definitions and exclusions.
- **FR-161**: The week-8 assessment MUST always report the eligible cohort size, numerator, denominator, measured rate and a per-café descriptive breakdown. With a zero denominator no numeric rate exists: the rate is reported as NOT YET MEASURABLE (never 0%) and the assessment as INCONCLUSIVE (PD-028). It is a conclusive exploratory assessment only when at least 100 eligible customers exist across the pilot cafés; below 100 it MUST be labelled INCONCLUSIVE. It is neither a statistically proven causal lift nor an automatic go/no-go gate (PD-036, PD-028).
- **FR-162**: Each visit MUST be attributed to the branch of that day's first qualifying purchase, ordered by server-recorded capture time with ties broken by the stable purchase id (tie-break: PD-038 P4). When voids change that day's set of qualifying purchases, attribution MUST be recomputed: the visit moves to the branch of the earliest remaining qualifying purchase, or disappears when none remains. Branch visit totals MUST add up to the café total (PD-032).
- **FR-163**: The branch-filtered 30-day repeat rate MUST assign each customer to the cohort of the branch their first café visit is attributed to and count as a repeat any later café visit, at any branch, within the 30-day window; branch cohorts partition the café cohort, using the same eligibility and labels (NOT YET MEASURABLE) as the café rate. When a void changes the attribution of a customer's first café visit, the customer moves to the cohort of the new attributed branch (or of their new first visit) in every report produced afterwards. This cohort report is distinct from branch activity reports, is labelled as an acquisition-branch cohort and is shown separately from them (PD-038 P5).

**Refunds**

- **FR-170**: P0 MUST NOT offer partial-refund clawbacks of a purchase. A purchase that should not have earned at all is reversed only by the full void operation (PD-030, PD-008, PD-008 A1).
- **FR-171**: Correcting a wrong bill amount **with the customer present** MUST use the full void, completed and reconciled first, followed by a genuine new capture with the customer's own code (or a confirmed claim) as a new operation with its own identity. A re-capture MUST be refused while the void is unresolved (PD-008 A1 member block). The audit MUST link the original purchase, its void and the re-capture (PD-030, PD-003, PD-008).
- **FR-172**: P0 MUST NOT offer any amount correction for a purchase once the customer has left. The purchase stays as recorded unless the owner voids it in full (FR-060, FR-170). Customer-absent amount corrections are P1 (task 6.9) and need their own approved accounting design (PD-030).
- **FR-173**: No manual adjustment of any classification, including `service_recovery`, MAY be linked to a purchase as an amount correction or presented to the owner or customer as equivalent to one (PD-030). Manual adjustments never count as purchases, visits or redemptions (FR-159).
- **FR-174**: In stamp programs a wrong recorded amount alone MUST NOT trigger any stamp change (stamps are earned per paid order, PD-008); if the purchase should not have earned at all, the full void (FR-170) applies (PD-030).

### Key Entities

- **Customer account**: one person on the platform, identified by verified phone; holds first name, language choice, devices (max 3), sessions. Personal data lives only here.
- **Café (tenant)**: an independent business with one owner, branches, staff, one program, subscription and payment records.
- **Membership / card**: a customer's card at one café; balance, issued rewards, visit history; never transferable.
- **Branch**: a café location with status (active/inactive), weekly opening hours, one rotatable Branch QR (used for joining and pending claims), registered devices; joins are attributed to the branch whose QR was scanned.
- **Staff member**: a cashier with verified phone, PIN, branch, and a device registration; one staff profile per café is the owner staff profile — exactly one per café (PD-038 P1) — linked to the owner account (FR-016).
- **Program**: stamps or points; threshold or earn rate; expiry settings; immutable type/threshold after first publish; published revisions.
- **Reward**: a free item with localized display text; for points programs a cost and active/inactive status.
- **Issued reward / reward hold**: an entitlement or an open hold with a snapshot of its terms; expiry.
- **Purchase record**: bill amount, branch, staff, device, capture time, the accrual result the loyalty engine returned (stamps or points earned, used to verify FR-068 and PD-008 A1 voids), reward marker for stamp programs, and links to any void and re-capture.
- **Pending claim**: a branch-QR request with claim code, attempts, expiry; grants nothing until confirmed.
- **Void operation**: a saved, replayable plan with status (in progress, completed, needs owner, escalated) and a member block.
- **Manual adjustment**: owner-posted change with classification, reason, stable id; never an amount correction of a purchase in P0 (FR-173).
- **Paper-card migration**: pending → accepted/declined/expired → posted/refused, with attestation and audit.
- **Fraud alert**: rule, subject, window, status (open, reviewed), linked transactions.
- **Visit (analytics only)**: a derived count of café × customer × Cairo calendar day with at least one qualifying purchase (FR-159), attributed to one branch (FR-162); never a stored accounting record.
- **Subscription and payment record**: plan, period end, computed stage; append-only payments.
- **Audit entry**: actor, action, branch, device, time, before/after where relevant.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A non-technical owner goes from invite acceptance to a published program and printable branch QR in under 15 minutes (PD-011, PD-028).
- **SC-002**: An owner creates a "5 drinks → 1 free" stamp program in under 3 minutes in the wizard (roadmap 3.7).
- **SC-003**: The median cashier award flow, scan to confirmation, takes 10 seconds or less on real pilot transactions (PD-028).
- **SC-004**: After a confirmed award, the customer sees the new balance within 2 seconds (roadmap 3.3).
- **SC-005**: During peak hour across 100 cafés at once, 95% of awards complete within half a second and no purchase is ever awarded twice (roadmap 5.2).
- **SC-006**: Zero data-integrity incidents during the 4-week pilot: no double award, double redemption, lost balance, stamp card left outside [0, threshold) after a completed stamp void, or points void reversing an amount other than FR-068 requires (the purchase's original net accrual, excluding its own points that already expired, under the lot-attribution rule the owner approves before FP-003 implementation) (PD-028, PD-008 A1, PD-037, PD-038 P7). Points balances may go negative (PD-020).
- **SC-007**: Zero successful cross-café or cross-branch access in the isolation and permission test suite (PD-014).
- **SC-008**: Every stage-by-action combination in the PD-005 A2 table behaves exactly as specified in acceptance testing (100% of cells).
- **SC-009**: A non-technical person completes owner onboarding, and a customer completes join → earn → redeem, without help (roadmap M4).
- **SC-010**: Pilot outcome targets (not automatic rejection gates): at least 150 enrolled customers across pilot cafés by week 4; at least a 25% 30-day repeat rate assessed at week 8 over at least 100 eligible customers, reported as NOT YET MEASURABLE (week 4, no eligible cohort) or INCONCLUSIVE (fewer than 100 eligible customers) when applicable (PD-028, FR-161).
- **SC-011**: Owner interviews at weeks 2 and 4 record perceived value, cashier friction, customer feedback and willingness to continue (PD-028).
- **SC-012** (internal SLO, not a contractual SLA, PD-033): for each operation (award, redemption) and each calendar month, with the daily window 08:00–02:00 `Africa/Cairo` (crossing midnight):
  - *Expected minutes* M = the actual elapsed minutes of every day's window in the reporting period (1,080 on most days; daylight-saving days differ, for example 1,020 or 1,140); *observed minutes* O = minutes with a check result; *successful minutes* S = observed minutes in which the end-to-end check of that operation succeeded.
  - *Coverage* = O ÷ M; *worst-case availability* = S ÷ M (every missing minute counted unavailable).
  - **PASS** only when coverage ≥ 99.5% and worst-case availability ≥ 99.5%.
  - Otherwise **FAIL** when (S + (M − O)) ÷ M < 99.5% (the target is missed even if every missing minute were available). A definite failure stays FAIL whatever the monitoring coverage; coverage below 99.5% is reported alongside it.
  - Otherwise **INSUFFICIENT DATA**, for example coverage below 99.5% while the best case still meets the target, or O = 0 (PD-038 P6). A partial month is reported over its elapsed days and labelled partial (PD-038 P6).
  - Monitoring gaps never count as available; their total is reported with the result.
  - Reporting boundaries (PD-038 P6): each daily window belongs to the calendar day and month on which it starts (08:00 on day D through 02:00 on day D + 1 counts for day D). M counts only the distinct elapsed minutes of those windows that fall inside both the pilot's operating period and the time already elapsed when the report is produced; a partial day counts only its elapsed minutes. When M = 0, no availability is computed and the result is INSUFFICIENT DATA.

### Readiness criteria (restating approved gates)

- **SC-013**: At the week-4 go/no-go there is no unresolved critical security, tenant-isolation or loyalty-accounting failure (PD-028). A written vulnerability acceptance under SC-015 never waives this gate.
- **SC-014**: A restore drill on the production database succeeds using the hosting provider's point-in-time restore, and the achieved RPO and RTO are measured and recorded (values recorded, not targeted) before the pilot (roadmap 5.3, PD-006).
- **SC-015**: Before the pilot: a fresh production dependency audit, an OS-package container-image vulnerability scan and live multi-tenant cloud runtime readiness checks are completed, and every critical and high production vulnerability is resolved or accepted in writing by the owner (roadmap 0.12 and 5.6).
- **SC-016**: Every scheduler and the webhook dispatcher are safe with several running instances: with two instances running, a due job runs exactly once (roadmap 2.7).
- **SC-017**: Points voids reverse exactly the amount FR-068 requires (the original net accrual, excluding the purchase's own points that already expired) in the official verification environment, including after an earn-rate change and after partial or full expiry (FR-068, PD-037, PD-038 P7), before any points café joins the pilot.

## Assumptions

- P0 scope is exactly the roadmap Phase 2–5 tasks plus PD-017 manual billing; anything listed under "Out of scope" below is not built in P0.
- Cafés have a reliable internet connection at the counter; offline earning is backlog.
- Cashiers use inexpensive Android phones; each step of the cashier flow takes at most 2 taps (roadmap 1.3).
- The cashier's "correction request" for a purchase older than 10 minutes is handled by asking the owner, who may void it in full; P0 has no amount correction (PD-030), and no separate in-app request queue is assumed beyond the owner's tools (roadmap 3.6 wording "staff requests, owner approves").
- A pending migration is cancelled if the customer deletes their account before it posts.
- Pilot cafés are recruited outside the product (no self-serve sign-up in P0, PD-011).
- Detailed recovery procedures (lost phone, recycled number, owner recovery) are produced by task 1.2 and are referenced, not redefined, here.

## Out of scope (P1 / P2 / backlog)

| Item | Status | Source |
| --- | --- | --- |
| Branch Manager role | P1 | PD-014 |
| Discount, percentage or cash-value rewards | P1 | PD-015 |
| More than one reward per order (stacking) | Backlog | PD-015 |
| More than one program per café; tiers | Backlog / P2 (7.3) | PD-012 |
| Self-serve café sign-up | P1 | PD-011 |
| Transactional and marketing messages, automation (welcome, win-back, birthday, near-reward, expiring) | P1 (6.4, 6.5) | PD-016 |
| Birthday collection | P1 with birthday automation | PD-023 |
| Campaigns, segments, attribution with holdout | P1 (6.4–6.6) | brief, PD-028 |
| Renewal reminders, renewals list, trials, upgrades, online billing (Kashier) | P1 / backlog | PD-005 A1, PD-017 |
| Super Admin console UI | P1 (6.7); operator tools only in P0 | PD-011 |
| Google Wallet passes | P1 (6.8) | PD-009 |
| Customer export | Not in P0 | PD-013 |
| Automatic plan-limit enforcement | P1 (6.3) | PD-035, FR-095 |
| Partial refunds | Not in P0 (full voids only) | PD-030, FR-170 |
| Customer-absent purchase amount corrections | P1 (6.9) | PD-030, FR-172 |
| Points paper-card migration | Not in P0 | PD-021 |
| Product-list capture, item exclusions, POS integrations | Backlog / P2 | PD-008 |
| Cashier lookup by phone number | Backlog | PD-003 |
| Offline earning queue | Backlog | roadmap backlog |
| Support ticketing system | P1 | PD-019 |
| Mobile app, push, geofencing, advanced analytics | P2 | brief |
| Causal retention-lift claims | Task 6.6 | PD-028 |

## Dependencies and open items

- **Legal (task 0.10)**: owner view of last 3 phone digits and owner search (PD-013); data collected at join and consent texts (PD-023, task 5.4); support chats held abroad and recovery identity checks (PD-019); data residency (PD-006). If the opinion disagrees, the affected decisions reopen.
- **Company registration (task 0.11)**: live one-time codes and owner invites to real numbers, WhatsApp/SMS senders, support number, pilot.
- **Final product name (PD-029)**: required before task 1.5 prototype.
- **Plans and limits (task 1.6)**: plan names, prices in EGP and limits; P0 monitors them, enforcement is P1 task 6.3 (FR-095).
- **Super Admin identity provider (task 2.2)**.
- **[VERIFY] Technical verification still required**: fork patch FP-003 implemented only after separate owner authorization and its tests passing (FR-068, PD-037, task 3.6); that a refused or failing loyalty-platform usage event never blocks join, award or redeem (FR-095, PD-035, task 5.5); PD-008 A1 checks (a)–(f) in the project's official verification environment; whether the loyalty engine fixes a hold's cost at hold time (PD-025, task 3.4); whether the engine refuses an inactive location (PD-026; the server-side block is required regardless); synthetic zero-value redemption-only orders (task 3.4); the subscription-stage mapping at runtime (task 5.5); FP-003 verification requirements V1–V7 (`07-fork-patches.md`), of which V1 — executable regression tests of the owner-approved point-lot attribution algorithm — is one of the FP-003 implementation blockers listed under *Before FP-003 implementation approval*.
- **Decision log**: the clarification answers and Gate 1 decisions are recorded as Approved in `01-decisions.md` (PD-030 to PD-037, with provenance). Agent-derived interpretations PD-038 P1–P10 were approved by the owner on 2026-11-12 (P3, P6, P7 and P8 with revisions) and are cited here as "(PD-038 Pn)".
- **Before FP-003 implementation approval** (blockers, all open): the owner approves a point-lot attribution algorithm, which is unresolved (two source-derived cases show the candidate formula can over-debit when another void or a redemption consumes the purchase's lot before expiry, so it is not proven safe and not implementation-ready); that algorithm passes source-level verification and the executable regression tests of FP-003 V1; FP-003 V2–V4 and V7 are verified (V4 decides whether missing accrual results can ever be recovered, otherwise they stay fail-closed); implementation itself still needs separate owner authorization (PD-037). SC-017 remains mandatory before any points café joins the pilot.

## Traceability: roadmap Phase 2–5 tasks

| Task | PRD coverage |
| --- | --- |
| 2.1 Rebrand | PD-029 (name placeholder); acceptance in the roadmap |
| 2.2 CI + staging | Prerequisite for SC-014; acceptance in the roadmap |
| 2.3 Customer directory | FR-001, FR-002, FR-004, FR-019; US1 |
| 2.4 Customer OTP sign-in | FR-009, FR-010, FR-011, FR-017, FR-018; US1, US10 |
| 2.5 Cashier role | FR-006, FR-020, FR-084; SC-007 |
| 2.6 Staff PIN + devices | FR-014, FR-016, FR-085, FR-086; US7 |
| 2.7 RLS tables, multi-instance safety | FR-001; SC-007, SC-016 |
| 2.8 i18n + RTL | FR-130–FR-133 |
| 2.9 Audit coverage | FR-150–FR-152 |
| 3.1 Rotating member QR | FR-021, FR-022, FR-121 |
| 3.2 Bill-amount order builder | FR-023, FR-026 |
| 3.3 Staff scan flow | FR-024, FR-025, FR-027, FR-028; US2; SC-003, SC-004 |
| 3.4 Redemption | FR-050–FR-056; US3 |
| 3.5 Branch QR + pending claims | FR-029, FR-031, FR-032; US6 |
| 3.6 Voids and owner corrections (incl. FP-003) | FR-060–FR-069, FR-170–FR-174; US5; SC-006, SC-017 |
| 3.7 Program wizard | FR-040–FR-049; US4, US13; SC-002 |
| 3.8 Anti-fraud rules v1 | FR-110–FR-113; US12 |
| 4.1 Customer surface | FR-120–FR-122; US10 |
| 4.2 Join by QR + consent | FR-003, FR-005, FR-031; US1 |
| 4.3 Account deletion | FR-008, FR-009; US10 |
| 4.4 Owner surface | FR-100–FR-103; US7, US8 |
| 4.5 Overview KPIs | FR-101, FR-159, FR-162, FR-163; US8 |
| 4.6 Staff PWA | US2, US3 |
| 4.7 Paper-card migration | FR-070–FR-074, FR-122; US11 |
| 5.1 Security review | SC-007, SC-013 |
| 5.2 Load test | SC-005 |
| 5.3 Backups + restore drill | SC-014 |
| 5.4 Privacy policy, terms, consent | FR-005; dependency 0.10 |
| 5.5 Manual billing core | FR-090–FR-095; US9; SC-008 |
| 5.6 Pilot | FR-155–FR-163; SC-009–SC-013, SC-015, SC-017 |
