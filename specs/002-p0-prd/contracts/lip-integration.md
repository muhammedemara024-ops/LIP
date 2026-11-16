# BFF → LIP integration contract

`/lip/v1` wire semantics and `spec/` are used unchanged. Calls go through `LipClient` (`packages/sdk`) with `baseUrl = <LIP private URL>/runtime/v1/environments/{environment_id}` and the café's merchant key, held only in the BFF (R-02). Every write is journaled in `bff.lip_calls` before it is sent (R-07).

## Identifier formats

| Identifier | Format | Notes |
| --- | --- | --- |
| member id | `m` + 26 Crockford base32 | No hyphen, so the engine's `stamp-<member>-<n>` parses unambiguously (PD-008 A1 check (e)) |
| purchase order id | `p_<ULID>` | One per capture session (PD-008) |
| redemption-only order id | `r_<ULID>` | Own namespace; never accrued (PD-008 A1) |
| stamp void ids | cancel key `void:<void id>:cancel:<reward id>`, adjustment `void-<void id>`, restore `void-<void id>-restore` | Exactly as PD-008 A1 |
| points void adjustment id | `void-<void id>` | FP-003 item 7; executed only after the FP-003 gates |
| owner adjustment / migration ids | `adj_<ULID>` / `mig_<ULID>` | Owner gifts never start with `stamp-` (C2) |

Idempotency keys are derived only from business ids (for example `accrue:<order_id>`, `reserve:<redemption_id>`) and never contain identity values.

## Calls

| BFF operation | LIP call | Idempotency / business id | Notes |
| --- | --- | --- | --- |
| Café credential | Cloud credential-rotation operation (after `provisionTenant` and readiness) | `cafe_request_id` | `provisionTenant` returns no credential without a webhook (R-02) |
| Join | `members/enroll` | `enroll:<membership_id>` | No PII in member attributes ([VERIFY] at 2.3) |
| Card view | `accounts/get`, `issued-rewards/list` | read | Expiry moments shown as Cairo date and time (PD-007 C1) |
| Preview | `orders/evaluate` | read | One synthetic line, loyalty-eligible, channel `counter` |
| Pre-accrual snapshot | `accounts/get`, `issued-rewards/list` | read | Read in step 1b, after the member's slot is admitted (1a) and with no database transaction open; committed with the accrual intent in 1c (R-07, R-14) |
| Issued-reward discovery | `issued-rewards/list` | read | After a confirmed accrual; `LedgerResponse` does not list issued rewards (R-16) |
| Award | `accruals` | `accrue:<order_id>` | **Never re-sent** after an uncertain outcome, interactively or in the background (PD-038 P8, FR-069; R-07/R-14) |
| Hold / capture / release | `redemptions/reserve` / `capture` / `reverse` | `reserve:<rid>` / `capture:<rid>` / `reverse:<rid>` | Steps of one workflow per redemption; uncertain steps re-sent with the same key. LIP `reservation_ttl_seconds` well above 120 (proposed 600) as a backstop; the BFF releases at 120 s only when no capture intent exists (R-16). The reserve response is stored as the hold's terms |
| Stamp void | `issued-rewards/cancel`, `orders/adjust` (`void`), `ledger/manual-adjustments` (`correction`, `qualifies_for_tier:false`) | PD-008 A1 ids | Plan saved before the first call; byte-identical replay (C4) |
| Owner adjustment / migration | `ledger/manual-adjustments` | `adj_…` / `mig_…` | Classification and reason required |
| Reconciliation and evidence | `ledger/list`, `issued-rewards/list` | read | Paging and completeness rules are V4 inputs (FP-003) |
| Program publish | `/admin/api/v1/program/*` draft → validate → publish (expected draft version) | publish request id | `reset_on_issue:true`; stamp reward cost = t; `minimum_eligible_spend_minor_units ≥ 1`; `warning_days:[30]` |
| Branch registration | location registry (Admin API) | `branch_id` | Engine refusal of inactive locations is [VERIFY] (PD-026); the BFF refuses regardless |

## Characterization tests (task 2.2 / 3.x, Linux + PostgreSQL 17)

These run through `LipClient` against a real managed data plane before the dependent features are marked done:

- `stamp-<member>-<n>` and `-reset` naming (PD-008 A1 check (f)).
- Whether a stale stored `reserved` status blocks `issued-rewards/cancel` (check (a)).
- Whether idempotency records and lazily applied expiry persist in the same commit (check (b)).
- Serialization through the managed data plane (check (c)).
- Whether the hold cost is fixed at hold time (PD-025).
- Reserve and capture against a zero-value synthetic order (PD-008).
- Whether inactive-location orders are refused (PD-026).
- `ledger/list` ordering and paging, and that accruals carry `order_id` (FP-003 V4 input).
- That accrual records exist with amount 0 below the minimum spend (FP-003 V3).
- That the managed data plane never refuses an `active` manual subscription without usage events (PD-005 A2, task 5.5).
- How long a write can still commit after the client's timeout (server request and statement timeouts), which bounds an uncertain call (R-07).
- Reservation expiry: a capture or reverse after LIP expiry returns `expired`, and expiry restores the issued reward or points exactly once (R-16). Also, for the conditional definitive outcome in R-07 step 4: expiry is evaluated inside the program-locked transaction before any effect; an expired reservation never becomes capturable again; an original attempt arriving after a same-key re-send is answered `expired` or with the cached success, never a fresh effect. Until these are recorded as executed facts, an `expired` answer does not end an uncertain call.
- That automatically issued stamp rewards carry no bearer artifact; the exact reservation response fields (R-16).
- That a refused request is not cached by idempotency, so a delayed original can still commit after a refused re-send (R-07; the reason fencing is OD-15).

## Not used in P0

- `orders/adjust` `partial_refund` and `correction` (PD-030).
- `/platform/v1` member profiles, events, segments and campaigns (PD-013, PD-016).
- Cloud usage events (PD-035).
- Cloud environment suspension and LIP write-freeze for billing stages (PD-005 A2).
