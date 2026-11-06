# Decision log

Status values: **Approved** (binding), **Proposed** (needs owner sign-off; do
not implement as if approved), **Superseded**.

---

## PD-001 — Universal customer account — Approved

One customer account on the platform (phone number + OTP). Inside it the customer
holds a separate loyalty card per business.

Rules:
1. Single sign-up by mobile number with OTP verification.
2. Customer joins any business by scanning its QR.
3. Each business has its own independent loyalty card.
4. Each business defines its own points/stamps and rewards.
5. Points and rewards are **not transferable** between businesses.
6. A business sees only the customers enrolled in its own program.
7. Marketing consent is per brand.
8. Account deletion must handle every membership per the retention/privacy policy.

Data shape (intent):
`customers` (platform-level identity) → `customer_memberships`
(customer × business) → LIP `member_id` per (tenant, program).

**Impact on LIP:** LIP's customer identity is keyed per tenant
(`{tenant_id, issuer, subject}` → customer). PD-001 needs a platform-level
identity *above* tenants. See gap G-01 in `03-gap-analysis.md`.

---

## PD-002 — Use LIP as the loyalty core — Proposed

Adopt LIP's engine, ledger, idempotency, reservations, Postgres storage and RLS
as the loyalty core instead of writing our own `transactions` /
`stamp_balances` / `point_transactions` tables. Build our product (owner
dashboard, staff app, customer web app, automation, billing) around it.

Why: the hardest correctness problems (double-award, refunds, expiry lots,
reservation races, tenant isolation) are already specified and tested.
Risks: upstream is a v0.x draft; Admin UI and platform layer do not fit our
users; branding must change. Alternative: borrow the spec and patterns only.

## PD-003 — Staff Scan is the trusted path — Proposed (recommended in brief)

Method B (staff scans rotating customer QR) is the only path that can grant
value directly. Method A (customer scans branch QR) creates a *pending* claim
that a staff member must confirm.

## PD-004 — Customer authentication: phone OTP — Proposed

LIP does not authenticate customers. Candidates: Supabase Auth phone OTP (needs
an SMS/WhatsApp provider that delivers to Egyptian numbers) or a dedicated
OTP provider. Must expose a JWKS/OIDC-compatible token so LIP's OIDC verifier
can be reused.

## PD-005 — Billing provider: Kashier — Approved (2026-11-06)

Context: upstream LIP ships Stripe only; Stripe does not onboard
Egyptian-resident businesses directly.

Decision: subscriptions from café owners are collected through **Kashier**
(EGP; cards and wallets). Stripe stays unused/disabled.

Consequences:
- Kashier has **no managed subscriptions/billing-plans API**. We own the billing
  schedule: Save Token API once (customer completes first payment, webhook
  returns `cardDataToken` + `agreementId`), then charge each cycle with the
  Pay with Token API (`interactionSource: RECURRING`).
- Build `KashierBillingProvider` implementing `CloudBillingProvider`
  (`apps/cloud/src/billing.ts`). Unlike Stripe, our side must run the renewal
  scheduler, retries/dunning, grace period, and invoice records.
- Webhooks are signed with HMAC-SHA256 using the **Payment API Key** (not the
  Secret Key), header `x-kashier-signature`. Verify on the raw body; dedupe by
  transaction id; treat webhooks as the source of truth for payment status.
- Store only the token/agreement ids, never card data. Test and live modes use
  separate keys and URLs.
- Add `kashier` to the Cloud `billing_provider` union (currently `manual | stripe`).
- Manual/invoice billing remains available for pilot cafés.

## PD-006 — Hosting split — Proposed

Next.js apps (owner dashboard, customer web, staff web) can run on Vercel.
The LIP runtime is a long-running Node server with a campaign scheduler and
Postgres advisory locks, so it needs a container host (Render config exists in
`render.yaml`), not serverless functions.

## PD-007 — Languages — Proposed (brief says "suggested")

Arabic (RTL) is the default UI language; English second. All customer-facing
copy, reward names and messages must be localizable per business.

---

Template for new entries:

```
## PD-0XX — Title — Proposed|Approved
Context:
Decision:
Consequences:
Date / approved by:
```
