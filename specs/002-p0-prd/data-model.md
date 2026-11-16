# Data Model: [Product] P0

**Status**: Included in the P0 Planning Gate approved by the owner on 2026-11-12 (approval provenance and scope: plan.md, Approval reconciliation), subject to OD-01–OD-18 and all verification gates. This document defines our own layer. LIP engine and Cloud tables are reused unchanged; no migration here touches them. Planning approval does not authorize execution or implementation.

**Unapproved amendment present.** This file contains a "Proposed amendment (PD-046), not approved at Gate 2" block (2026-11-13). It is outside every approval recorded above.

## 1. Stores, schemas and roles

| Store | Owner | Holds | Isolation |
| --- | --- | --- | --- |
| LIP engine tables (`lip_engine_*`, `members`, `ledger`, `balance_lots`, `issued_rewards`, …) | upstream (`packages/storage-postgres`) | balances, ledger, lots, rewards, reservations, idempotency | existing FORCE RLS on `lip.tenant_id`, role `lip_tenant_runtime` |
| LIP Cloud tables (`lip_cloud_*`) | upstream (`apps/cloud`) | organizations, environments, keys, Cloud subscriptions | operator-only, no tenant RLS (unchanged) |
| schema `directory` | `apps/bff/src/directory` | **all personal data**: phone identities, customers, first names, consents, customer sessions/devices, OTP challenges | login role `lip_directory_app`; runtime roles below; product role has no grants |
| schema `bff` | `apps/bff` | cafés, branches, staff, devices, program settings, display text, purchases, claims, redemptions, voids, adjustments, migrations, alerts, audit, billing, SLO data | FORCE RLS on every tenant table |

Database roles (created by the BFF migrations; LOGIN roles get passwords from the secret store):

- `lip_bff_app` (LOGIN). Connects the product module. It is a member of the runtime roles and switches into one per transaction with `SET LOCAL ROLE`. Its own grants are migrations only (run by a separate `lip_bff_migrator` in production).
- `lip_bff_tenant_runtime` (NOLOGIN NOBYPASSRLS). Staff, owner and tenant operations. Policies use `bff.current_tenant()` = `NULLIF(current_setting('lip.tenant_id', true), '')`, the same GUC name as the engine.
- `lip_bff_customer_runtime` (NOLOGIN NOBYPASSRLS). Customer self-service reads. Policies use `bff.current_customer()` = `NULLIF(current_setting('lip.customer_id', true), '')::uuid` and are granted **SELECT only** on customer-visible tables.
- `lip_bff_auth_runtime` (NOLOGIN NOBYPASSRLS). Pre-tenant credential resolution. It has **no table grants**. It may only EXECUTE narrow `SECURITY DEFINER` functions (`bff.resolve_owner_session(hash)`, `bff.resolve_staff_session(hash)`, `bff.resolve_device(hash)`, `bff.resolve_invite(hash)`, `bff.resolve_enrollment(hash)`, `bff.resolve_branch_qr(hash)`), each returning only the principal ids and `tenant_id` for an exact hash match, or nothing.
- `lip_bff_sweeper_runtime` (NOLOGIN NOBYPASSRLS). No table grants; EXECUTE on `bff.due_work(kind, limit)` only, which returns (`tenant_id`, row id) pairs. Processing then happens under the tenant runtime (research R-15).
- `lip_bff_operator_runtime` (NOLOGIN NOBYPASSRLS). Super Admin operator endpoints, used only after the operator allowlist check (R-13). It has explicit `USING (true)` policies **only** on operator tables (billing, cafés, usage, SLO, operators), and every read is audited. Tenant data it needs (escalated voids, unconfirmed captures) is read through the tenant runtime with the café's scope set explicitly by the operator request, and audited.
- `bff_definer` (NOLOGIN NOBYPASSRLS). Owns the `SECURITY DEFINER` functions above. Hardening:
  - It has SELECT on exactly the columns those functions read, plus explicit `FOR SELECT TO bff_definer USING (true)` policies on **only** those credential and due-work tables (FORCE RLS still applies to every other role and table).
  - Each function sets `search_path = pg_catalog, bff, pg_temp` (temporary schema explicitly last), uses schema-qualified names everywhere, and uses no dynamic SQL.
  - `REVOKE EXECUTE … FROM PUBLIC` on every function; EXECUTE is granted only to the auth or sweeper runtime role. Schema `bff` is owned by the migrator role and `CREATE` on it is revoked from PUBLIC.
  - Tests cover both directions: each resolver returns the right principal for a valid hash across tenants (positive), returns nothing for a wrong hash, and no runtime role can call a function it was not granted or read the underlying tables (negative).
- `lip_directory_app` (LOGIN) with `lip_directory_runtime` (NOLOGIN NOBYPASSRLS). Directory policies use `lip.tenant_id` or `lip.customer_id`.

**Policy matrix (summary; the full per-table matrix is a task-2.2 deliverable and is tested table by table).**

| Role | Tenant tables (`bff`) | Customer-visible tables | Operator tables | Credential tables | Views |
| --- | --- | --- | --- | --- | --- |
| tenant runtime | SELECT/INSERT/UPDATE by `tenant_id = current_tenant()`; append-only tables INSERT/SELECT only | same tenant policy | none | through own tenant only | `security_invoker`, tenant policy applies |
| customer runtime | none | SELECT where `customer_id = current_customer()` | none | none | `security_invoker`, customer policy applies |
| auth runtime | none | none | none | EXECUTE resolver functions only | none |
| sweeper runtime | none | none | none | none | EXECUTE `due_work` only |
| operator runtime | none (uses tenant runtime with explicit scope, audited) | none | SELECT/INSERT, append-only where marked | none | none |

