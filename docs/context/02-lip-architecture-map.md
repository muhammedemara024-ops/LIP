# Architecture map — our product on top of LIP

## Layering (target)

```text
 Customer web app (Next.js, AR/EN)   Staff/cashier app (PWA)   Owner dashboard (Next.js)
            │                                │                          │
            └────────────── Product BFF / API (ours, TypeScript) ───────┘
                 • customer OTP session → platform customer → member_id
                 • rotating member QR tokens, branch QR claims, pending queue
                 • staff "bill amount" → synthetic FoodserviceOrder
                 • automation rules, WhatsApp/SMS/push providers, consent, caps
                 • plan limits
                 │ merchant API key (server-side only)
                 ▼
     LIP runtime (this repo)  /lip/v1  +  /platform/v1  +  /admin/api/v1
                 │
                 ▼
     Postgres (tenant-scoped tables, FORCE RLS on lip.tenant_id)
```

Super-admin / plans / subscriptions / provisioning: LIP Cloud `/cloud/v1`
(`apps/cloud`). Billing at launch is manual (`billing_provider: "manual"`,
PD-005 A1); Kashier is deferred; Stripe stays unused.

## Module → LIP mapping

| Our module (brief) | LIP construct | Where | Fit |
| --- | --- | --- | --- |
| Tenant management | tenant (`tenant_id`); Cloud organizations/projects/environments | `access-control.ts`, `apps/cloud/src/service.ts` | Good |
| Branch management | Location registry + location-scoped principals + per-location reports | `locations.ts`, `location-reports.ts` | Good |
| Staff & permissions | Tenant users & API keys, roles `owner/admin/operator/developer/viewer/integration`, `allowed_location_ids` | `access-control.ts` | Partial — no cashier role, no staff login UX |
| Customer management | Profiles, consent, events, CSV import | `customer-data.ts` (`/platform/v1/members`, `/events`, `/imports/members`) | Partial — JSON-blob storage, see G-11 |
| Universal customer account (PD-001) | Customer identity: `{tenant, issuer, subject}` → `crv_cus_*` → `member_id` | `packages/identity`, `apps/cloud/src/customer-*.ts` | Gap — per-tenant, not platform-wide |
| Loyalty engine — stamps | `visit_stamp_policy` (threshold, reset, auto-issue reward) | `reference/src/config.ts`, `engine.ts` | Good |
| Loyalty engine — points | `earn_rate`, `earning_policy` exclusions/min spend/channels | same | Good |
| Tiers | `tiers`, `tier_policy` (annual period, IANA tz), multipliers | same + `spec/account-experience.md` | Good |
| Expiry | `point_expiration` lots, FIFO consumption, warning days | engine | Good |
| Rewards / redemption | Catalog rewards, issued-reward wallet (code/QR), reserve/capture/reverse | `/lip/v1/redemptions/*`, `/issued-rewards/*` | Good |
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
| Subscription billing | Plans Free/Pro/Business, quotas, usage metering, `billing_provider: "manual"` (default) or Stripe | `apps/cloud/src/billing.ts`, `service.ts`, `types.ts` | Partial — manual provider exists, but no way to set plan/period, no payment records, nothing acts on period end (PD-005 A1). Kashier deferred |
| Audit logs | Tenant access audit, program audit, membership audit, location audit | various `*AuditEntry` | Good |
| Idempotency / anti-double-award | Spec-level guarantee + business-id protection | `spec/core.md`, `docs/idempotency.md` | Excellent |
| Tenant isolation | Postgres FORCE RLS via `lip.tenant_id` GUC, isolation tests | `storage-postgres/migrations/002`, `tests/unit/tenant-isolation-live.test.ts` | Excellent (engine tables) |

## Our earlier draft tables → LIP equivalents

Do **not** create these as new tables; map them.

| Draft table (brief) | Use instead |
| --- | --- |
| tenants / businesses | tenant + Cloud organization |
| branches | location registry |
| users / staff_members | tenant users / API keys (+ new cashier role) |
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
