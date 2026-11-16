# D1 — P0 screen inventory and traceability (roadmap 1.5)

**Status**: **Draft v0.7, 2026-11-14. Prototype design only** (PD-045 item 4). It is not accepted, and no screen is approved.
- Its sources are the approved PRD (`spec.md`), the planning contracts (`contracts/*.md`), `docs/context/01-decisions.md` and `1.5-prototype-brief.md`.
- It adds no requirement. Where it proposes a layout or a placement, it labels it **proposed**.
- It resolves no JG, OD, F-item, A11Y-01 or M-01, and FP-003 stays not authorized.
- Any sample data is fictional.
- Brand text never appears in a screen ID (brief §4). The IDs use neutral prefixes:
  - `CUS` for the customer app;
  - `CSH` for the counter device (cashiers and the owner staff profile);
  - `OWN` for the owner dashboard;
  - `CLI` for operator entries.

**Markers.**
- **DD(x)** means decision-dependent on item x. The screen shows a placeholder and an annotation, never a decided value (AC-06).
- **GATED** means it is shown only as "not available" (AC-07).
- **CLI** means it is an operator command with no screen (AC-01).

**State columns.**
- Every screen also has the shared states in §4: loading, offline, generic error, session expired, and, on authenticated surfaces, the stage banner.
- The column lists only the extra states specific to each screen.

## 1. Customer app (`CUS`)