Rules:

- **Tenant scope.** Every tenant-owned table has `tenant_id text NOT NULL`, `ENABLE` and `FORCE ROW LEVEL SECURITY`, and a policy `USING (tenant_id = bff.current_tenant()) WITH CHECK (same)` for `lip_bff_tenant_runtime`. An unset GUC yields NULL, so no rows match and the query fails closed.
- **Where scope comes from.** GUCs are set only from the authenticated session or device (PD-014). A credential that names a tenant (for example a device-token prefix) only *selects* the RLS scope. The credential is valid only if its hash exists inside that scope, so a wrong tenant claim simply finds nothing.
- **Startup probe.** `assertBffIsolationEnforced` checks every table in this document for FORCE RLS and that the runtime roles cannot bypass it. Boot fails otherwise (R-23).
- **Append-only tables.** `bff.audit_log`, `bff.subscription_payments`, `bff.subscription_changes` and `directory.consents` are append-only. `UPDATE` and `DELETE` are revoked from runtime roles, and a trigger raises on attempts.
- **Money and points.** Money is `bigint` piasters with `currency text CHECK (currency = 'EGP')`. Points and stamps are `bigint`. There are no floats anywhere.
- **Time.** Timestamps are `timestamptz` (UTC). Cairo dates are derived with `AT TIME ZONE 'Africa/Cairo'` and never stored as a fixed offset.
- **Identifiers.** Use the column-specific types and the explicit integration formats, not one universal identifier type. The §2 keys explicitly declared `uuid` remain UUIDs, and their foreign-key references use the same type; `bff.current_customer()` continues to cast `lip.customer_id` to `uuid`. LIP member ids remain text `m` + 26 Crockford base32 characters with no hyphen (PD-008 A1 check (e)); the `p_`, `r_`, `adj_`, `mig_` and void identifiers keep the exact text formats in contracts/lip-integration.md, Identifier formats. `member_ops.admission_id` remains the explicitly specified fresh ULID. This corrects the blanket ULID summary; it does not select UUID versions, fill in unspecified column types or convert existing upstream identifiers. Those unspecified details remain blocked in execution-briefs.md, Identifier boundaries.

## 2. Schema `directory` (personal data)

| Table | Key columns | Constraints and indexes | Notes |
| --- | --- | --- | --- |
| `phone_identities` | `phone_identity_id uuid PK`, `phone_e164 text`, `phone_last3 text`, `verified_at`, `erased_at` | `phone_e164` UNIQUE where not erased; `CHECK (phone_e164 ~ '^\+20(10\|11\|12\|15)[0-9]{8}$')` | One row per verified phone. Shared by customer, owner and staff identities, which enables the FR-028 self-dealing comparison by id. Erasure nulls the phone. |
| `customers` | `customer_id uuid PK`, `phone_identity_id` FK, `first_name text`, `first_name_fold text`, `language ('ar'\|'en')`, `status ('active'\|'deleted')`, `created_at`, `deleted_at` | UNIQUE (`phone_identity_id`) where active; index (`first_name_fold`) | Universal account (PD-001). `first_name` length cap is OD-08. |
| `memberships` | `membership_id uuid PK`, `tenant_id`, `customer_id`, `member_id text`, `card_ref text`, `joined_branch_id`, `join_source ('branch_qr')`, `status ('active'\|'closed')`, `joined_at`, `closed_at` | UNIQUE (`tenant_id`, `customer_id`); UNIQUE (`tenant_id`, `member_id`); UNIQUE (`card_ref`) | RLS: tenant policy **or** `customer_id = current_customer()` (customer runtime, SELECT). One card per café. |
| `consents` | `consent_id`, `tenant_id`, `customer_id`, `purpose ('marketing')`, `status ('granted'\|'declined'\|'withdrawn')`, `policy_version`, `source`, `recorded_at` | append-only; index (`tenant_id`, `customer_id`, `recorded_at DESC`) | FR-005. The latest row is the current state. |
| `customer_sessions` | `session_hash bytea PK`, `customer_id`, `csrf_secret_hash`, `created_at`, `last_seen_at`, `expires_at`, `revoked_at` | index (`customer_id`) where not revoked | 90-day sliding window (PD-020). |
| `customer_devices` | `device_id uuid PK`, `customer_id`, `secret_ct bytea`, `secret_version int`, `prev_secret_ct`, `prev_valid_until`, `registered_at`, `revoked_at`, `label` | Partial index (`customer_id`) where not revoked. The 3-device limit is checked under `SELECT … FOR UPDATE` on `customers`. | Secrets are encrypted (AES-256-GCM), because the server must recompute MACs (R-11). |
| `code_counters` | (`device_id`, `card_ref`, `purpose ('member'\|'reward')`) PK, `last_counter bigint` | updated with `UPDATE … WHERE last_counter < $new` (single-use) | Replay scope per device, card and purpose (R-11). |
| `staff_people` | `staff_person_id uuid PK`, `tenant_id`, `phone_identity_id`, `first_name`, `erased_at` | tenant RLS | Staff names are personal data; `bff.staff_profiles` stores only `staff_person_id`. |
| `deletion_requests` | `request_id PK`, `customer_id`, `requested_at`, `status ('queued'\|'completed')`, `completed_at` | partial UNIQUE (`customer_id`) where queued | Durable record of a queued deletion (FR-008). |
| `otp_challenges` | `challenge_id uuid PK`, `phone_identity_id` or `pending_phone_e164`, `purpose`, `code_hmac bytea`, `attempts`, `expires_at`, `consumed_at`, `superseded_at`, `channel`, `created_at` | Partial UNIQUE (`phone_key`) where not consumed and not superseded (one active code per phone) | `purpose` ∈ customer_sign_in, customer_phone_change, customer_delete, owner_sign_in, owner_step_up, staff_phone_verify, invite_accept. `phone_key` covers phones that are not yet registered. |
| `rate_counters` | (`scope_kind`, `scope_hash`, `window_start`) PK, `count` | — | Per-phone, per-IP and per-device limits. Scope values are HMACs, never raw values. The per-phone 5-send limit is a rolling 60-minute window shared across WhatsApp, SMS and all purposes (PD-042), so a fixed `window_start` counter cannot enforce it exactly. Its storage shape, and what counts as one send (F-01), are pinned in a reviewed brief before T016. Per-IP and per-device counters (OD-05) stay fixed-window. |
| `otp_circuit` | `cairo_day date PK`, `sends`, `spend_minor`, `tripped_at` | — | Platform-wide circuit breaker (PD-004). |
| `operator_access_log` | `id`, `operator_subject`, `customer_id`, `reason text NOT NULL`, `fields`, `at` | append-only | FR-007 and FR-152. |

