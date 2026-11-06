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

## PD-003 — Staff confirmation is the only path that grants purchase value — Approved (2026-11-06); amended 2026-11-06 (A1: device-bound member QR)

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
  says so clearly. *(Token wording amended by A1 below: "server-signed" →
  "server-verifiable, device-bound". Validation still happens online.)*
- Purchases made during an outage are never awarded retroactively by the
  cashier. The owner may afterwards post a classified `service_recovery`
  manual adjustment with a reason; it is audited.
- The offline queue stays in the backlog.

Date / approved by: 2026-11-06, project owner.

### Amendment A1 — 2026-11-06: device-bound member QR (offline display)

Context: roadmap task 4.1 requires the customer app to show the member QR
offline (café interiors often have weak signal), but a server-signed token
needs the customer's phone to be online. Raised in PD-004 round 1 (Q5).

Decision: the Method B member QR changes from **"server-signed"** to
**"server-verifiable, device-bound"**. At sign-in each customer device receives
a device secret; the app derives a rotating code (≤ 60 s) from it, even
offline. The server verifies each code.

Consequences:
- Each code is single-use on the server and bound to {customer, device}; it
  stays bound to the business whose card is shown, as before (task 3.1:
  another café's code fails).
- At most 3 active devices per customer; the customer can see and revoke them.
- The device secret is rotated every time the app is online.
- Offline display requires the app to have been opened online at least once on
  that device (installed PWA with a service worker).
- Unchanged: the staff side must be online, validation happens on the server,
  and no value is granted offline.
- Changing the phone number (PD-004) revokes every session and device secret.

Date / approved by: 2026-11-06, project owner.

## PD-004 — Customer authentication: phone OTP — Proposed (round 1 agreed 2026-11-06; provider open)

Context: LIP does not authenticate customers (G-06). LIP's verifier
(`packages/identity/src/oidc.ts`) accepts only RS256/ES256 JWTs whose keys come
from an HTTPS JWKS endpoint.

**Assumption:** the legal entity (task 0.11, not yet registered) will be
Egyptian-registered. SMS sender-ID registration and Meta Business verification
wait for it. PD-004 stays Proposed until the real-number delivery test (task 2.4).

Agreed in round 1 (2026-11-06):
1. *Token check:* the BFF verifies the provider's token with `packages/identity`
   used as a library (no fork patch), maps it to the platform customer →
   `member_id`, and calls LIP with the merchant key. The LIP server never sees
   a customer token.
2. *Phone is a credential, not the identity:* the platform customer id is
   stable. Changing the number requires being signed in plus an OTP to the new
   number, and revokes every existing session and device secret (PD-003 A1).
   The reused-number risk is accepted for the MVP; a support procedure detaches
   a number from an account after checks.
3. *Abuse limits* (all proposed starting values): Egyptian mobile numbers only
   (`+20 1x…`); 6-digit code valid 5 min; resend cooldown 60 s; per phone ≤ 5
   sends/hour and ≤ 10/day; ≤ 5 wrong attempts per code; per-IP and per-device
   limits; a bot check (e.g. Cloudflare Turnstile) before the first send; a
   platform-wide **circuit breaker** — global daily caps on OTP sends and on OTP
   spend; reaching either pauses sending and alerts the platform admin.
4. *Session:* sliding 90-day httpOnly cookie set by the BFF; "sign out of all
   devices"; a fresh OTP only for account deletion and phone change.
5. *Offline member QR:* see PD-003 A1.
6. *Cost:* OTP is a platform cost, not counted against a café's message
   allowance; it feeds plan pricing (task 1.6).
7. *Channel:* WhatsApp first (authentication template with a copy-code
   button); SMS fallback after the 60 s cooldown or when the number is not on
   WhatsApp, through an Egyptian SMS provider with a registered sender ID.
   If Supabase Auth is used, WhatsApp goes through the Send SMS Hook to a sender
   we choose (Supabase's built-in WhatsApp is Twilio-only).
   - Price, **unverified**: WhatsApp authentication ≈ $0.0036/message per a
     third-party copy of Meta's rate card; the domestic vs international
     authentication rate depends on where the WhatsApp Business account is
     registered. Verify against Meta's official rate card before task 1.6.
   - Price, verified: Twilio SMS to Egypt $0.3959/segment (2026-11-06).

Open for round 2: provider.

## PD-005 — Billing provider: Kashier — Approved (2026-11-06); amended 2026-11-06 (A1: manual billing at launch, Kashier deferred)

Context: upstream LIP ships Stripe only; Stripe does not onboard
Egyptian-resident businesses directly.

Decision: subscriptions from café owners are collected through **Kashier**
(EGP; cards and wallets). Stripe stays unused/disabled.

Consequences (deferred by amendment A1 below — they apply when Kashier is revisited):
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

### Amendment A1 — 2026-11-06: manual collection at launch; Kashier deferred

Decision: for launch, subscriptions are collected manually. The platform owner
contacts each café when its subscription is about to end and collects payment
offline (cash, InstaPay, Vodafone Cash, bank transfer). Kashier is **deferred,
not removed**. Revisit when we reach 30 paying cafés (proposed trigger) or when
manual collection becomes a bottleneck. Stripe stays unused.

Consequences:
1. No online payment and no card tokens in the MVP. Former roadmap tasks 6.1
   (`KashierBillingProvider`) and 6.2 (renewal scheduler) move to the backlog.
2. Manual billing is a P0/P1 feature of the super-admin console:
   - Record a payment: café, amount in EGP (integer piasters), method,
     reference, date, recorded by.
   - Set or extend the subscription period (plan + end date). Every change is
     audited.
   - A list of cafés whose subscription ends in the next 7 days, plus overdue ones.
   - Payment history per café.
3. The café owner sees the plan, end date and a renewal reminder in their
   dashboard before expiry.
4. Expiry behavior: see the three stages in follow-up 7 below (supersedes the
   earlier "grace period, then read-only" wording).
5. Use LIP Cloud's existing `billing_provider: "manual"`; no new provider.
   Verified in code on 2026-11-06 (tests not run):
   - `"manual"` is already the default when an organization is created, with a
     fixed 30-day period (`defaultSubscriptionPeriod`, `apps/cloud/src/service.ts`).
   - **No API or service method sets the plan or period of a manual
     subscription.** The only update path (`persistBillingUpdate`) is driven by
     the Stripe webhook and forces `billing_provider: "stripe"`.
     `repository.replaceSubscription(subscription, audit)` exists and can be reused.
   - No payment record type or table exists.
   - **Nothing acts when `current_period_end` passes.** Status
     (`trialing | active | past_due | cancelled`) changes only through Stripe
     webhooks, and there is no grace or read-only state.
   - Fork patches needed (logged in `07-fork-patches.md` when made): an
     operator-only "set manual subscription" method + route in `apps/cloud`
     (`service.ts`, `server.ts`). Payment records and period-end evaluation go
     either in Cloud (fork patch) or in our layer; decided in the task.
6. The legal entity (task 0.11) no longer blocks launch billing. It still blocks
   SMS sender-ID registration, Meta Business verification, the real-number OTP
   test (now in task 2.4), and the pilot (5.6).

Follow-ups approved 2026-11-06:
7. Three stages after the period end date (proposed defaults):
   1. **Grace**, days 1–7: everything works normally.
   2. **Read-only**, days 8–37: the owner cannot change program, campaigns or
      staff. Cashiers keep awarding and redeeming.
   3. **Suspended**, after day 37: no new awards. Customers can still redeem
      what they already hold. Balances are never removed.
   Recording a payment restores full service immediately.
8. Payment records are append-only: never edited or deleted; a mistake is
   corrected with a reversing entry.
9. Subscription status follows the period end date automatically on the
   server (no human step).
10. Fork patch approved: a super-admin-only "set manual subscription" (plan +
    period) in `apps/cloud`, reusing `repository.replaceSubscription` with
    audit. Logged in `07-fork-patches.md` when written.
11. Task 0.11 (legal entity) approved as written.

Date / approved by: 2026-11-06, project owner.

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