| ID | Screen | Screen-specific states | US scenarios | FR | Decisions / open items |
| --- | --- | --- | --- | --- | --- |
| CUS-01 | Branch QR landing: café and branch display; "join" for a non-member or "go to card" for a member; for a member, an explicit "claim a purchase" action | QR rotated or branch inactive (`410`, nothing created); suspended café, join refused (`403 stage_forbidden`) | US1.1, US1.6, US6.4, US6.6 | FR-031, FR-032 | PD-031, PD-005 A2; PD-046 merchant theme only after successful Branch QR validation (U-5); JG-08 is Approved (PD-040 C3): no join, real accrual or redemption before the café's first publication. **DD(JG-08 refusal contract)**: the customer-facing refusal is not specified (PD-041) |
| CUS-02 | Phone entry: Egyptian mobile; Arabic-Indic and Persian digits normalized; bot check | Malformed or non-Egyptian, rejected before any send; send limit reached; sending paused (`503 otp_paused`) | US1.5, US1.7 | FR-003, FR-010, FR-132 | PD-004, PD-020, PD-042; DD(OD-05) per-IP and per-device limits and caps; DD(F-01) how a WhatsApp send with SMS fallback counts against the limit |
| CUS-03 | One-time-code entry: paste and autofill allowed; resend timer | Wrong code; 5 wrong attempts; code expired (5 min); resend wait | US1.1, US1.7 | FR-010, FR-134 | PD-004, PD-020, PD-042, PD-044 item 4; DD(F-01) resend counting |
| CUS-04 | Join details: first name (asked only if the account has none); marketing consent for this café, optional and unchecked | Declining consent still joins; name too long | US1.1, US1.2, US1.3 | FR-003, FR-005, FR-019 | PD-023; DD(OD-08) first-name bound |
| CUS-05 | My cards: one card per café | Empty (no cards); a café that is read-only or suspended (card still shown) | US1.2, US9.5 | FR-002, FR-120 | PD-001, PD-005 A2; DD(F-10) customer stage messaging; card tiles in each merchant's colours (MB-02, PD-046) |
| CUS-06 | Card detail: progress (stamps or points); issued rewards with their terms snapshot; visit history with branch; items expiring soon with date and time in Cairo; points-expiry warning from 30 days before | No visits yet; balance updated after an award (within 2 s, SC-004) | US1.1, US2.1, US2.10, US10.2, US13.1, US13.2 | FR-041, FR-042, FR-045, FR-046, FR-120, FR-131, FR-133 | PD-007 C1, PD-016 (no reminder message), PD-026; DD(F-12) expiring-reward indicator window |
| CUS-07 | Member code: device-generated, 60 s, device-bound | Offline on an installed app opened online before (shown, FR-121); signed-out device (not shown, FR-017); device revoked (`device_revoked` at the counter). Other offline cases are not specified; their display is *proposed design* | US2.1, US10.6 | FR-021, FR-121 | PD-003 A1 |
| CUS-08 | Rewards: issued stamp reward, or the points catalogue (≤ 5 active); "Redeem" shows the device-generated reward code only | Balance below cost: the counter refuses (`409 insufficient_balance`). Whether the app hides or disables the code is *proposed design*, not a rule. Reward deactivated (no new holds) | US3.1, US3.3, US3.6, US3.8, US3.9, US13.4 | FR-044, FR-046, FR-050, FR-056 | PD-003, PD-012, PD-015, PD-024, PD-025 |
| CUS-09 | Purchase claim: first name, claim code, 15-minute countdown; cancel | One open claim already exists at this branch; confirmed; three wrong codes, cancelled; expired; branch deactivated, cancelled; suspended café, creation refused | US6.1–US6.3, US6.6, US6.7 | FR-029, FR-031, FR-032 | PD-003, PD-020, PD-005 A4; PD-046 merchant theme, restored after a reload (correction A); DD(OD-12) claim-code format |
| CUS-10 | Pending paper-card migration: café name and exact stamp count; accept or decline | Expired after 15 min; declined; posted | US11.3 | FR-072, FR-122 | PD-021, PD-022; PD-046 merchant theme, restored after a reload (U-4) |
| CUS-11 | Account: first name edit; language switch (remembered); links to CUS-12–CUS-16 | — | US1.4, US10.7 | FR-019, FR-130 | PD-007, PD-023 |
| CUS-12 | Devices: list (label, registered, last seen) and revoke; register this device | Fourth device refused (`409 device_limit`) | US10.1 | FR-022 | PD-003 A1 |
| CUS-13 | Sign out of all devices: confirmation | Done; this device signed out | US10.6 | FR-017 | PD-004 |
| CUS-14 | Phone change: new number, then a code sent to the **new** number | Not signed in (not offered); success revokes every session and device secret | US10.4 | FR-018 | PD-004, PD-003 A1 |
| CUS-15 | Marketing consent per café | Changed (recorded) | US1.3 | FR-005 | PD-023 |
| CUS-16 | Delete account: explanation, then a fresh code to the customer's own phone | Wrong or no code (nothing deleted); queued while a void is in progress; completed | US10.3, US10.5 | FR-008, FR-009 | PD-004, PD-008 A1 |
| CUS-17 | Support contact: platform WhatsApp number with phone fallback; states that support never changes balances | — | US14.1 | FR-141 | PD-019 |
| CUS-18 | Recovery entry points (lost phone or number) | All mechanisms **DD**, none shown as working | US14 | FR-142 | DD(F-03, F-04, F-06, JG-04); `journeys/1.2-recovery-procedures.md` |

## 2. Counter device (`CSH`): cashiers and the owner staff profile