The directory service's public interface returns only what each caller is allowed to see:

- **Cashier:** first name.
- **Owner:** first name and `phone_last3` for the café's own members, and search by `first_name_fold` prefix plus `phone_last3` (PD-013 [0.10]).
- **Operator:** a reasoned read.
- **Others:** booleans such as `isSamePerson(phone_identity_id, customer_id)`.

The directory never returns a raw phone except to its own OTP sender.

**Erasure (FR-008, US10).**
- **PII-bearing fields and their fate.** `customers.first_name` and `first_name_fold` → NULL; `phone_identities.phone_e164` and `phone_last3` → NULL (unless the identity is still used by an active owner or staff identity, in which case only the customer link is removed); every `otp_challenges` row for that phone identity, and any with a matching `pending_phone_e164`, → deleted; `customer_sessions` and `customer_devices` → revoked, secrets deleted; `code_counters` → deleted; `consents` → kept (append-only legal record keyed by `customer_id`, no PII); `rate_counters` → kept until their window expires (keyed HMACs only); `operator_access_log` → kept (no PII beyond ids). Membership ids, member ids, `bff.purchases.customer_id` and LIP ledgers stay as pseudonymous records. LIP holds no PII, so no LIP call is needed ([VERIFY] no member attribute written by the BFF carries PII).
- **Coordination with joins and voids (durable, no advisory locks).**
  - **Join fence (directory).** A deletion request inserts `deletion_requests` (`queued`) under `customers … FOR UPDATE`. Joining a café takes the same row lock and is refused while a request is queued, so no membership can appear while the worker enumerates them.
  - **Void fence (bff).** Every membership has a mirror row `bff.members (tenant_id, member_id, erasure_state)`. Admitting any member operation (R-07 slot) takes `FOR UPDATE` on that row and is refused with retryable `member_busy` while `erasure_state = 'erasing'`. The erasure worker, in one bff transaction, takes `FOR UPDATE` on all the customer's member rows (ordered by `member_id`), verifies that none of those members has a `member_blocks` row, a `member_ops` slot of kind `void`, or a **`void_operations` row in a non-terminal state**, and sets `erasing`. The terminal void states are `completed` and `refused_unavailable`; every other state counts as unfinished, including `requested` (which can exist with neither a slot nor a block after a reclaim), `needs_owner`, `escalated` and `blocked_needs_owner`. If any exists the request stays `queued` (FR-008), and the wait is audited and visible to the operator. V-a inserts the `requested` row under the same `bff.members` lock, so a void request and the erasure check never interleave. Once a member is `erased`, any new admission, including a void, is refused with the final error `410 member_erased` (not retryable, audited). The row locks make void admission and the erasure check mutually exclusive without relying on any connection-scoped lock.
  - Then the directory erasure transaction runs, and finally the bff rows are set `erased` (memberships closed). A crash resumes from `deletion_requests` and `erasure_state`. After erasure, the ledger and purchases remain pseudonymous; erasure does not wait for, or affect, non-void operations.

## 3. Schema `bff` — platform and operator tables

