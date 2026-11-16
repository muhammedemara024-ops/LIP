# BFF API contracts — conventions

**Status**: Included in the P0 Planning Gate approved by the owner on 2026-11-12 (approval provenance and scope: plan.md, Approval reconciliation), subject to OD-01–OD-18 and all verification gates. These contracts describe `apps/bff` interfaces only. `/lip/v1`, `/platform/v1`, `/admin/api/v1` and `/cloud/v1` are unchanged (Constitution Art. II). Machine-readable OpenAPI for these routes is generated from the TypeBox schemas during separately authorized implementation; these Markdown files are the planning contract.

**Unapproved amendment present.** This file contains a "Proposed amendment (PD-046), not approved at Gate 2" block (2026-11-13). It is outside every approval recorded above.

| File | Audience | Mount |
| --- | --- | --- |
| [customer-api.md](customer-api.md) | Customer (`app.`) | `/api/v1/customer/*` |
| [staff-api.md](staff-api.md) | Cashier / owner staff profile (`staff.`) | `/api/v1/staff/*` |
| [owner-api.md](owner-api.md) | Owner (`dashboard.`) | `/api/v1/owner/*` |
| [operator-api.md](operator-api.md) | Super Admin operator tooling | `/operator/v1/*` |
| [lip-integration.md](lip-integration.md) | BFF → LIP runtime | `/runtime/v1/environments/{env}/lip/v1/*` and `/admin/api/v1/program/*` |

## Transport and authentication

- **Transport.** JSON over HTTPS. Browsers call `/api/*` on their own surface host, and Next.js rewrites the call to the BFF (research R-05). Operator calls go to `api.` with an OIDC bearer token.
- **Session cookies.** `__Host-cust`, `__Host-staff` and `__Host-owner`, each host-only on its surface. Staff devices also carry `__Host-device`. The flags are `Secure; HttpOnly; Path=/; SameSite=Lax`.
- **Session endpoints.** Each surface has `GET /session` (`/api/v1/customer/session`, `/api/v1/staff/session`, `/api/v1/owner/session`). It returns `{signed_in, language, csrf_token}`. When signed out it also sets a short-lived host-only `__Host-pre` cookie and returns that token as `csrf_token` (research R-10).
- **CSRF.** Every state-changing request (`POST`/`PUT`/`PATCH`/`DELETE`) on a browser surface needs `X-CSRF-Token` equal to the session's CSRF token — or, before sign-in, the `__Host-pre` double-submit token — plus an `Origin` (or `Sec-Fetch-Site: same-origin`) matching the surface host. Otherwise the request fails with `403 csrf_failed`. Sign-in always issues a new session id. Operator calls on `api.` carry a bearer token, accept no cookies and are exempt from CSRF.
- **Idempotency.** Every state-changing request after sign-in carries an `Idempotency-Key` header (UUID). It is scoped to (tenant, actor, key) — operator calls to (operator subject, key). Pre-sign-in endpoints take none; their effects are bounded by OTP and rate rules.
  - Same key and same body: the original response is returned.
  - Same key and a different body: `409 idempotency_conflict`.

  Business operations also carry server-side business ids, so a lost key never double-applies (LIP `order_id` and `adjustment_id` protection).
- **Scope.** Tenant, branch, staff and device always come from the session or device credential and **never** from the body or query (PD-014). A body field naming another tenant or branch is ignored for scoping, and a mismatch is a `403 forbidden`.
- **Money.** `{ "amount": <integer piasters>, "currency": "EGP" }`. Amount inputs are accepted as decimal strings in Western, Arabic-Indic or Persian digits with at most 2 decimals, and normalized server-side to piasters. Floats are rejected.
- **Time.** RFC 3339 UTC in payloads. Display formatting in `Africa/Cairo` happens in the client using the server-provided zone name.
- **Personal data.** No PII in URLs or query strings, including search terms (customer search uses a request body). Phone numbers appear only in sign-in and phone-change bodies. Responses that contain personal data carry `Cache-Control: no-store`.

## Error model

```json
{ "error": { "code": "void_in_progress", "message_key": "errors.void_in_progress", "request_id": "req_…", "details": {} } }
```

`message_key` maps to Arabic (default) and English texts in `apps/web`. The BFF never returns raw upstream error text to clients.