| ID | Screen | Screen-specific states | US scenarios | FR | Decisions / open items |
| --- | --- | --- | --- | --- | --- |
| CSH-01 | Device enrollment: enter the single-use enrollment code from the owner | Code invalid or used; suspended café, new enrollment refused (PD-005 A3); DD(OD-01) code lifetime | US7.3 | FR-014 | contracts `staff-api.md` *Device and sign-in*; R-12 |
| CSH-02 | Profile picker: first names usable on this device (branch cashiers plus the owner staff profile) | Device revoked or branch inactive (locked) | US7.4, US7.8 | FR-014, FR-016, FR-084 | PD-010, PD-014 |
| CSH-03 | PIN entry, first-PIN setup (with an owner-issued setup code) and PIN change | Wrong PIN; profile locked; PIN not set | US7.8, US7.9 | FR-014, FR-016, FR-134 | DD(OD-01) PIN length and lockout; **DD(A11Y-01)**: no AA claim for this step |
| CSH-04 | Counter home: scan a code (member or reward); enter a claim code; recent purchases (void); sign out. No phone lookup exists | Camera permission denied; offline (no award possible) | US2.6 | FR-020, FR-030 | PD-003 |
| CSH-05 | Capture started: customer first name and card progress only | Code expired, used, another café's or a revoked device's (refused); self-dealing refused; suspended (refused); member blocked by a void | US2.4, US2.5, US2.8, US5.4, US7.10 | FR-006, FR-021, FR-028, FR-063 | PD-003, PD-003 A1, PD-005 A2, PD-013; DD(OD-13) capture lifetime and supersession |
| CSH-06 | Amount entry: café label ("Amount paid" or "Subtotal before service & VAT"); retype above the large-bill threshold | Invalid amount form, rejected and never guessed: signs, thousands separators, spaces, `45.`, `.5`, more than 2 decimals; `.` or `٫` accepted (PD-039 item 2). Retype mismatch above the threshold (strictly above; equality is not above). Above 5 × threshold, refused for cashiers. Zero or below minimum spend (earns nothing) | US2.3, US2.7 | FR-023, FR-025, FR-043, FR-132 | PD-008, PD-012, PD-020, PD-039 |
| CSH-07 | Confirm: amount and engine-returned earn preview; repeat-award confirmation within 10 minutes (first name and progress only) | Preview unavailable (no client-side estimate); amount changed (conflict) | US2.2, US2.9 | FR-024, FR-026, FR-112 | PD-008, PD-027, PD-039; DD(OD-13) |
| CSH-08 | Award result: confirmed (earned, new progress); confirming; **unconfirmed** (never re-sent) | Offline (nothing granted, no retroactive award); failed | US2.1, US2.6, US2.10 | FR-026, FR-027, FR-041, FR-156 | PD-003, PD-038 P8; DD(OD-10, OD-15, OD-17) next cashier action |
| CSH-09 | Claim-code entry, then CSH-06–CSH-08 | Wrong code (the third cancels the claim, attribution DD(OD-12)); expired; another branch's code | US6.2, US6.3, US6.5, US6.7 | FR-029, FR-032 | PD-003, PD-020 |
| CSH-10 | Redemption: reward shown; 120 s hold countdown; confirm hand-over or release; "do not hand over yet" while confirming | Insufficient balance; second reward on the same order; terms changed (hold released); hold expired; concurrent capture lost; redemption without purchase (recorded as redemption-only) | US3.1–US3.7 | FR-050–FR-056, FR-046 | PD-003, PD-008 A1, PD-012, PD-015, PD-020, PD-025; DD(OD-16) hold boundary |
| CSH-11 | Recent purchases and void: own purchases from the last 10 minutes; void; status | Window expired; not own purchase; stamp void needs the owner; member busy; void in progress; **points void GATED** (`points_void_unavailable`) | US5.1, US5.3, US5.7 | FR-060–FR-064, FR-068, FR-069 | PD-008, PD-008 A1, PD-020, PD-037, PD-038 P10; **GATED by FP-003** |
| CSH-12 | Re-capture after a completed void (customer present): new capture with the customer's own code | Refused while the void is unresolved | US5.8 | FR-171 | PD-030, PD-008 A1 |
| CSH-13 | Owner step-up on the counter: code to the owner's own phone, bound to one action and target | Wrong code; someone with the PIN but not the phone (refused) | US7.8, US7.9 | FR-012, FR-016 | PD-010, PD-034 |
| CSH-14 | Owner award above 5 × threshold (owner staff profile plus step-up) | **DD(OD-18)**: classification, stage cell and the stamp case are not designed as decided | US2.3 | FR-016, FR-025 | PD-008 |
| CSH-15 | Paper-card migration create (owner staff profile plus step-up): scan the member code; stamp count; reference; then attest "collected" or "marked VOID" | Points program, day 61, read-only or suspended (refused); balance + n ≥ threshold; one pending already; already migrated; waiting for the customer; expired; posted | US11.1–US11.6 | FR-070–FR-074 | PD-021, PD-022, PD-005 A2 |
| CSH-16 | Owner void of another staff member's purchase from the owner staff profile (step-up) | As CSH-11 | US5.1, US7.8 | FR-016, FR-060 | PD-008 |

## 3. Owner dashboard (`OWN`): exactly 8 pages (FR-100), plus onboarding

**Onboarding and sign-in (outside the 8 pages):**