| Table | Key columns | Notes |
| --- | --- | --- |
| `cafes` | `tenant_id PK`, `environment_id`, `program_id`, `lip_api_key_ct bytea`, `lip_api_key_version`, `provisioning_step ('created'\|'ready'\|'credential_issued'\|'credential_stored'\|'provisioned')`, `main_language`, `is_test_cafe bool`, `status`, `created_at` | One row per café. Operator runtime has full read; tenant runtime has its own row only. Provisioning resumes from `provisioning_step` (R-02). |
| `operators` | (`issuer`, `subject`) PK, `status`, `added_by`, `added_at`, `revoked_at` | Super Admin authorization allowlist (R-13). Changes audited. |
| `operator_idempotency` | (`operator_subject`, `key`) PK, `request_sha256`, `response jsonb`, `created_at` | Idempotency for operator calls. |
| `owner_accounts` | `owner_id PK`, `tenant_id UNIQUE`, `phone_identity_id`, `status`, `created_at` | One owner per café (PD-014). The auth runtime looks rows up by `phone_identity_id`. |
| `owner_sessions` | `session_hash PK`, `owner_id`, `tenant_id`, `csrf_secret_hash`, `expires_at`, `revoked_at` | 30-day sliding window (PD-010). |
| `owner_invites` | `invite_hash PK`, `tenant_id`, `phone_identity_id`, `expires_at`, `used_at`, `created_by` | Single-use, 72 h (PD-011, FR-015). |
| `step_up_grants` | `grant_id PK`, `owner_id`, `tenant_id`, `action`, `target_ref`, `expires_at`, `used_at` | Consumed with `UPDATE … WHERE used_at IS NULL AND expires_at > now()` inside the action's transaction. |
| `plans` | `plan_id PK`, `names`, `limits jsonb` (customers, branches, messages) | Values come from task 1.6. |
| `subscriptions` | `tenant_id PK`, `plan_id`, `period_end_date date` | The stage is computed on read (R-19). Changes are written with `subscription_changes`. |
| `subscription_changes` | `change_id`, `tenant_id`, `actor`, `before jsonb`, `after jsonb`, `at` | Append-only (FR-091). |
| `subscription_payments` | `payment_id PK` (operator-supplied stable id), `tenant_id`, `amount_minor bigint CHECK (> 0)`, `currency`, `method`, `reference`, `paid_on date`, `recorded_by`, `reverses_payment_id` NULL, `recorded_at` | Append-only. A reversal is a new row referencing the original, UNIQUE (`reverses_payment_id`). A double submit with the same id and the same body returns the original; a different body is a conflict (FR-090). |
| `stage_transitions` | `tenant_id`, `cairo_day`, `from_stage`, `to_stage` | Audit only, written by the daily sweeper. |
| `slo_minutes` | (`operation`, `minute_utc`) PK, `outcome ('success'\|'failure')`, `latency_ms`, `error_code`, `source` | Imported probe results. A missing row is a gap. |
| `slo_outages` | `outage_id`, `operation`, `start_at`, `end_at`, `affected_tenants`, `recovery_notes`, `reviewed_at` | FR-155. |

## 4. Schema `bff` — tenant tables (FORCE RLS)

### Café setup

| Table | Key columns | Constraints / indexes |
| --- | --- | --- |
| `branches` | `branch_id PK`, `tenant_id`, `lip_location_id`, `status ('active'\|'inactive')`, `deactivated_at` | index (`tenant_id`, `status`) |
| `branch_names` | (`tenant_id`, `branch_id`, `lang`) PK, `name` | main-language row required (application check plus deferred constraint trigger) |
| `branch_hours` | `tenant_id`, `branch_id`, `weekday 0–6`, `opens time`, `closes time` | `closes < opens` means overnight; no row means closed; several intervals per day are allowed |
| `branch_qr` | `qr_id PK`, `tenant_id`, `branch_id`, `token_hash`, `version`, `active bool`, `rotated_at` | partial UNIQUE (`branch_id`) where active; UNIQUE (`token_hash`). Rotation deactivates the old row and inserts a new one in one transaction (FR-032). |
| `program_settings` | `tenant_id PK`, `program_id`, `type ('stamps'\|'points')`, `threshold`, `first_published_at`, `first_purchase_at`, `published_revision`, `min_eligible_spend_minor ≥ 1`, `large_bill_threshold_minor`, `amount_label`, `reward_expiry_days 7–90`, `point_expiry ('never'\|180\|365\|545\|730)`, `expiry_mode_locked bool` | `type` and `threshold` are immutable after `first_published_at` (trigger); expiry mode is locked after the first purchase (PD-020) |
| `reward_catalog` | `reward_id PK`, `tenant_id`, `kind ('stamp'\|'points')`, `cost bigint > 0`, `active bool`, `lip_revision` | Partial unique ensures one stamp reward; at most 5 active points rewards, checked under the program-settings row lock |
| `reward_text_versions` | (`tenant_id`, `reward_id`, `lang`, `version`) PK, `name`, `description`, `valid_from` | Append-only; the current text is the latest version. Editable without a LIP republish (FR-047); issuance snapshots use the version in force at issuance (R-16). |
| `program_texts` | (`tenant_id`, `lang`) PK, `program_name` | Main-language row required (FR-131) |

### Merchant branding — proposed amendment (PD-046)

**Proposed amendment (PD-046), not approved at Gate 2.** Drafted 2026-11-13 in the autonomous session under owner delegation. It authorizes nothing, closes no gate (`branding-contracts` stays open) and follows MB-01–MB-05, PD-005 A5, U-1–U-6 and corrections A–C (owner-approved 2026-11-14; decisions only, this draft itself stays UNAPPROVED; design in [gate2-branding-revision.md](gate2-branding-revision.md)). No Sol review has run.

| Table | Key columns | Constraints / indexes |
| --- | --- | --- |
| `brand_palettes` | `tenant_id PK`, `primary_hex`, `secondary_hex`, `accent_hex` (all three `text NULL`), `version int NOT NULL ≥ 0`, `updated_by` (owner user id), `updated_at timestamptz` | CHECK each hex `~ '^#[0-9A-F]{6}$'` when not null; CHECK all three null or all three not null. FORCE RLS on `lip.tenant_id` like every §4 table. No row, or all three null, means the platform default (FR-135). The row is never deleted: a reset sets the three to null and increments `version`, so `version` never repeats and a stale write cannot match after a reset. Not personal data. |

