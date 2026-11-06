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

## PD-002 — Use LIP as the loyalty core — Approved (2026-11-06, conditional)

Context: LIP's engine, ledger, idempotency, reservations, Postgres storage and
RLS already address the hardest correctness problems (double-award, refunds,
expiry lots, reservation races, tenant isolation). Alternative considered:
borrow the spec and patterns only and write our own engine. Risks: upstream is
a v0.x working draft; its Admin UI and platform layer do not fit our users;
branding must change.

Decision: fork LIP and adopt it as the loyalty core instead of writing our own
`transactions` / `stamp_balances` / `point_transactions` tables. Build the
product (BFF, owner dashboard, staff app, customer web app, automation,
billing) around it in the same monorepo.

**Condition:** tasks 0.7 and 0.8 must pass before Phase 2 starts or any
application code is written. Task 0.4 and Phase 1 may proceed in parallel.
A material baseline failure reopens this decision (exit criterion 1).

Consequences:

*Pin*
- Pinned to upstream commit `8ad93c81a414f5f7521061ddd88009083f4857aa`
  (`upstream/main`, 2026-09-18; package version 0.2.0).
- This is **unreleased upstream main, not a tagged release.** It is 80 commits
  after tag `v0.2.0` (2026-08-15) and contains work not in that tag (Postgres
  lease conformance test, live tenant-isolation tests, platform OpenAPI). Because
  it was never released, baseline tasks 0.7 and 0.8 matter more, not less.
- Upgrade plan: stay on this commit; move to the first upstream tag that
  contains it.
- Our only difference from that commit at approval time is `.gitignore`
  (logged in `07-fork-patches.md`) plus our own docs.

*Scope*
- Core (shipped): `packages/protocol`, `packages/reference`, `packages/server`,
  `packages/storage` (the interface `storage-postgres` depends on),
  `packages/storage-postgres`, `packages/identity`, `packages/sdk` (our BFF
  calls LIP through it), `apps/cloud` (orgs, plans, quotas; billing via
  Kashier per PD-005).
- Dev tool (not shipped): `packages/cli` (`lip doctor`, `lip test`).
- Reference only (not shipped): `apps/admin`, `apps/wallet`, `packages/mcp`,
  `packages/adapter-kit`, `packages/storage-sqlite`, `docs-site`, `landing`.
  Their replacements are G-07 (customer app) and G-08 (owner dashboard).

*Fork rules*
- Code inside upstream packages may be modified; `/lip/v1` wire semantics and
  `spec/` may not (golden rule 1 in `CLAUDE.md`).
- Every modification to upstream code is logged in `07-fork-patches.md`
  (file, reason, PD reference, upgrade impact). Expected early entries:
  cashier role (G-05, `access-control.ts`), platform storage (G-11).
- One monorepo; our apps live in new directories next to upstream code
  (e.g. `apps/bff`, `apps/staff`, `apps/customer`, `apps/dashboard`).

*Upstream updates*
- Git remote `upstream` → `craveup-oss/loyalty-interchange-protocol`, tags
  tracked, push disabled.
- No automatic pulls. Take upstream changes only for security fixes or spec
  changes we want; each one gets its own PD entry.
- Apply them as a patch: `git diff <pinned commit> <upstream tag or commit>`,
  applied with `git apply -3` (our history does not share upstream's, so
  merges are not possible). Never port by hand from scratch.

*Scaling* (verified by reading code and docs on 2026-11-06; tests not yet run)
- `/lip/v1` protocol path: safe on multiple instances (per-request
  tenant/program advisory transaction lock + revision check; `docs/postgres.md`).
- Platform layer (campaign, engagement and membership schedulers, cached
  platform state, webhook dispatcher): **one instance per tenant until task 2.7
  is done.** The schedulers are per-process `setInterval`; `withLease()` exists
  in `storage-postgres` with conformance tests but has no production caller;
  upstream's own guidance is "run at most one platform instance per tenant".
  This — not SQLite (the blueprint is diskless Neon Postgres) — is why
  `render.yaml` sets `numInstances: 1`.
- MVP and pilot run on a single instance. Task 2.7 makes the platform layer
  multi-instance-safe.
- Postgres must be reached through a direct endpoint. Transaction poolers
  (PgBouncer transaction mode, Neon `-pooler` hosts) are rejected at boot
  because session advisory leases break under them. Input to PD-006.

*Exit criteria* — supersede PD-002 if any holds; fallback is "borrow the spec
and patterns, write our own engine":
1. Baseline 0.7/0.8 fails in a way that cannot be fixed.
2. G-01 (platform identity above tenants) cannot be built without changing
   `/lip/v1` semantics.
3. Task 5.2 fails, and neither vertical scaling nor completing task 2.7 fixes it.

Date / approved by: 2026-11-06, project owner.

## PD-003 — Staff confirmation is the only path that grants purchase value — Approved (2026-11-06)

Context: the approved brief requires two capture methods: Method A (customer
scans the branch QR) and Method B (staff scans the customer's rotating QR).
The customer's phone is untrusted; the staff member is the only party who sees
the purchase happen.

Decision: purchase accrual and counter redemption run only from an
authenticated staff session of the business at an allowed branch. Method B
(staff scan) grants value directly. Method A creates a pending claim that grants
nothing until a staff member confirms it.

Consequences:

*Scope*
- PD-003 covers purchase accrual and counter redemption only.
- Every non-purchase source of value — manual adjustment, campaign reward,
  automation reward (welcome, birthday, …), balance import — is outside PD-003:
  it is authorized by the owner or the system, classified, audited, and carries
  a stable business id so it is idempotent.
- Manual adjustments are owner-only; the cashier cap stays at 0.

*Redemption*
- The customer never reserves or captures. The "Redeem" button in the customer
  app only displays the reward QR (including issued rewards); reserve → capture
  runs from a staff session.

*Method A — pending claims*
- The customer's phone shows their first name and a short claim code, unique
  among open claims at that branch.
- The cashier must **type** the code; there is no pick-from-a-list
  confirmation. A wrong code is rejected; repeated wrong codes on the same claim
  cancel it (default 3 attempts — proposed starting value).
- The staff member always enters the bill amount; the customer never does.
- Claims expire (default 15 min); one open claim per customer per branch.

*No manual lookup*
- The cashier cannot find a customer by typing a phone number (MVP). If the
  customer QR cannot be scanned, the fallback is Method A, or no award.
  Phone lookup (possibly with an OTP to the customer) is in the backlog.

*Staff self-dealing*
- A staff profile stores the staff member's phone number, OTP-verified when the
  profile is created; changing it requires owner approval.
- A staff session cannot award, confirm a claim, or redeem for the customer
  account with that phone number. The owner can, with an audit record.
- Collusion beyond that is handled by the anomaly alerts in 04-business-rules.

*Offline*
- No value is granted offline in the MVP: the Method B token is server-signed,
  single-use and ≤ 60 s, so it can only be validated online. The staff app
  says so clearly.
- Purchases made during an outage are never awarded retroactively by the
  cashier. The owner may afterwards post a classified `service_recovery`
  manual adjustment with a reason; it is audited.
- The offline queue stays in the backlog.

Date / approved by: 2026-11-06, project owner.

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