| ID | Screen | Screen-specific states | US scenarios | FR | Decisions / open items |
| --- | --- | --- | --- | --- | --- |
| OWN-01 | Invite acceptance: café name, last 3 digits of the bound phone; send code; enter code | Expired, used or unknown (`410`); other number; 72 h window | US4.1, US4.2 | FR-015, FR-010 | PD-011; DD(F-07) invite reissue; DD(F-02) timer start event for 1.4 (b) |
| OWN-02 | Owner sign-in: phone and code | As CUS-02 and CUS-03 | — | FR-010, FR-011 | PD-010, PD-020, PD-042 |
| OWN-03 | Setup: first branch, with a name in the café's main content language (second language optional) and opening hours (overnight shifts, closed days). The main language is set when the operator provisions the café (CLI-08) and is editable in OWN-17 | Main-language name missing; hours invalid | US4, US7.6 | FR-082, FR-131 | PD-026, PD-007 |
| OWN-04 | Program wizard: stamps (threshold, one free-item reward, always resets, never expires) or points (5 per 100 EGP suggested, ≤ 5 rewards, expiry 180/365/545/730/never); reward names (main language required) | No exclusions, discounts, tiers or multiple programs offered | US4.3–US4.5 | FR-040–FR-045, FR-049, FR-131 | PD-012, PD-015, PD-020, PD-024; **DD(F-12)** ranges; **DD(OD-02)** points publishing |
| OWN-05 | Review and publish with step-up | Read-only or suspended (publish refused; draft editing allowed in read-only only); type or threshold change after publish (refused) | US4.6–US4.8 | FR-012, FR-040, FR-048 | PD-005 A2, A3, PD-010, PD-025 |
| OWN-06 | Owner staff profile setup: setup code for the owner's own PIN on an enrolled device | — | US7.8 | FR-016 | PD-034 |
| OWN-07 | Print-ready Branch QR | — | US4 | FR-031 | PD-031 |
| OWN-08 | Brand colours, an onboarding step (*proposed* placement: after OWN-03, before OWN-04). Primary, secondary and accent are prefilled with the platform default; colour entry as `#RRGGBB` plus swatches; a live preview of a sample card, rewards and progress in `ar` and `en` with derived colours | Invalid value (refused, nothing changes); a light colour shown with its derived text variant; keep the default in one action | US4.9, US4.10 | FR-135, FR-136, FR-137, FR-139 | PD-046; MB-03 (every stage, PD-005 A5); MB-04 (no branch palettes in P0) |

**The 8 dashboard pages (FR-100):**