- **Transaction:** an owner update or reset first inserts the row when absent, with null colours and `version` 0 (`ON CONFLICT DO NOTHING`), so a merchant with no row compares against 0, the value `GET /branding` returns. It then locks the row (`SELECT … FOR UPDATE`), compares `expected_version`, writes, increments `version` and writes the `audit_log` row (before and after values) in the same transaction (FR-150).
- **Success cap (U-6 approved; design proposed, package §3.2):** after the row lock and the version check, the transaction counts the merchant's `audit_log` rows with operation `branding.update` or `branding.reset` in the last 60 minutes of database time, using the existing (`tenant_id`, `at`) index. At 10 it rolls back with `429`. The row lock serializes every save for the merchant, so the check and the write cannot interleave.
- **Owner attempt limiter (U-2 approved; design proposed, package §3.1):**

| Table | Key columns | Constraints / notes |
| --- | --- | --- |
| `owner_mutation_limits` (platform table, schema `bff`) | (`owner_id` FK `owner_accounts` ON DELETE CASCADE, `action`) PK, `recent_at timestamptz[] NOT NULL DEFAULT '{}'`, `updated_at` | No tenant column: keyed by the owner account so that session, device or merchant context cannot reset it. No runtime role has table grants. Access only through `bff.consume_owner_attempt(owner_id, action, limit, window)`: `SECURITY DEFINER` owned by `bff_definer`, EXECUTE for `lip_bff_tenant_runtime` only. It raises unless the owner owns `lip.tenant_id`. It locks the row (`INSERT … ON CONFLICT DO NOTHING`, `SELECT … FOR UPDATE`), prunes entries older than the window and either refuses with the retry time or appends the database time. It runs in its own short transaction, committed before the mutation, so it holds at most `limit` entries and needs no sweeper. No PII. |

- **Reads (correction C):** customer reads resolve the palette from the merchant of the validated membership, Branch QR credential, claim or pending migration. The client may send those identifiers but never a palette, tenant or authorization claim (FR-138, PD-014). The read grant path for the customer runtime and the pre-sign-in Branch QR is design item D-5.
- **Erasure:** unaffected; the table holds no customer data.
- **Migration:** additive and idempotent (`CREATE TABLE IF NOT EXISTS`, policies, function and grants created once) under the FP-001-preserving migrator; it creates both tables and the limiter function. No backfill: absence means the default and an empty limit. Rollback: drop the tables and function only if no release reads them; otherwise forward-fix.

### Staff, devices and sessions

| Table | Key columns | Constraints / indexes |
| --- | --- | --- |
| `staff_profiles` | `staff_id PK`, `tenant_id`, `staff_person_id` (directory reference; no name stored here), `phone_identity_id`, `home_branch_id` NULL for the owner profile, `is_owner_profile bool`, `owner_id` NULL, `pin_hash` NULL until set, `pin_salt`, `pin_failures`, `locked_at`, `status`, `language` | partial UNIQUE (`tenant_id`) where `is_owner_profile` (exactly one, PD-038 P1); UNIQUE (`tenant_id`, `phone_identity_id`) where active |
| `pin_setup_codes` | `code_hash PK`, `tenant_id`, `staff_id`, `expires_at`, `used_at`, `created_by`, `step_up_grant_id` | Single-use; used for first PIN, reset and unlock (R-12) |
| `devices` | `device_id PK`, `tenant_id`, `branch_id`, `token_hash UNIQUE`, `label`, `registered_by`, `registered_at`, `revoked_at` | — |
| `device_enrollments` | `code_hash PK`, `tenant_id`, `branch_id`, `expires_at`, `used_at`, `created_by` | — |
| `staff_sessions` | `session_hash PK`, `tenant_id`, `staff_id`, `device_id`, `expires_at`, `idle_expires_at`, `revoked_at` | Refused at use if the device is revoked, the branch is inactive or the staff member is inactive (FR-081, FR-086) |

### Counter operations

