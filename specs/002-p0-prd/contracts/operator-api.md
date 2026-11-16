# Operator API (`api.` → `/operator/v1`) — Super Admin tooling

P0 has operator tools only; the console UI is P1 task 6.7. The tools are a CLI (`apps/bff/src/operator-cli.ts`) that authenticates through OIDC device flow with provider-enforced MFA (PD-010, FR-013; provider chosen at task 2.2, OD-06).

**Authorization.** A verified token alone is not enough: its (`iss`, `sub`) must be an active row in `bff.operators` (R-13). Every call is audited, with the operator subject as the actor. Calls are bearer-only on `api.`: no cookies, no CSRF. Writes carry an `Idempotency-Key` scoped to the operator subject.

| Method & path | Request | Rules |
| --- | --- | --- |
| `GET/POST /operators`, `POST /operators/{iss}/{sub}/revoke` | `{issuer, subject}` | Manage the allowlist; audited; revocation applies on the next request |
| `POST /cafes` | `{display, main_language, plan_id, period_end_date, is_test_cafe?}` | Resumable provisioning (R-02): Cloud `provisionTenant` (one environment = one tenant/program) → wait for readiness → issue a merchant credential through the rotation operation (P0 requests no webhook, so `provisionTenant` returns none) → persist encrypted and verify with a read-only call → `provisioned`. Returns the current `provisioning_step`; re-calling with the same client-supplied `cafe_request_id` resumes rather than duplicating. Invites are refused until `provisioned`. |
| `POST /cafes/{id}/owner-invites` | `{owner_phone}` | Single-use invite bound to the phone, valid 72 h, stored hashed (FR-015). Delivery needs task 0.11 for live numbers. |
| `POST /cafes/{id}/credentials/rotate` | — | Cloud `rotateTenantCredentials` with overlap |
| `POST /cafes/{id}/payments` | `{payment_id, amount, method, reference, paid_on}` | Append-only. The same id and body returns the original; a different body → `409` (FR-090). |
| `POST /cafes/{id}/payments/{pid}/reverse` | `{reversal_id, reason}` | A reversing entry, never an edit |
| `PUT /cafes/{id}/subscription` | `{plan_id, period_end_date}` | Audited before/after (FR-091); recording an extension restores service immediately because the stage is computed on read (FR-093) |
| `GET /cafes/{id}/subscription` | — | Plan, period end, computed stage, payment history |
| `GET /cafes/{id}/usage` | — | Exact customer, branch and message counts against the plan limits, monitoring only (FR-095, PD-038 P9); excludes the test café |
| `GET /cafes/expiring?days=7` | — | Ending soon and overdue (PD-005 A1 list) |
| `POST /customers/{id}/read` | `{reason}` | Reason required and logged (FR-007) |
| `GET /voids?status=escalated` | — | Escalations after 24 h (FR-064) |
| `GET /unconfirmed-captures` | — | Captures whose accrual outcome is unresolved (R-14, OD-10) |
| `GET /slo/report?month=&operation=` | — | M, O, S, coverage, worst-case availability, PASS/FAIL/INSUFFICIENT DATA, gap minutes, partial-month label (SC-012) |
| `GET/PUT /slo/outages/{id}` | `{recovery_notes, reviewed}` | Weekly review (FR-155) |
| `POST /owner-recovery` | `{cafe_id, evidence_ref}` | Task 1.2 procedure: out-of-band identity check recorded, every owner session revoked, audited (FR-142) |
| *(customer recovery)* | — | FR-142 makes customer recovery follow the procedure produced by roadmap task 1.2, which is not done yet. Its contract is added when 1.2 is approved; it is a dependency of task 2.4, not assumed here. |

Support staff have no operator role that can change balances (FR-141, US14).