| ID | Page | Content and states | US scenarios | FR | Decisions / open items |
| --- | --- | --- | --- | --- | --- |
| OWN-10 | Overview | KPIs (total, active 30 d, visits, rewards redeemed, near-reward, inactive 30 d); branch filter; plan, period end and stage; **needs attention**: fraud alerts (with detail and "mark reviewed"), voids needing the owner, unconfirmed captures. *Proposed:* repeat-rate and acquisition-cohort reports here, labelled separately, with NOT YET MEASURABLE and INCONCLUSIVE labels | US8.2–US8.4, US12.1–US12.5, US5.5 | FR-094, FR-101, FR-102, FR-110, FR-111, FR-113, FR-159–FR-163 | PD-018, PD-027, PD-028, PD-032, PD-036, PD-038 P4/P5; DD(OD-14) alert deduplication; DD(OD-07) meaning of "joined by staff scan versus branch QR" (FR-160) |
| OWN-11 | Customers | Search by first-name prefix plus last 3 digits only; result shows first name, progress, last 3 digits and visit history with branch; no export | US8.1, US8.5 | FR-006 | PD-013 |
| OWN-11a | Customer: manual adjustment (step-up) | Classification `bonus`, `gift`, `service_recovery` or `correction` (no `migration`); reason; stamps kept in [0, threshold); `bonus` and `gift` refused in read-only and suspended; refused while a void is in progress; never presented as an amount correction | US5.6, US5.9 | FR-012, FR-027, FR-065, FR-151, FR-173 | PD-003, PD-008 A1, PD-030 |
| OWN-12 | Programs | Current program and rewards; texts per language (no republish); reward cost and active state (sixth refused); earn rate; expiry ("never" vs "expiring" locked after the first purchase); every change with step-up; refused in read-only and suspended | US13.1–US13.5 | FR-042, FR-046–FR-048 | PD-024, PD-025, PD-005 A2/A3 |
| OWN-13 | Transactions | Purchases, redemptions, voids and adjustments; branch filter; void any purchase; voids needing the owner (retry or settle with step-up); original, void and re-capture linked; **no amount-correction action** for a customer who has left; **points void GATED** | US5.1–US5.5, US5.8–US5.11 | FR-060–FR-064, FR-068–FR-069, FR-102, FR-170–FR-174 | PD-008 A1, PD-030, PD-037; **DD(OD-11)** dashboard-void step-up; **GATED by FP-003** |
| OWN-14 | Rewards | Issued and redeemed rewards; redemptions counted from confirmed redemptions | US8.2 | FR-103 | PD-015, PD-018 |
| OWN-15 | Branches | List; add (no limit check); names; opening hours; deactivate (impact confirmation: devices, sessions, QR, claims cancelled, holds released) and reactivate; rotate the QR (every stage) and print | US7.5–US7.7 | FR-080–FR-083, FR-095 | PD-026, PD-005 A2/A3 |
| OWN-16 | Staff | Create (step-up; phone verified by a code to that phone); deactivate (every stage); PIN setup codes; staff phone change (owner approval); devices: enrollment code and revoke (every stage) | US7.1–US7.4 | FR-012, FR-085, FR-086 | PD-003, PD-010, PD-005 A2/A3 |
| OWN-17 | Settings | Brand colours: preview, change, reset to default (FR-136; every stage, PD-005 A5; a "too many changes, try again in N minutes" state (429) and a signed-out state (401); U-1, U-2, U-6); main language; amount label; large-bill threshold; reward expiry 7–90 days (refused in read-only and suspended); plan, period end and stage; owner phone change (step-up plus a code to the new number); sign out of all sessions | US8.4, US4.10 | FR-011, FR-012, FR-136, FR-023, FR-025, FR-045, FR-094 | PD-005 A3, PD-017, PD-020; DD(1.6) plan values |

## 4. Shared states (every surface)

| ID | State | FR | Decisions / open items |
| --- | --- | --- | --- |
| ST-01 | Arabic RTL by default, English LTR, remembered; mirrored layout; Western digits; Cairo time | FR-130, FR-132, FR-133 | PD-007 |
| ST-02 | Owner stage banner and disabled actions per stage (grace, read-only, suspended), using the PD-005 A2–A4 cells (US9.3, US9.5) | FR-092, FR-093 | PD-005 A2–A4 |
| ST-03 | Customer-facing stage messages | — | **DD(F-10)** |
| ST-04 | Offline: no value granted; member code per CUS-07 | FR-027, FR-121, FR-156 | PD-003 |
| ST-05 | Working-name label "اسم عمل — غير نهائي / Working name — not final" | — | PD-029 A1, PD-043 |
| ST-06 | Accessibility annotations: name, role, focus order, target size, contrast | FR-134 | PD-044; DD(A11Y-01) on CSH-03 |
| ST-07 | Merchant theme: merchant-context screens use the merchant palette with derived AA colours; platform screens keep the platform appearance; status colours, the focus ring and QR codes are never themed; moving between merchants shows only the selected merchant's palette; merchant identity is the display name as text | FR-138, FR-139 | PD-046; MB-01 (customer merchant screens and the owner preview only); MB-02 (screen classification); MB-05 (name as text, no logo in P0) |

## 5. Operator entries (`CLI`, no screens)

P0 operator tools are a CLI (`contracts/operator-api.md`). The console is P1 task 6.7.

