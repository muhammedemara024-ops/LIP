# Owner API (`dashboard.` → `/api/v1/owner`)

Conventions and errors: [README.md](README.md).

- **Auth.** Owner session (`__Host-owner`, 30 days sliding).
- **Scope.** The tenant comes from the owner account.
- **Step-up.** Actions marked **SU** need a step-up grant from `POST /step-up/send` and `POST /step-up/verify`. The OTP goes to the owner's own phone (FR-012). Each grant is bound to one action and one target.
- **Stage.** Actions marked **RO✗** are refused in the read-only and suspended stages, and actions marked **S✗** are refused in the suspended stage, per PD-005 A2.

## Sign-in and invite

| Method & path | Request | Success | Rules |
| --- | --- | --- | --- |
| `GET /invites/{token}` | — | `{cafe_display, phone_last3}` | `410 invite_expired` if used, expired or unknown (FR-015) |
| `POST /invites/{token}/otp` → `/accept` | `{turnstile_token}` → `{challenge_id, code}` | owner account + session | The OTP goes to the bound phone; the invite is single-use |
| `GET /session` | — | `{signed_in, language, csrf_token}` (+ `__Host-pre` when signed out) | README *Session endpoints* |
| `POST /otp/send` → `/otp/verify` | phone → `{challenge_id, code}` | session | Owner sign-in (PD-010) |
| `POST /sessions/revoke-all` | — | `204` | — |
| `POST /phone-change/*` | — | — | **SU**, plus an OTP to the new number |

## Café, branches, staff, devices

| Method & path | Rules |
| --- | --- |
| `GET/PUT /settings` | Main language, amount label, large-bill threshold, reward expiry 7–90 days. Read shows plan, period end and stage (FR-094). **RO✗** on changes to program-linked settings. Per-setting stage cells are fixed by PD-005 A3 (2026-11-13): main language, amount label and large-bill threshold are allowed in every stage; reward expiry is refused in read-only and suspended. All cells are enumerated in the `stagePolicy` table at task level so SC-008 stays testable. |
| `POST /branches`, `PUT /branches/{id}` (names, hours) | Hours are stored in Cairo local time, with overnight intervals and closed days (FR-082). Branch creation is not limit-checked (FR-095). |
| `POST /branches/{id}/deactivate` / `reactivate` | Deactivation runs immediately and is audited. It revokes devices and staff sessions, deactivates the QR, cancels open claims and reverses open holds (FR-081). |
| `POST /branches/{id}/qr/rotate` | Allowed in every stage (FR-083). Open claims are kept (FR-032). Returns printable QR data. |
| `POST /staff` | **SU**, **RO✗**. Body: first name, home branch, phone. The name and phone go to the directory. The staff phone is verified with an OTP to that phone before activation (FR-085). |
| `POST /staff/{id}/pin-setup-code` | **SU**. Issues a single-use PIN setup code for that profile (first PIN, reset, unlock). A reset clears the PIN, revokes the profile's sessions and is audited (R-12, OD-01). |
| `POST /staff/{id}/deactivate` | **SU**. Allowed in every stage (FR-086). |
| `POST /staff/{id}/phone` | Owner approval for a staff phone change (FR-085): **SU** plus an OTP to the new number. |
| `POST /devices/enrollments` | **SU**. Single-use enrollment code for a branch (R-12). |
| `DELETE /devices/{id}` | Revoke. Allowed in every stage. |
| `POST /owner-staff-profile/pin-setup-code` | **SU**. Issues the setup code with which the owner sets the owner staff profile PIN on an enrolled device (FR-016, R-12). |

## Brand palette — proposed amendment (PD-046)

**Proposed amendment (PD-046), not approved at Gate 2.** Drafted 2026-11-13 in the autonomous session under owner delegation. It authorizes nothing, closes no gate (`branding-contracts` stays open) and follows MB-01–MB-05, PD-005 A5, U-1–U-6 and corrections A–C (owner-approved 2026-11-14; decisions only, this draft itself stays UNAPPROVED; design in [gate2-branding-revision.md](../gate2-branding-revision.md)). No Sol review has run.

