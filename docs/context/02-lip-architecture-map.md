# Architecture map — our product on top of LIP

## Layering (target)

```text
   apps/web — one Next.js app (AR/EN), three surfaces by subdomain:
   app. (customer PWA)   staff. (cashier PWA)   dashboard. (owner)
            │
   apps/bff — Product BFF / API (ours, TypeScript, long-running service)
                 • customer OTP session → platform customer → member_id
                 • rotating member QR tokens, branch QR claims, pending queue
                 • staff "bill amount" → synthetic FoodserviceOrder
                 • automation rules, WhatsApp/SMS/push providers, consent, caps
                 • plan-limit monitoring: authoritative customer/branch counts;
                   no enforcement in P0, Cloud usage events never in the
                   join/award/redeem success path (PD-035)
                 • visit analytics: Cairo-day visits, first-purchase branch
                   attribution (PD-032); award/redeem SLO checks (PD-033)
                 • product permissions for every role; tenant/branch from
                   session or device (PD-014)
                 • owner OTP sessions, owner invites; Super Admin via OIDC+MFA
                   (PD-010, PD-011)
                 • void operation: saved plan, per-member lock, stamp restore
                   (PD-008 A1)
                 • subscription stage engine (grace / read-only / suspended)
                   (PD-005 A2)
                 • paper-card migrations: pending → customer accepts →
                   `migration` adjustment (PD-021, PD-022)
                 • reward display text + issued-reward/reservation snapshots;
                   branch status and opening hours; fraud alerts
                   (PD-024 – PD-027)
                 │ merchant API key (server-side only)
                 ▼
     LIP runtime (this repo)  /lip/v1  +  /platform/v1  +  /admin/api/v1
                 │
                 ▼
     Postgres (tenant-scoped tables, FORCE RLS on lip.tenant_id)
```

Hosting (PD-006, round 1): LIP runtime (1 instance), BFF and web are three
separate services per environment on one container host in Frankfurt, behind
Cloudflare. Personal data lives only in the platform customer directory (own
schema + DB role) so it alone could move to an Egyptian host.

Super-admin / plans / subscriptions / provisioning: LIP Cloud `/cloud/v1`
(`apps/cloud`). Billing at launch is manual (`billing_provider: "manual"`,
PD-005 A1); Kashier is deferred; Stripe stays unused.

## Module → LIP mapping