| ID | Operator action | US scenarios | FR |
| --- | --- | --- | --- |
| CLI-01 | Super Admin sign-in through an external identity provider with MFA; DD(OD-06) transport fallback | — | FR-013 |
| CLI-02 | Record an offline payment; reversing entry | US9.1, US9.4 | FR-090, FR-093 |
| CLI-03 | Set or extend the plan and period end | US9.2 | FR-091 |
| CLI-04 | Plan usage monitoring | US8.6 | FR-095 |
| CLI-05 | Customer directory read with a recorded reason | US14.3 | FR-007, FR-152 |
| CLI-06 | Void escalation after 24 h; operator recovery | US5.5 | FR-064, FR-152 |
| CLI-07 | Owner recovery with an out-of-band identity check (procedure per 1.2) | US14.2 | FR-142 (DD(F-03, F-04, F-06)) |
| CLI-08 | Provision a café (display name, main language, plan, period end) and issue the owner invite (`POST /cafes`, `POST /cafes/{id}/owner-invites`); journey 1.4 step O1. Invite reissue is DD(F-07) | US4.1 | FR-015, FR-131 |
| CLI-09 | List unconfirmed captures (`GET /unconfirmed-captures`) | — | FR-026, FR-069 (R-14; DD(OD-10)) |
| CLI-10 | SLO report and weekly outage review (`GET /slo/report`, `/slo/outages`) | — | FR-155 |

## 6. FR coverage (all FR-001–FR-174)

**Screen** means a D1 screen or state. **Rule** means a system invariant with no screen of its own. Its refusal or result state, where one exists, is listed against the screen.

| FR | Covered by | FR | Covered by |
| --- | --- | --- | --- |
| FR-001 | Rule (tenant isolation); every screen shows one café's data | FR-060 | CSH-11, CSH-16, OWN-13 |
| FR-002 | CUS-05 | FR-061 | Rule; result on CSH-11, OWN-13 |
| FR-003 | CUS-02, CUS-04 | FR-062 | CSH-11 (needs owner), OWN-13 |
| FR-004 | Rule; AC-05 sample-data review | FR-063 | CSH-05, CSH-11, OWN-11a, OWN-13 (refusal states) |
| FR-005 | CUS-04, CUS-15 | FR-064 | OWN-10, OWN-13, CLI-06 |
| FR-006 | CSH-05, OWN-11 | FR-065 | OWN-11a |
| FR-007 | CLI-05 | FR-066 | Rule (never typed; no screen offers it) |
| FR-008 | CUS-16 | FR-067 | Rule |
| FR-009 | CUS-16 | FR-068 | CSH-11, OWN-13 (GATED) |
| FR-010 | CUS-02, CUS-03, OWN-01, OWN-02 | FR-069 | CSH-08, CSH-11, OWN-13 (GATED), CLI-09 |
| FR-011 | OWN-02, OWN-17 | FR-070 | CSH-15 |
| FR-012 | CSH-13, OWN-05, OWN-11a, OWN-12, OWN-16, OWN-17 | FR-071 | CSH-15 |
| FR-013 | CLI-01 | FR-072 | CSH-15, CUS-10 |
| FR-014 | CSH-01–CSH-03 | FR-073 | Rule; result on CSH-15 |
| FR-015 | OWN-01, CLI-08 | FR-074 | Rule (audit); outcome on CSH-15 |
| FR-016 | CSH-02, CSH-03, CSH-13–CSH-16, OWN-06 | FR-080 | OWN-15 |
| FR-017 | CUS-13 | FR-081 | OWN-15; CSH-02 (locked) |
| FR-018 | CUS-14 | FR-082 | OWN-03, OWN-15 |
| FR-019 | CUS-04, CUS-11 | FR-083 | OWN-15 |
| FR-020 | CSH-04 | FR-084 | CSH-02 |
| FR-021 | CUS-07, CSH-05 | FR-085 | OWN-16 |
| FR-022 | CUS-12 | FR-086 | OWN-16 |
| FR-023 | CSH-06, OWN-17 | FR-090 | CLI-02 |
| FR-024 | CSH-07 | FR-091 | CLI-03 |
| FR-025 | CSH-06, CSH-14, OWN-17 | FR-092 | ST-02 |
| FR-026 | CSH-07, CSH-08 (rule), CLI-09 | FR-093 | ST-02, CLI-02 |
| FR-027 | CSH-08, ST-04, OWN-11a | FR-094 | OWN-10, OWN-17 |
| FR-028 | CSH-05 | FR-095 | OWN-15 (no limit refusal), CLI-04 |
| FR-029 | CUS-09, CSH-09 | FR-100 | OWN-10–OWN-17 |
| FR-030 | CSH-04 (no phone lookup) | FR-101 | OWN-10 |
| FR-031 | CUS-01, CUS-09, OWN-07 | FR-102 | OWN-10, OWN-13 |
| FR-032 | CUS-01, CUS-09, CSH-09 | FR-103 | OWN-14 |
| FR-040 | OWN-04, OWN-05 | FR-110 | Rule; OWN-10 (alert-only) |
| FR-041 | CUS-06, CSH-08 | FR-111 | OWN-10 |
| FR-042 | CUS-06, OWN-04, OWN-12 | FR-112 | CSH-07 |
| FR-043 | CSH-06 | FR-113 | OWN-10 |
| FR-044 | CUS-08, OWN-04 | FR-120 | CUS-05, CUS-06 |
| FR-045 | CUS-06, OWN-04, OWN-17 | FR-121 | CUS-07, ST-04 |
| FR-046 | CUS-06, CUS-08, CSH-10, OWN-12 | FR-122 | CUS-10 |
| FR-047 | OWN-12 | FR-130 | CUS-11, ST-01 |
| FR-048 | OWN-05, OWN-12 | FR-131 | CUS-06, OWN-03, OWN-04 |
| FR-049 | OWN-04 | FR-132 | CUS-02, CSH-06, ST-01 |
| FR-050 | CUS-08, CSH-10 | FR-133 | CUS-06, ST-01 |
| FR-051 | CSH-10 | FR-134 | ST-06; CUS-03; CSH-03 (DD A11Y-01) |
| FR-052 | CSH-10 | FR-140 | Rule (no transactional or marketing message screen exists) |
| FR-053 | CSH-10 | FR-141 | CUS-17 |
| FR-054 | CSH-10 | FR-142 | CUS-18, CLI-07 |
| FR-055 | CSH-10 | FR-150 | Rule (audit) |
| FR-056 | CSH-10 | FR-151 | OWN-11a, CSH-15 (rule) |
| — | — | FR-152 | CLI-05, CLI-06 |
| — | — | FR-155 | CLI-10 (internal monitoring; no customer or owner screen) |
| — | — | FR-156 | CSH-08, ST-04 |
| — | — | FR-159–FR-163 | OWN-10 (visits, reports, cohorts) |
| — | — | FR-170–FR-174 | OWN-13 (no partial-refund or amount-correction action); CSH-12 (FR-171) |
| — | — | FR-135–FR-139 | OWN-08, OWN-17, ST-07; CUS-01, CUS-04, CUS-05 tiles, CUS-06–CUS-10 per MB-02 |