| Method & path | Rules |
| --- | --- |
| `GET /branding` | Returns `{primary, secondary, accent, version, is_default}`. When no palette is set, the colours are the platform default (`#3A2419`, `#E8C88A`, `#F59E0B`), `is_default: true` and `version` is the stored version, or 0 when no row exists. Owner role only. |
| `PUT /branding` | Body `{primary, secondary, accent, expected_version}`; `Idempotency-Key` and CSRF required. Each colour must match `^#[0-9A-Fa-f]{6}$` and is stored upper case; otherwise `400 validation_failed` with `details.fields.<role> = "invalid_colour"`, and nothing changes (FR-137). `expected_version` differs → `409 conflict`, nothing changes. Success `200` with the `GET` shape. Audited (FR-150). No other field is accepted: no CSS, URL, font or image. |
| `POST /branding/reset` | Body `{expected_version}`; `Idempotency-Key` and CSRF required. Sets the default and increments the version. Same conflict and audit rules. |

- **Stage cell:** allowed in every stage (PD-005 A5, owner-approved 2026-11-14), as the single action `branding.change`. No other stage cell changes.
- **Security policy (owner-approved 2026-11-14: MB-03, U-1, U-2, U-3, U-6, correction B; package §2):**
  - `401 unauthenticated`: no valid owner session reaches the endpoint, including an expired, invalid or revoked session (the owner signs in again) and staff, owner-staff-profile, customer or operator callers whose cookies are host-only on other surfaces.
  - `403 forbidden`: an authenticated owner-surface principal without the branding permission for its session's merchant. `403 csrf_failed`: CSRF or Origin check failed.
  - No additional one-time code for ordinary changes; no risk-detection subsystem in P0.
  - The merchant comes from the owner session. The body accepts exactly the listed fields; any other field → `400 validation_failed`, nothing changes.
  - Limits, per rolling 60 minutes, enforced atomically: 10 successful saved changes per merchant (resets and the onboarding save count; previews do not) and 30 authenticated mutation attempts per owner account (not reset by a new session, device or merchant context). Exceeded → `429 rate_limited` with `details.retry_after_s` (and the proposed additive `details.limit`).
  - `401`, `403` and `429` are never stored as completed idempotency results; a same-key retry is processed against the current authentication, authorization and rate-limit state. Fingerprint checks stay: a different body under a completed key → `409 idempotency_conflict`.
  - Audit: one append-only `audit_log` row per successful change or reset: actor, time, operation, previous and new palette and version.
  - Onboarding (OWN-08) saves through `PUT /branding`, so its save is audited and counts toward both limits (U-2). Keeping the default sends no request and counts nothing (proposed, package §3.2).
- **Proposed design (not approved; package §3):** the check order (session → CSRF → authorization → idempotency lookup → attempt limiter → stage → body → transaction: lock, version, success cap, write, audit, idempotency record); `bff.owner_mutation_limits` with `bff.consume_owner_attempt`; operation names `branding.update` / `branding.reset`; design-review items D-1–D-7.
- **Not offered:** branch palettes (MB-04), logo upload (MB-05).

## Program and rewards

Stage-cell provenance is enumerated in [execution-briefs.md](../execution-briefs.md), Stage-policy cells: PD-005 A2 (ten actions) plus PD-005 A3 (settings, branch create/update/deactivate/reactivate, device enrollment, staff and owner-profile access recovery, owner-profile first-time setup, program draft) plus PD-005 A4 (customer pending-claim creation, customer API). Any action not covered by A2, A3 or A4 is still not wired by inference from its URL or from plan-limit monitoring; it goes to the owner.