| Our module (brief) | LIP construct | Where | Fit |
| --- | --- | --- | --- |
| Tenant management | tenant (`tenant_id`); Cloud organizations/projects/environments | `access-control.ts`, `apps/cloud/src/service.ts` | Good |
| Branch management | Location registry + location-scoped principals + per-location reports | `locations.ts`, `location-reports.ts` | Good — locations have an `active` flag; branch deactivation, opening hours and their enforcement live in the BFF (PD-026) |
| Staff & permissions | Tenant users & API keys, roles `owner/admin/operator/developer/viewer/integration`, `allowed_location_ids` | `access-control.ts` | Partial — no cashier role, no staff login UX. `/lip/v1` checks only the permission (`protocol:write` covers every write) and does not enforce `allowed_location_ids`, so the BFF enforces all product permissions (PD-014); the cashier fork patch is optional |
| Customer management | Profiles, consent, events, CSV import | `customer-data.ts` (`/platform/v1/members`, `/events`, `/imports/members`) | Partial — JSON-blob storage, see G-11 |
| Universal customer account (PD-001) | Customer identity: `{tenant, issuer, subject}` → `crv_cus_*` → `member_id` | `packages/identity`, `apps/cloud/src/customer-*.ts` | Gap — per-tenant, not platform-wide |
| Loyalty engine — stamps | `visit_stamp_policy` (threshold, reset, auto-issue reward) | `reference/src/config.ts`, `engine.ts` | Good |
| Loyalty engine — points | `earn_rate`, `earning_policy` exclusions/min spend/channels | same | Good — except: `orders/adjust` void/refund converts the spend delta at the **current** earn rate (`engine.ts` 968–990), so a void after an earn-rate decrease under-claws (executed 2026-11-12). Fork patch FP-003 (design approved, not implemented, PD-037); already-expired points excluded and missing/uncertain accrual handled per PD-038 P7/P8 |
| Tiers | `tiers`, `tier_policy` (annual period, IANA tz), multipliers | same + `spec/account-experience.md` | Good |
| Expiry | `point_expiration` lots, FIFO consumption, warning days | engine | Good |
| Rewards / redemption | Catalog rewards, issued-reward wallet (code/QR), reserve/capture/reverse | `/lip/v1/redemptions/*`, `/issued-rewards/*` | Good — but a stamp-reward void needs our void operation (PD-008 A1: card resets are not reversed by `orders/adjust`); one reward per order and reservation timeouts are BFF rules (PD-015, PD-020); free-item redemptions write no ledger entry, so reports count reservations; up to 5 points rewards, with display text and snapshots kept in our layer (PD-024, PD-025) |
| Program configuration UI | Draft → validate → publish → rollback with audit | `program-management.ts`, Admin "Configure" | Good engine, wrong UX for café owners |
| Transactions | `orders/evaluate`, `accruals`, `orders/adjust`, ledger | `/lip/v1/*` | Good; needs a "bill amount" order builder |
| QR — staff scans customer | — | — | **Missing** (G-02) |
| QR — customer scans branch | — | — | **Missing** (G-03) |
| Customer web app | Reference guest wallet (OIDC/PKCE BFF, English, synthetic) | `apps/wallet` | Reference only (G-07) |
| Owner dashboard | Admin SPA (React/Vite, developer-oriented, English) | `apps/admin` | Reference only (G-08) |
| Segments | Static/dynamic rules: status, tier, balance, attributes, profile, event count within days | `campaigns.ts` | Partial — no "inactive N days", no birthday (G-09) |
| Campaigns | Scheduled reward campaigns, holdout %, attribution window, runs | `campaigns.ts` | Partial — reward issuance only, no trigger automation (G-09) |
| Notifications | Signed webhook messaging connector, retries, consent filter | `engagement.ts` | Partial — no WhatsApp/SMS/push, no caps/quiet hours (G-10) |
| Analytics | Liability, earned/redeemed/expired, campaign totals, location reports | `/platform/v1/analytics`, `/admin/api/v1/analytics` | Partial — no retention/cohort KPIs (G-13) |
| Subscription billing | Plans Free/Pro/Business, quotas, usage metering, `billing_provider: "manual"` (default) or Stripe | `apps/cloud/src/billing.ts`, `service.ts`, `types.ts` | Partial — manual provider exists, but no way to set plan/period, no payment records, nothing acts on period end (PD-005 A1). Kashier deferred. Our stage engine enforces PD-005 A2 in the BFF and never uses Cloud environment suspension or a non-active subscription status (both would block redemptions) |
| Audit logs | Tenant access audit, program audit, membership audit, location audit | various `*AuditEntry` | Good |
| Idempotency / anti-double-award | Spec-level guarantee + business-id protection | `spec/core.md`, `docs/idempotency.md` | Excellent |
| Tenant isolation | Postgres FORCE RLS via `lip.tenant_id` GUC, isolation tests | `storage-postgres/migrations/002`, `tests/unit/tenant-isolation-live.test.ts` | Excellent (engine tables) |

## Our earlier draft tables → LIP equivalents

Do **not** create these as new tables; map them.

| Draft table (brief) | Use instead |
| --- | --- |
| tenants / businesses | tenant + Cloud organization |
| branches | location registry |
| users / staff_members | tenant users / API keys; product roles enforced by the BFF (PD-014; LIP cashier role optional) |
| customers | platform customer (new, above tenants — PD-001) |
| customer_memberships | customer ↔ `member_id` link per (tenant, program) |
| loyalty_programs / loyalty_rules | `ProgramDefinition` revisions |
| transactions / transaction_items | `FoodserviceOrder` + accrual records |
| stamp_balances / point_transactions | balances + immutable ledger + lots |
| rewards / reward_redemptions | catalog rewards, issued rewards, reservations |
| campaigns / automation_rules | `RewardCampaign` + **new** automation rules |
| notification_logs | message jobs / deliveries |
| subscriptions | Cloud subscriptions |
| audit_logs | existing audit entries |

## Endpoints we will call from our BFF

`/lip/v1`: `members/lookup`, `members/enroll`, `accounts/get`, `programs/get`,
`orders/evaluate`, `accruals`, `orders/adjust`, `redemptions/reserve|capture|reverse`,
`issued-rewards/issue|list|cancel`, `ledger/list`, `ledger/manual-adjustments`.

`/platform/v1`: `members`, `events`, `imports/members`, `segments`,
`segments/preview`, `campaigns`, `campaigns/run|status|report`, `connectors`, `analytics`.
No personal data (name, phone, birthday) is written to `/platform/v1` member
records; the customer directory is the only store (PD-013).