Unmapped FRs: 0, checked by script against `spec.md` on 2026-11-13. CLI-only: FR-007, FR-013, FR-090, FR-091 and FR-155, plus FR-095's operator view, FR-152, and the FR-064 escalation. Rule-only: FR-001, FR-004, FR-061, FR-066, FR-067, FR-073, FR-074, FR-110 (in part), FR-140 and FR-150. Each has a stated reason.

## 7. User-story scenario coverage

Every acceptance scenario US1.1–US14.3 is listed in the US column of §1–§5. Check:
- **US1** 1–8: CUS-01–CUS-04, CUS-11, ST-01; scenario 8 on CUS-05, CUS-06 and ST-07.
- **US2** 1–10: CSH-04–CSH-08, CSH-14, CUS-06, CUS-07.
- **US3** 1–9: CSH-10, CUS-08.
- **US4** 1–10: CLI-08, OWN-01, OWN-03–OWN-05, OWN-07, OWN-08.
- **US5** 1–11: CSH-11, CSH-12, CSH-16, OWN-10, OWN-11a, OWN-13. Scenario 2 is the stamp-restore computation (a rule; result on CSH-11 and OWN-13). Scenarios 7 and 10 are GATED.
- **US6** 1–7: CUS-01, CUS-09, CSH-09.
- **US7** 1–10: OWN-15, OWN-16, CSH-01–CSH-05, CSH-13.
- **US8** 1–6: OWN-10, OWN-11, OWN-17, CLI-04.
- **US9** 1–5: CLI-02, CLI-03, ST-02, CUS-05.
- **US10** 1–7: CUS-06, CUS-07, CUS-11–CUS-14, CUS-16.
- **US11** 1–6: CSH-15, CUS-10.
- **US12** 1–5: OWN-10.
- **US13** 1–5: OWN-12, CUS-06, CUS-08.
- **US14** 1–3: CUS-17, CUS-18, CLI-05, CLI-07.