| Table | Key columns | Constraints / indexes |
| --- | --- | --- |
| `capture_sessions` | `capture_id PK`, `tenant_id`, `branch_id`, `staff_id`, `device_id`, `membership_id`, `member_id`, `customer_id`, `method ('staff_scan'\|'claim')`, `claim_id`, `order_id UNIQUE`, `amount_minor`, `repeat_confirmed bool`, `status ('open'\|'confirming'\|'confirmed'\|'unconfirmed'\|'failed'\|'abandoned')`, **pre-accrual snapshot** (`snap_balance_before`, `snap_reward_marker`, `snap_threshold`, `snap_program_revision`, `snap_min_eligible_spend`, `snap_text_versions jsonb`, `snap_at`), `created_at`, `last_action_at` | `amount_minor` and the snapshot are set once, after slot admission and in the same transaction as the accrual intent (R-14); session lifetime and supersession are OD-13 |
| `purchases` | `purchase_id PK` (= `capture_id`), `tenant_id`, `order_id UNIQUE`, `member_id`, `customer_id`, `branch_id`, `staff_id`, `device_id`, `acting_owner_id`, `owner_self_award bool`, `method`, `amount_minor`, `captured_at` (server), `unit`, `accrual_entry_id`, `accrual_amount`, `reward_marker`, `balance_before`, `balance_after`, `threshold`, `program_revision`, `min_eligible_spend_at_capture`, `text_versions jsonb`, `is_test bool`, `void_id`, `recapture_of_void_id` | indexes: (`tenant_id`, `member_id`, `captured_at`); (`tenant_id`, `captured_at`); (`tenant_id`, `branch_id`, `captured_at`); RLS adds a customer SELECT policy. Written in the same transaction that records the confirmed accrual, copying the snapshot. |
| `pending_claims` | `claim_id PK`, `tenant_id`, `branch_id`, `membership_id`, `claim_number`, `check_hash` (per OD-12), `wrong_attempts 0–3`, `status ('open'\|'confirmed'\|'cancelled'\|'expired')`, `expires_at`, `created_at` | partial UNIQUE (`branch_id`, `claim_number`) where open; partial UNIQUE (`branch_id`, `membership_id`) where open |
| `issued_reward_terms` | `issued_reward_id PK`, `tenant_id`, `member_id`, `reward_id`, `reward_ref UNIQUE` (random, shown in reward codes), `terms jsonb` (names, descriptions, cost from the issuance-time text versions), `issued_at`, `expires_at` | Immutable snapshot (FR-046); written with the confirmed accrual or by the materialization sweeper (R-16) |
| `redemptions` | `redemption_id PK`, `tenant_id`, `order_id`, `member_id`, `customer_id`, `reward_id`, `issued_reward_id`, `reservation_id`, `held_terms jsonb` (actual LIP reservation response: cost, effect, expiry, revision), `status ('holding'\|'held'\|'capturing'\|'capture_failed'\|'captured'\|'releasing'\|'released'\|'release_pending'\|'expired')`, `held_at`, `release_after`, `branch_id`, `staff_id`, `device_id` | partial UNIQUE (`tenant_id`, `order_id`) where status not in (released, expired) (FR-052); "rewards redeemed" counts `captured` rows (FR-103) |

### Voids, adjustments, migrations and journal