| Method & path | Rules |
| --- | --- |
| `GET /program` | Settings, program name and rewards with texts in each language, publish state |
| `PUT /program/texts` | **SU**, **RO✗**. Program name per language; the main language is required (FR-131). No LIP republish. |
| `PUT /program/draft` | Wizard state: stamps (threshold, one reward) or points (earn rate with the 5/100 suggestion, ≤ 5 rewards, expiry option). Hides exclusions, discounts, tiers and multiple programs (FR-049). |
| `POST /program/publish` | **SU**, **RO✗**. LIP draft → validate → publish with the expected draft version. Type and threshold are immutable after the first publish (FR-040). `reset_on_issue` is always on, the stamp reward cost equals the threshold, and the minimum spend is ≥ 1 piaster. Production points programs follow OD-02. |
| `PUT /rewards/{id}/texts` | **SU**, **RO✗**. Appends a new text version; no LIP republish (FR-047). Issued rewards keep their snapshot (R-16). |
| `PUT /rewards/{id}` (cost, active) / `POST /rewards` | **SU**, **RO✗**. A sixth active reward is refused. Changes apply only to future events (FR-046, US13). |

## Corrections

| Method & path | Rules |
| --- | --- |
| `GET /transactions` | Purchases, redemptions, voids and adjustments with branch filter and cursor |
| `POST /purchases/{id}/void` | Owner void of any purchase (FR-060). Allowed in all stages. Stamps follow PD-008 A1; points are `points_void_unavailable` until the FP-003 gates pass. **Step-up:** FR-016 requires fresh owner authentication only when the void starts from the owner staff profile, and FR-012 does not list voids. Whether a dashboard void also needs step-up is **OD-11** (recommended: yes, for consistency). Until OD-11 is decided, the plan does not assume it. Admission per R-17 (`409 member_busy` / `void_in_progress`). |
| `GET /voids?status=needs_owner\|escalated` | Needs-attention list |
| `POST /voids/{id}/retry` | A void with a saved plan: forward-only retry of that plan (never recomputed). A `requested` void (no plan, nothing sent): re-runs admission (R-17 V-a–V-c). Refused with `410 member_erased` once the member is erased |
| `POST /voids/{id}/settle` | **SU**. A `correction` adjustment linked to the void; the block stays until reconciliation verifies every effect (FR-063) |
| `POST /adjustments` | **SU**. Classification ∈ `bonus`/`gift`/`service_recovery`/`correction`, a reason and a stable id. `migration` is **refused** here (`409 migration_classification_reserved`): it is posted only by the paper-migration workflow with its device, acceptance, attestation, window and uniqueness checks (FR-070–FR-074). `bonus`/`gift` are **RO✗**. Needs the member's admission slot (`409 member_busy` / `member_frozen`, R-07). Stamp adjustments keep the balance in [0, t) and never use `stamp-` ids. Never linked to a purchase as an amount correction (FR-065, FR-173). Refused while a void is in progress. |

## Customers, reports, alerts

| Method & path | Rules |
| --- | --- |
| `POST /customers/search` with body `{first_name_prefix, last3}` | Search terms are personal data, so they travel in the body, never the URL; the response is `no-store`. Only the first-name prefix plus last 3 digits search (PD-013 [0.10]). Returns first name, progress, last 3 digits and visit history with branch. No export endpoint exists (FR-006). |
| `GET /overview?branch_id=` | KPIs per FR-101: total customers, active 30d, visits (FR-159), rewards redeemed (captured redemptions), near-reward, inactive 30d, needs attention (alerts, voids needing the owner, unconfirmed captures). Plan, period end and stage (FR-094). |
| `GET /reports/visits?branch_id=&from=&to=` | Attribution per FR-162; branch totals add up to the café total |
| `GET /reports/repeat-rate` and `GET /reports/acquisition-cohorts` | FR-160/FR-161/FR-163. NOT YET MEASURABLE and INCONCLUSIVE labels. The cohort report is labelled separately. |
| `GET /alerts`, `POST /alerts/{id}/review` | FR-113: review is audited and changes no transaction |