Unmapped user-facing steps: 0, subject to the D1 review (AC-01).

## 8. Change log

**v0.2 (2026-11-13).** Corrected from the cross-check against the journeys and contracts. No Sol review has run on v0.1 or v0.2.
- CUS-01: JG-08 is Approved (PD-040 C3); only its refusal contract is open (PD-041).
- CUS-08 and CUS-07: UI behaviour the sources do not specify is labelled *proposed design*.
- US9.3 (ST-02) and US11.6 (CSH-15) are now cited by ID; a script check found them only in §7.
- CSH-01: suspended-stage refusal of new enrollment (PD-005 A3).
- CSH-05 and CSH-07: DD(OD-13), per journey 1.3 S7.
- CSH-06: PD-039 amount grammar and the strict "above" boundary, per journey 1.3 S5 and S6.
- OWN-03: the main language comes from operator provisioning, not owner setup (`operator-api.md` `POST /cafes`).
- Added CLI-08 (provisioning and invite; journey 1.4 O1), CLI-09 (unconfirmed captures) and CLI-10 (SLO report, FR-155).

**v0.3 (2026-11-13).** A sweep of every OD (research §5) and F-item (`journeys/jg-consolidation-review.md`) for UI relevance found three missing markers:
- DD(F-01) on CUS-02 and CUS-03;
- DD(OD-07) on OWN-10;
- DD(OD-06) on CLI-01.

OD-03, OD-04 and OD-09 are not UI items. F-05 concerns support tooling, which has no P0 screen. F-11 and F-02 apply to the D4 tap and timing annotations.

**v0.4 (2026-11-13).** PD-046 (merchant branding, owner-approved). No Sol review has run.
- Added OWN-08 (the brand-colours step) and ST-07 (merchant theme).
- Added brand colours to OWN-17.
- Added FR-135–FR-139 coverage, US1.8 and US4.9–US4.10.
- The inventory now has 51 screens. MB-01–MB-04 are open and marked DD.

**v0.5 (2026-11-13).** Autonomous session under owner delegation. No Sol review has run.
- MB-01–MB-05 are agent decisions under owner delegation, recorded in PD-046 and pending owner confirmation. They stay DD on the frames until confirmed.
- ST-07: the merchant identity is the display name as text; the logo slot is DD(MB-05).
- The Figma provisional baseline maps "CUS-05 Home" to CUS-06 (D3 §4c). No screen ID changes.

**v0.6 (2026-11-14).** The owner approved MB-01–MB-05 and PD-005 A5. No Sol review has run.
- The MB-01, MB-02, MB-04 and MB-05 markers are replaced by plain citations.
- OWN-17 keeps one narrow marker, DD(MB-03 risk trigger), for the undefined trigger of the step-up state.

**v0.7 (2026-11-14).** The owner approved U-1–U-6 and corrections A–C. No Sol review has run.
- OWN-17: the DD(MB-03 risk trigger) marker is replaced by the 429 and 401 states.
- CUS-01, CUS-09 and CUS-10 rows: CUS-01 is merchant-themed only after successful Branch QR validation (U-5); CUS-09 and CUS-10 restore the merchant identity after a reload (correction A, U-4).

## 9. Next steps (prototype design only)

1. Have D1 reviewed (AC-01, AC-06). Owner comments are recorded in D5.
2. Build D2 (design system), then D3 frames in Figma once the workspace is set up (PD-044 item 1, owner action).
3. Add the D4 annotations: DD markers, tap counts on CSH-04–CSH-10, onboarding start and stop markers (OWN-01 → OWN-07).