| Table | Key columns | Constraints / indexes |
| --- | --- | --- |
| `void_operations` | `void_id PK`, `tenant_id`, `purchase_id UNIQUE` (one void per purchase), `member_id`, `unit`, `requested_by`, `authority ('cashier_self'\|'owner')`, `status`, `plan jsonb`, `evidence jsonb`, `planned_at`, `needs_owner_at`, `escalated_at`, `completed_at` | — |
| `member_blocks` | (`tenant_id`, `member_id`) PK, `void_id` | A row exists only while a void is unreconciled. It is inserted in the transaction that commits the void plan and deletes the void's `member_ops` slot (R-17 V-c), and deleted only in the transaction that marks the void `completed` after reconciliation. |
| `manual_adjustments` | `adjustment_id PK`, `tenant_id`, `member_id`, `classification`, `unit`, `amount`, `reason NOT NULL`, `owner_id`, `step_up_grant_id`, `settles_void_id` NULL, `paper_migration_id` NULL, `status` | `CHECK (classification <> 'migration' OR paper_migration_id IS NOT NULL)`: a `migration` adjustment exists only as the posting of a `paper_migrations` row |
| `paper_migrations` | `migration_id PK`, `tenant_id`, `member_id`, `stamps`, `status ('pending'\|'accepted'\|'declined'\|'expired'\|'posted'\|'refused')`, `owner_id`, `device_id`, `branch_id`, `reference`, `customer_accepted_at`, `owner_attested_at`, `expires_at`, `balance_before`, `balance_after`, `outcome_reason` | partial UNIQUE (`tenant_id`, `member_id`) where status in (pending, accepted); partial UNIQUE (`tenant_id`, `member_id`) where posted (FR-070, FR-072) |
| `lip_calls` | `call_id PK`, `tenant_id`, `member_id`, `workflow_ref` (void, capture, redemption, adjustment, migration…), `step_no`, `operation`, `business_id`, `idempotency_key UNIQUE`, `request_body jsonb`, `request_sha256`, `status ('intent'\|'dispatched'\|'confirmed'\|'failed_definite'\|'uncertain'\|'abandoned')`, `admission_id` (the admission that created the intent), `lease_owner`, `lease_generation`, `lease_until`, `not_after` (only under OD-15 A), `response jsonb`, `attempts`, `next_attempt_at` | UNIQUE (`workflow_ref`, `step_no`); recovery index (`lease_until`, `next_attempt_at`) where status in (intent, dispatched, uncertain) — a stable predicate; the time cut-off is applied in the recovery query, not the index. Dispatch/worker authority re-checks its lease. Attempt replies are always recorded on their own attempt row, including late replies. Per the detailed approved R-07 step 3, the call-status transition uses the nonterminal-status guard, not the lease generation; a late original reply must not be discarded merely because a new lease exists. Only R-07 step 4 definitive evidence ends a call, and its outcome/domain effect commit atomically; terminal states never regress. Slot deletion is by the intent's exact admission_id (§6). See execution-briefs.md, Journal outcome guards. `abandoned` only for an `intent` never marked `dispatched`. |
| `member_ops` | (`tenant_id`, `member_id`) PK, `op_ref`, `kind ('accrual'\|'reserve'\|'capture'\|'release'\|'adjustment'\|'migration'\|'settlement'\|'void')`, `status ('admitting'\|'active')`, `admission_id` (ULID, UNIQUE, fresh per successful admission), `lease_until`, `admitted_at` | The durable admission slot (R-07): inserted `admitting` in its own transaction with a fresh `admission_id`, made `active` with the first intent after the pre-call reads (1c and V-c verify the exact `admission_id` and `admitting` under the same `bff.members` lock the sweeper's reclaim takes; `op_ref` alone is not checked, because re-admission reuses it). Every delete of the slot (1c failure, reclaim, terminal outcome) is conditioned on the `admission_id`. The lease covers the 1b read timeouts plus a margin; deleted with the terminal outcome; an `admitting` slot with no intent after its lease is reclaimed by the sweeper. A void is admitted with a slot of kind `void`, handed over to its `member_blocks` row in the transaction that commits the plan (R-17); admission checks both tables in one transaction under `FOR UPDATE` on `bff.members`, which serializes all admissions for the member (no write skew between a void block and another slot). |
| `lip_call_attempts` | (`call_id`, `attempt_no`) PK, `sent_at`, `outcome ('pending'\|'success'\|'refused'\|'no_answer')`, `response jsonb` | Every dispatch is recorded; a late answer is never discarded (R-07 step 3) |
| `members` | (`tenant_id`, `member_id`) PK, `membership_id`, `erasure_state ('none'\|'erasing'\|'erased')` | Mirror row per membership; the erasure fence (§2) |

### Fraud, audit and idempotency

| Table | Key columns | Constraints / indexes |
| --- | --- | --- |
| `fraud_alerts` | `alert_id PK`, `tenant_id`, `rule`, `subject_key`, `branch_id`, `staff_id`, `window_start`, `window_end`, `linked_refs jsonb`, `status ('open'\|'reviewed')`, `reviewed_by`, `reviewed_at` | Dedupe per R-21 under an advisory lock on (`tenant`, `rule`, `subject`) |
| `audit_log` | `audit_id PK`, `tenant_id`, `at`, `actor_kind ('owner'\|'staff'\|'system'\|'operator'\|'customer')`, `actor_id`, `owner_id`, `staff_id`, `branch_id`, `device_id`, `operation`, `target_ref`, `before jsonb`, `after jsonb`, `reason`, `request_id`, `override bool` | Append-only. Indexed (`tenant_id`, `at`). Never holds a phone, name, code or token (FR-150). |
| `api_idempotency` | (`tenant_id`, `actor_id`, `key`) PK, `request_sha256`, `status`, `response jsonb`, `created_at` | Ordinary tenant RLS policy. Same key with a different body is `idempotency_conflict`. Retained 7 days (technical value). Pre-sign-in endpoints take no `Idempotency-Key`; operator calls use `operator_idempotency`. |

## 5. State machines

- **Capture session.** `open → confirming → confirmed`. Other transitions:
  - `open → abandoned` per OD-13 (lifetime and same-device supersession; never a session on another device).
  - `confirming → failed` only on a definite engine refusal.
  - `confirming → unconfirmed` when an uncertain accrual has no response after a short wait. The accrual is **never re-sent**, by the cashier or any sweeper (PD-003, PD-038 P8, FR-069). Re-submitting the confirm to the BFF only returns the current state. The capture is shown as needing attention; only authoritative ledger evidence, available once V4 is verified, may resolve it; cashier and owner handling is OD-10.
- **Pending claim.** `open → confirmed`. Also:
  - `open → cancelled` after 3 wrong attempts attributed to that claim (attribution per OD-12) or a branch deactivation.
  - `open → expired` at 15 minutes.

  Rotating the Branch QR does not touch open claims (FR-032).
- **Redemption.** `holding → held → capturing → captured`. Also:
  - `held → releasing → released`, through the 120-second sweeper (only while no capture intent exists; boundary per OD-16), a cashier cancel, or branch deactivation.
  - `capturing → capture_failed → releasing → released`, when the original capture is definitely refused (for example `insufficient_balance`); released at once, without the timer.
  - `holding → release_pending → releasing → released`, when branch deactivation finds a reserve still in flight: the reserve is resolved forward first.
  - `capturing` is never released by a timer; an uncertain capture is re-sent with the same key and body until a re-send succeeds or the original is fenced (R-07 steps 4–6, OD-15); a refused re-send does not end it.
  - A step answered `expired` by LIP → `expired` (terminal; backstop only, R-16) when that answer ends the call (R-07 step 4). An `expired` answer to a re-send while another attempt is still unanswered ends the call only after S-2 has verified the conditional outcome in R-07 step 4; until then the redemption stays `capturing`/`releasing` and the member stays held (fail closed).
  - Capture and release are steps of one workflow (`workflow_ref` = redemption), so only one of them is ever dispatched first.
- **Void (stamps).** `requested → planned → executing → reconciling → completed`. Also:
  - `requested` is the admission phase: a `member_ops` slot of kind `void` is held, with no plan, no block and nothing sent (R-17 V-a/V-b). A crash or a reclaim there leaves the void `requested` with no slot. The sweeper re-admits it automatically during the first 15 minutes; a repeated request or the owner's retry re-runs admission at any time. A `requested` void still blocks account erasure (§2).
  - `requested → blocked_needs_owner` (reason `branch_inactive`) when the branch of a device-started void is inactive at V-c or at a re-admission.
  - Anything not completed (including `requested`) becomes `needs_owner` at 15 minutes and `escalated` at 24 hours.
  - A failed precondition goes to `blocked_needs_owner` without a plan, so no member block is created and the slot is released.
  - The member block exists from `planned` until `completed`.
- **Void (points).** The same states, but while `points_void_execution` is off the request ends at `refused_unavailable` before admission. When enabled after the FP-003 gates, it is the same as stamps, with FR-069 evidence states (`evidence_verified_positive`, `evidence_verified_zero`, `evidence_uncertain`) recorded in `evidence`.
- **Paper migration.** `pending → accepted → posted`. Also:
  - `pending → declined` or `expired`.
  - `accepted → expired`, if the 15 minutes pass before attestation.
  - `accepted → refused`, if the atomic re-check fails at posting.
- **Subscription stage.** Computed from `period_end_date` and the current Cairo date; there is no stored state machine.

## 6. Transaction boundaries (summary)

| Operation | Transaction 1 (commit before LIP) | LIP calls (member slot held) | Transaction 2 (after LIP) |
| --- | --- | --- | --- |
| Scan → capture session | consume code (`code_counters`), create session | `orders/evaluate` (read-only, no journal) | — |
| Confirm award | (1a) branch row `FOR SHARE` + active checks (early refusal only), then `bff.members` `FOR UPDATE` and admit slot `admitting` — commit; (1b) pre-accrual reads from LIP (`accounts/get`, `issued-rewards/list`), no transaction open; (1c) branch row `FOR SHARE` + branch, device and session checks **repeated** (the binding R-16a check), `bff.members` `FOR UPDATE`, verify the exact `admission_id` from 1a and `admitting` (else delete the slot only by that token, commit nothing, send nothing); store snapshot, session → confirming, `lip_calls` intent, slot → `active` — commit | `accruals`; then `issued-rewards/list` | one transaction: call → confirmed; insert `purchases` (from snapshot + result); `issued_reward_terms` for newly issued rewards found by the list read; session → confirmed; release slot; audit; mark the `first_purchase_at` lock |
| Redemption hold / capture / release | one transaction (no pre-call read, so 1a and 1c coincide): branch row `FOR SHARE` + active checks (system cleanup exempt, R-16a); `bff.members` `FOR UPDATE`; admit slot directly `active`; `redemptions` row + `lip_calls` intent (next `step_no`) | `redemptions/reserve` \| `capture` \| `reverse` | one transaction: call outcome + redemption status (+ `held_terms` from the reserve response); release slot; audit |
| Stamp void | (V-a) branch row `FOR SHARE` + active checks if device-started; `bff.members` `FOR UPDATE`; refuse if any `member_ops` slot, `member_blocks` row or non-terminal redemption exists; insert `member_ops` slot kind `void` (`admitting`) and void `requested` — commit; (V-b) precondition reads from LIP, no transaction open; (V-c) same locks, checks repeated, exact `admission_id` verified (else abort, nothing committed), then either `blocked_needs_owner` + delete slot (precondition failed, or branch now inactive), or `void_operations` plan + all step intents + insert `member_blocks` + delete the slot (R-17) | cancel(s) → adjust → restore, in `step_no` order | per step, one transaction: call outcome + void progress; then reconcile: read `issued-rewards/list` and `ledger/list`, then in one transaction: void → completed, delete block, purchase.void_id, audit |
| Owner adjustment | (1a) `bff.members` `FOR UPDATE`, admit slot — commit; (1b) balance read for the stamp [0, t) check, no transaction open; (1c) `bff.members` `FOR UPDATE`, verify the exact `admission_id`; consume step-up grant; `manual_adjustments` + intent (`migration` refused here) | `ledger/manual-adjustments` | one transaction: outcome + status; release slot; audit |
| Paper migration posting | (1a) branch row `FOR SHARE` + active checks, `bff.members` `FOR UPDATE`, admit slot — commit; (1b) balance re-check read from LIP, no transaction open; (1c) same locks with the branch checks repeated, verify the exact `admission_id`; re-check window, stage, limit, balance (from 1b) and block; intent | `ledger/manual-adjustments` (`migration`) | one transaction: outcome + posted; audit |
| Branch deactivation | branch row `FOR UPDATE` → inactive; revoke devices and sessions; QR inactive; claims cancelled; enqueue a release for each hold with **no** capture intent and each in-flight reserve (`release_pending`); holds with a capture intent resolve forward (R-16a) | `redemptions/reverse` per hold (journaled), after any in-flight reserve resolves | per hold, one transaction: outcome + status |
| Account deletion | `deletion_requests` row (queued) under the customer row lock (join fence) | — | bff: member rows `FOR UPDATE` in ascending `member_id`; verify no `member_blocks` row, no `member_ops` slot of kind `void` and no non-terminal `void_operations` row (else stay `queued`, audited); set `erasing`; directory erasure transaction; bff: `erased`; audit (§2) |

Every LIP write is journaled before the call, its outcome and domain effect are recorded in one transaction, and it is recovered forward-only (R-07). No database transaction is ever held open across a LIP call, including pre-call reads (R-07 steps 1a–1c).

**Global lock order.** Every transaction that takes more than one of these locks takes them in this order: (1) `bff.branches` row; (2) `bff.members` rows, ascending `member_id`; (3) `member_ops` / `member_blocks`; (4) everything else. Branch deactivation's transaction takes only the branch row and the rows it changes directly (devices, sessions, QR, claims), and enqueues hold releases; it never admits a member slot. Erasure takes only `bff.members` rows (no branch lock).