| HTTP | `code` | Meaning |
| --- | --- | --- |
| 400 | `validation_failed` | Schema or field validation; `details.fields` |
| 401 | `unauthenticated` | No or expired session |
| 401 | `step_up_required` | Owner-only action needs a fresh owner OTP (FR-012, FR-016); `details.action` |
| 403 | `forbidden` | Role, branch or tenant not allowed (PD-014) |
| 403 | `csrf_failed` | CSRF/Origin check failed |
| 403 | `stage_forbidden` | Subscription stage forbids the action (PD-005 A2–A4); `details.stage` |
| 403 | `self_dealing_forbidden` | Staff acting on own customer account (FR-028) |
| 403 | `device_revoked` / `branch_inactive` / `staff_inactive` | Credential no longer valid |
| 404 | `not_found` | Not visible in scope (cross-tenant objects are indistinguishable from missing) |
| 409 | `conflict` | Business-id reuse with different facts |
| 409 | `idempotency_conflict` | Same `Idempotency-Key`, different body |
| 409 | `void_in_progress` | Member blocked by an unreconciled void (FR-063) |
| 409 | `member_busy` | Another operation for this member holds the durable admission slot, or an erasure is in progress; retryable (research R-07) |
| 410 | `member_erased` | The member's customer account was erased; the membership is closed and no operation can be admitted. Final, not retryable (data-model §2) |
| 409 | `member_frozen` | An earlier call for this member is unresolved and cannot yet be fenced (research R-07 step 6, OD-15 option B); needs operator resolution |
| 409 | `migration_classification_reserved` | `migration` adjustments can only be posted by the paper-migration workflow (FR-070–FR-074) |
| 409 | `reward_terms_changed` | The program was republished between display and hold; the hold was released, refresh and retry (R-16) |
| 409 | `profile_locked` / `pin_not_set` | Staff PIN locked after wrong attempts or not yet set; owner issues a PIN setup code (R-12, OD-01) |
| 409 | `repeat_award_confirmation_required` | New award to the same card within 10 min (PD-027) |
| 409 | `one_reward_per_order` | PD-015 |
| 409 | `insufficient_balance` | Redemption would go below zero (PD-015) |
| 409 | `amount_retype_required` / `amount_over_cashier_limit` | Large-bill rules (PD-008) |
| 409 | `void_window_expired` / `void_not_own_purchase` | FR-060 |
| 409 | `void_needs_owner` | PD-008 A1 precondition failed; sent to the owner |
| 409 | `points_void_unavailable` | Points void execution disabled until the FP-003 gates pass (research R-18) |
| 409 | `migration_not_allowed` | PD-021/PD-022 window, stage, limit or program-type rule |
| 410 | `code_expired` / `code_used` / `qr_rotated` / `claim_expired` / `invite_expired` | Single-use or expired credentials |
| 422 | `otp_invalid` / `otp_expired` / `otp_attempts_exceeded` | PD-004 |
| 429 | `rate_limited` | OTP, PIN or IP limits; `details.retry_after_s` |
| 410 | `reservation_expired` | LIP expired the hold (backstop only, R-16); nothing was captured |
| 202 | (not an error) `{status:"confirming"}` | Outcome not yet confirmed (research R-14); never shown as success. An award that stays uncertain becomes `unconfirmed` and is never re-sent |
| 503 | `loyalty_unavailable` / `otp_paused` | LIP unreachable (nothing granted, PD-003) / OTP circuit breaker open |

**Proposed amendment (PD-046), not approved at Gate 2** (policy owner-approved 2026-11-14: U-2, U-3, U-6). For the brand-palette mutation endpoints in owner-api: `429 rate_limited` also covers the per-merchant success limit and the per-owner-account attempt limit, with `details.retry_after_s` and a proposed additive `details.limit` (`"merchant_saves"` or `"owner_attempts"`); and `401`, `403` and `429` are never stored as completed idempotency results. The table above changes only on Gate 2 approval ([gate2-branding-revision.md](../gate2-branding-revision.md) §5.7).

## Audit

Every state-changing staff, owner, operator and system call writes one `bff.audit_log` row in the same transaction as its state change. The row records the actor, owner, staff, branch, device, operation, target, before/after where relevant, reason, request id and override flag (FR-150–FR-152). Customer self-service writes (consent, device revoke, deletion, phone change) are audited too, with the actor kind `customer`.
