# Quickstart: validating the P0 implementation

**Status.** This is a planning artifact. It describes how the P0 implementation will be **proven**; nothing here has been run, because no P0 code exists yet. Commands that do not exist yet are marked *(to be added)*.

**Planning approval record.** Included in the P0 Planning Gate approved by the owner on 2026-11-12; provenance and scope are recorded in plan.md, Approval reconciliation. Task generation was separately authorized. This approval does not establish execution evidence, resolve OD-01–OD-18, authorize FP-003, or approve Gate 2/implementation.

**Reporting.** Every run reports the following (Constitution Art. VII):
- the environment (Windows host, or Linux `node:22.22.0` + `postgres:17-alpine`);
- exact pass, fail and skip counts;
- the reason for every skipped test.

Mandatory PostgreSQL tests must run with zero skips.

## 1. Prerequisites

- **Runtime.** Node `22.22.0` and npm `10.9.4` (`npm ci`; pnpm is unsupported).
- **Database.** Docker with `docker compose --profile postgres` (`postgres:17-alpine`). Export `LIP_TEST_POSTGRES_URL=postgres://lip:lip@localhost:5432/lip_test` for the gated suites.
- **Official verification environment.** Linux, Node `22.22.0` and PostgreSQL 17, as in CI (`.github/workflows/ci.yml`). Results on a Windows host are reported as such and never substitute for it.
- **External messaging.** The OTP channel is `fake` in tests and staging. Live WhatsApp/SMS delivery waits on task 0.11.

## 2. Early spikes (run before Phase 3 feature work)

| Spike | How | Pass condition |
| --- | --- | --- |
| S-1 Engine persistence cost (R-08) | *(to be added)* `npm run bench:engine -- --members 1000,10000,50000 --months 12` against PostgreSQL 17 on Linux at the budgeted Render sizes, replaying the **complete** workload: preview + accrual, reserve + capture, customer card reads and polling across several cards, dashboard reads, and SLO probe traffic, across 100 cafés concurrently, with idempotency-record growth | p95 award < 500 ms at the projected 12-month café size under SC-005 load, with memory, CPU and DB connections within the budgeted sizes; otherwise OD-09 goes to the owner |
| S-2 LIP characterization (lip-integration.md) | *(to be added)* `npx vitest run tests/characterization` with `LIP_TEST_POSTGRES_URL` | Each listed behaviour recorded as an executed fact; any surprise raises a decision instead of a workaround (PD-008) |
| S-3 Session-lease and member-lock behaviour on Render staging (PD-006 condition 1) | Existing `tests/conformance/postgres-lease-conformance.test.ts` and `lip test`, plus *(to be added)* `apps/bff` two-instance member-lock test, run against the Render staging database | All pass, no skips |
| S-4 tzdata | `SELECT (timestamptz '2026-04-24 00:30+00' AT TIME ZONE 'Africa/Cairo')` and similar DST-boundary probes on Render and in `postgres:17-alpine`; Node ICU check | Both agree with IANA Africa/Cairo rules |

## 3. Standard verification (every change)

```bash
npm run typecheck
npm run docs:check
npm run launch:check
npm run public-safety:check
npm test                       # with LIP_TEST_POSTGRES_URL set: zero mandatory skips
npm run test:coverage          # thresholds extended to apps/bff (R-24)
```

Isolation suites that must run and pass on Linux + PostgreSQL 17:
- `tests/unit/tenant-isolation-live.test.ts`
- `tests/conformance/postgres-lease-conformance.test.ts`
- *(to be added)* `apps/bff/src/**/isolation.live.test.ts`, which covers every `bff` and `directory` tenant table and the customer, auth and operator roles.

## 4. End-to-end validation scenarios

The stack runs under compose: Postgres, Cloud data plane, BFF and web *(compose services to be added)*. The browser tests are Playwright *(to be added)*.

| # | Scenario | Proves | Expected outcome |
| --- | --- | --- | --- |
| E1 | Operator provisions café A (resumable; crash injected between credential issue and storage resumes cleanly); owner accepts the invite, signs in by OTP, creates a branch with overnight hours, publishes "5 drinks → 1 free", prints the Branch QR | US4, FR-012/015, SC-001 | Timed run is under 15 minutes. Publish needs step-up. A second invite use returns 410. Invites are refused before `provisioned`. |
| E1b | A non-technical owner creates "5 drinks → 1 free" in the wizard, timed from wizard start to publish | SC-002 | Under 3 minutes |
| E2 | A new phone scans the café A Branch QR, signs in by OTP, enters a first name, joins; then joins café B | US1, FR-002/003/005/031 | Two cards, the name asked once. Café A cannot see café B's membership (API 404 and RLS test). Consent is unchecked by default. The UI is Arabic RTL. |
| E3 | The owner issues a PIN setup code; the cashier enrolls a device, sets a PIN, signs in, scans the member QR, enters `٤٥٫٥٠` (Arabic-Indic digits), previews, confirms; then the LIP response is dropped on a second award | US2, FR-021/023/024/026, SC-004 | 4550 piasters. The preview equals `orders/evaluate`. The customer sees the balance within 2 s. A double confirm awards once. A replayed QR returns 410; the same-interval code of the customer's card at café B still scans. The dropped-response award becomes `unconfirmed` and **no second `accruals` call is ever sent** (journal shows one dispatch). |
| E4 | Award at 2,500 EGP without and with the re-type; 10,001 EGP as a cashier | FR-025 | Re-type required; above 5× refused. |
| E5 | The cashier's own phone is the customer's; then the owner staff profile awards the owner's own card | FR-028 | Cashier refused. Owner self-award succeeds and is audited as such. |
| E6 | A purchase completes a card; redeem the issued reward with the device-generated reward code; two cashiers capture concurrently; a hold abandoned for 121 s; a capture whose response is dropped at 119 s; a publish between display and hold | US3, FR-046, FR-050–FR-055 | Exactly one capture. The abandoned hold is released and the reward is available again. The dropped-response capture is resolved forward to `captured` and is **never** released by the timer. The publish race releases the hold with `reward_terms_changed`. The `stamp-<member>-<n>` id is never accepted as a code. |
| E7 | Stamp void k = 0 and k = 1 examples from US5 #2; crash injected after the clawback step; replay | FR-061–FR-064, C1–C8 | Final balance in [0, t). Replay restores no extra stamps. The member block refuses other writes until reconciled. |
| E8 | Points café (test/staging only): award, redeem, then void | R-18, FR-068 gate | Void refused with `points_void_unavailable`. Nothing is posted to LIP and no block is created. |
| E9 | Branch QR claim: 2 wrong attempts (attributed per OD-12), then the right one; a second claim expires at 15 min; rotate the QR with a claim open; deactivate the branch while an award and a reserve are past validation but before their intent commit, and while another reserve's intent is already committed | US6, FR-029/032/081 | Confirmed once. Expiry works. Rotation keeps the open claim. Deactivation cancels it and revokes devices and sessions; the not-yet-committed operations are refused with `branch_inactive`; the committed reserve is resolved then released. |
| E10 | Operator sets the period end in the past by 1, 8 and 38 Cairo days; every PD-005 A2 action is attempted; a payment is recorded | US9, FR-092/093, SC-008 | Every table cell matches. A payment restores service immediately. Balances are untouched. |
| E11 | Paper-card migration: accept + attest; decline; expire; balance + n ≥ t; day 61; two concurrent postings | US11, FR-070–FR-074 | One post at most. All refusals as specified. The audit is complete. |
| E12 | Scripted activity crossing each PD-027 rule, with idempotent retries | US12, FR-110–FR-113 | One alert per rule and window. No transaction blocked. Retries trigger nothing. |
| E13 | Visits: two branches on the same Cairo day; 23:50 and 00:10 purchases; void of the first purchase; DST day | FR-159/FR-162/FR-163 | One visit, re-attributed after the void. Branch totals equal the café total. |
| E14 | SLO report over a synthetic month with gaps and failures, including a DST day | SC-012, PD-038 P6 | PASS, FAIL and INSUFFICIENT DATA exactly per definition. M uses the actual elapsed minutes. |
| E15 | Customer deletion while a void is in progress, then after it completes; deletion racing a void request on another instance; deletion while a void sits `requested` after a reclaimed admission; a void requested after erasure | FR-008/009 | Queued, then erased. Ledger rows remain. Every PII field listed in data-model §2 is gone (including `first_name_fold` and OTP challenges). The race never erases while any void of the customer's members is unfinished, including a `requested` void with neither a slot nor a block (after a reclaim); a void requested after erasure gets `410 member_erased`. |
| E16 | Two BFF instances run every sweeper against one database | SC-016 | Each due item is processed exactly once. |
| E17 | Plan limits exceeded | FR-095, US8 #6 | Joins, branches and staff are still allowed. Usage is visible to the operator. |
| E18 | Crash and lock-loss injection on two BFF instances: (i) after an adjustment intent commits, before send; (ii) after LIP commits a void step, before the outcome record; (iii) lock connection killed while an adjustment is in flight, then an award and a void requested on the other instance; (iv) a delayed zombie send after a **refused** re-send; (v) a stale worker writing an outcome; (vi) an accrual intent that crashed before `dispatched`; (vi-b) a crash after `dispatched` and before the send; (vi-c) an `admitting` slot whose pre-call reads crashed; (vi-d) a branch deactivated between an award's 1a and 1c; (vi-e) during a void's precondition reads (V-b), an award, a reward hold and an adjustment requested for the same member on the other instance; a void requested while the member has an open reward hold; a crash during V-b; (vi-f) admission fencing: an award's 1b delayed past its lease, the slot reclaimed, another operation admitted and completed, the **same** capture session re-confirmed (same `op_ref`, new token), then the delayed 1c resumes; the same for a void (V-c delayed after reclaim and re-admission of the same void id); a stale 1c failure path trying to delete the newer slot; two instances admitting the same member concurrently; (vi-g) redemption capture uncertain, re-send answered `expired` while the original attempt is unanswered, with S-2 verified and not yet verified; (vii) generic `POST /adjustments` with `migration` | R-07, FR-063/064/073, PD-008 A1 (c)/(d) | (i)/(ii) recovered forward in step order with no duplicate effect; (iii) both refused with `member_busy` until the adjustment resolves; (iv) the call stays uncertain and the member's slot stays held (option B) — or the engine refuses it after `not_after` (option A, if authorized); (v) not applied; (vi) marked `abandoned`, slot released, no LIP call; (vi-b) treated as uncertain (frozen under option B); (vi-c) slot reclaimed after its lease; (vi-d) 1c refuses with `branch_inactive`, deletes its slot, no LIP call; (vi-e) all refused with `member_busy`; the void with an open hold is refused `member_busy` until the hold ends; after a V-b crash the slot is reclaimed, the void stays `requested` and the sweeper (within 15 min) or a retry re-admits it; (vi-f) every delayed 1c/V-c fails the `admission_id` check and commits no snapshot, intent or plan and sends nothing; the stale delete removes nothing; the newer admission completes normally; of two concurrent admissions exactly one succeeds and the other gets `member_busy`; (vi-g) verified: call `failed_definite`, redemption `expired`, slot released; not verified: call stays `uncertain`, member held; (vii) `409 migration_classification_reserved`. |
| E19 | Operator and RLS negatives: a valid MFA token for a non-allowlisted subject; a revoked operator; the auth and sweeper roles querying tenant tables directly; a tenant session querying the visit views for another café | R-13, data-model §1, SC-007 | All refused or empty. |

## 5. Readiness gates before the pilot (task 5.6)

- **Security and load.** SC-013 security review findings fixed or accepted in writing (task 5.1). SC-005 load test at 100 cafés (task 5.2).
- **Restore drill.** Render PITR restore drill with RPO and RTO recorded (SC-014). `cloud:restore-verify`, extended to the `bff` and `directory` schemas, passes.
- **Vulnerabilities.** Fresh dependency audit, image OS-package scan and live readiness checks; critical and high findings resolved or accepted in writing (SC-015).
- **Points cafés (all mandatory).**
  - FP-003 gates (a)–(e) in `07-fork-patches.md`: an owner-approved point-lot attribution algorithm, source-level verification, the V1 regression tests (void and redemption over-debit cases), V2–V4 and V7, and separate implementation authorization.
  - V5 and V6.
  - SC-017 verified in the official environment.

  Until then, no points café joins the pilot.
- **Other gates.** Legal task 0.10 and company registration task 0.11.
