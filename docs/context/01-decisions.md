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
  cashier role (G-05, `access-control.ts` — optional since PD-014), platform
  storage (G-11).
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

## PD-003 — Staff confirmation is the only path that grants purchase value — Approved (2026-11-06); amended 2026-11-06 (A1: device-bound member QR; A1 addendum: Wallet pass counts as a device); amended 2026-11-12 (A2: system stamp-restore correction inside a void)

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
  cancel it (3 attempts — approved and platform-fixed by PD-020).
- The staff member always enters the bill amount; the customer never does.
- Claims expire (15 min — approved and platform-fixed by PD-020); one open
  claim per customer per branch.

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

*A1 addendum — 2026-11-06 (PD-009):* "device" also includes a **Google Wallet
pass**. The pass shows a rotating TOTP code (`rotatingBarcode`), counts toward
the 3-device limit, can be revoked, has its key replaced via the API from time
to time, and each code is single-use on the server and bound to
{customer, pass, café}. A pass code is for earning only; redemption starts from
the web app. No static barcode is ever accepted.

### Amendment A2 — 2026-11-12: system stamp-restore correction inside a void

Context: PD-008 A1 found that voiding a purchase that issued a stamp reward
leaves the card short unless the card reset is put back. Putting it back is a
manual adjustment, which *Scope* above reserves to the owner ("Manual
adjustments are owner-only; the cashier cap stays at 0").

Decision: one narrow exception to that rule — the **system stamp-restore
correction** defined in PD-008 A1.

Consequences:
- It runs only as a step of a void that PD-008 A1 permits. No endpoint, screen
  or role can request it outside that workflow, and no person enters its
  amount.
- Its amount is k × threshold, computed by the system from the saved void plan
  (PD-008 A1). It is classified `correction`, has `qualifies_for_tier: false`,
  carries a reason linked to the void id and the business id
  `void-<void id>-restore`.
- It is audited with actor = system, plus the staff member, device and branch
  that started the void.
- It is not a cashier manual adjustment: the cashier cap stays 0 and the
  cashier role gains no adjustment permission.
- Owner stamp adjustments outside a void stay owner-only and follow the balance
  range rule in PD-008 A1.

Date / approved by: 2026-11-12, project owner.

## PD-004 — Customer authentication: phone OTP run by our BFF — Approved (2026-11-06, conditional)

Context: LIP does not authenticate customers (G-06). Options considered:
Supabase Auth phone OTP (+ Send SMS Hook), our own OTP in the BFF, Twilio
Verify, Firebase phone auth. Research on 2026-11-06: Supabase signs ES256/RS256
with a JWKS but its built-in WhatsApp is Twilio-only and its user table would
duplicate our customer directory (G-01); Twilio Verify costs $0.05 + channel
(≈ $0.45 per SMS code to Egypt); Firebase is SMS-only with no sender control.

Decision: we run OTP in our own BFF. Codes go out by WhatsApp first (Meta
WhatsApp Cloud API, direct) with SMS fallback through an Egyptian SMS provider.
The BFF creates the customer session itself; there is no outside identity
provider and no outside token.

**Condition:** the real-number delivery test in task 2.4 (WhatsApp and SMS to a
real Egyptian number) must pass. If delivery fails, the channel/provider choice
reopens. Phase 0 can close on this conditional approval.

**Assumption:** the legal entity (task 0.11, not yet registered) will be
Egyptian-registered. SMS sender-ID registration, Meta Business verification and
WhatsApp authentication-template approval all wait for it.

Consequences:

*Identity and session*
- No outside token: the round-1 requirement "the BFF verifies the provider's
  token with `packages/identity`" is superseded, and the JWKS condition is
  dropped from task 0.3. The LIP server still never sees a customer session;
  the BFF maps the platform customer → `member_id` and calls LIP with the
  merchant key.
- The phone number is a credential, not the identity: the platform customer id
  is stable. Changing the number requires being signed in plus an OTP to the new
  number, and revokes every existing session and device secret (PD-003 A1).
  The reused-number risk is accepted for the MVP; a support procedure detaches
  a number from an account after checks.
- Session: sliding 90 days; "sign out of all devices"; a fresh OTP only for
  account deletion and phone change.
- The same OTP service verifies staff phone numbers (PD-003).

*Security requirements (security-critical code)*
- Codes are stored as an HMAC with a server-side secret, never plain or as a
  plain hash (a 6-digit code space is reversible in seconds).
- Codes are compared in constant time. One active code per phone; issuing a new
  code invalidates the previous one.
- Session ids are random (≥ 256 bits) and stored hashed; cookies are httpOnly +
  Secure + SameSite; state-changing requests have CSRF protection.
- Node's built-in `crypto` only; no hand-rolled primitives.
- Task 5.1 (security review) explicitly covers the OTP and session code.

*Abuse limits* (approved by PD-020 as platform-fixed values)
- Egyptian mobile numbers only (`+20 1x…`); 6-digit code valid 5 min; resend
  cooldown 60 s; per phone ≤ 5 sends/hour and ≤ 10/day; ≤ 5 wrong attempts per
  code; per-IP and per-device limits.
- Bot check (Cloudflare Turnstile) before the first send.
- Platform-wide circuit breaker: global daily caps on OTP sends and on OTP
  spend; reaching either pauses sending and alerts the platform admin.

*Channels*
- WhatsApp: authentication template with a copy-code button, via Meta's
  WhatsApp Cloud API directly (no reseller), under a WhatsApp Business account
  of the Egyptian entity. Codes use a sender number separate from the future
  marketing number (task 6.5) so marketing complaints cannot hurt code delivery.
  Authentication templates need Meta approval (0.11-dependent setup).
- SMS fallback after the 60 s cooldown or when the number is not on WhatsApp,
  through an Egyptian SMS provider chosen from at least 2 quotes (e.g. Cequens,
  Victory Link, SMS Misr) on: price per Arabic segment, sender-ID registration
  support, delivery-report API, uptime. Choice recorded before task 2.4.
  Twilio is not used.
- SMS text is in Arabic, formatted for the WebOTP API (last line
  `@<our domain> #<code>`) so Android browsers autofill the code in the PWA, and
  must fit one 70-character UCS-2 segment. Check against the final domain:
  `رمز الدخول: 123456` + newline + `@<domain> #123456` is 28 characters plus
  the domain, so the domain may be at most 42 characters (less if more text is
  added).

*Cost*
- OTP is a platform cost, not counted against a café's message allowance; it
  feeds plan pricing (task 1.6).
- WhatsApp authentication ≈ $0.0036/message is **unverified** (third-party copy
  of Meta's rate card); the domestic vs international authentication rate
  depends on where the WhatsApp Business account is registered. Verify against
  Meta's official rate card before task 1.6. Verified for comparison: Twilio
  SMS to Egypt $0.3959/segment (2026-11-06).

*Offline member QR:* see PD-003 A1.

Date / approved by: 2026-11-06, project owner.

## PD-005 — Billing provider: Kashier — Approved (2026-11-06); amended 2026-11-06 (A1: manual billing at launch, Kashier deferred); amended 2026-11-12 (A2: subscription stage permissions)

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
7. Three stages after the period end date (proposed defaults; day ranges
   approved by PD-020, permissions per stage refined by A2 below):
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
12. During the suspended stage, point and reward expiry keep running as
    configured, and no message about the café's billing is sent to customers.
    No marketing messages go to that café's customers; transactional messages
    (reward earned, reward expiring) still go out.

Date / approved by: 2026-11-06, project owner.

### Amendment A2 — 2026-11-12: subscription stage permissions

Context: follow-up 7 named the three stages but not exactly which actions each
stage allows, and did not say how our stages relate to LIP Cloud's own states.
Facts from code (2026-11-12, source read only, not executed): a Cloud
environment with status `suspended` refuses every request
(`apps/cloud/src/managed-data-plane.ts`); Cloud usage recording returns 402
unless the subscription status is `active` or `trialing`
(`apps/cloud/src/service.ts`).

Decision: follow-up 7 is amended with this permission table. Stage days are
Cairo calendar days (PD-007) counted from the period end date: grace days 1–7,
read-only days 8–37, suspended day 38 onward (PD-020).

| Action | Grace | Read-only | Suspended |
| --- | --- | --- | --- |
| Accrue a purchase / confirm a pending claim | ✓ | ✓ | ✗ |
| Redeem a reward | ✓ | ✓ | ✓ |
| Void a purchase, including the stamp restore (PD-008 A1) | ✓ | ✓ | ✓ |
| Owner adjustment classified `correction` or `service_recovery` | ✓ | ✓ | ✓ |
| Owner adjustment classified `bonus` or `gift` | ✓ | ✗ | ✗ |
| Owner adjustment classified `migration` (owner-only; never a bypass for `correction` / `service_recovery`) | ✓ | ✗ | ✗ |
| Revoke staff, devices or sessions | ✓ | ✓ | ✓ |
| Add staff, publish or change the program, campaigns | ✓ | ✗ | ✗ |
| A new customer joins the café | ✓ | ✓ | ✗ |
| Rotate a leaked Branch QR (security action) | ✓ | ✓ | ✓ |

Consequences:
- Blocking new joins in the suspended stage is an approved exception to PD-001
  rule 2 for that café only.
- Revoking access and correcting mistakes are never blocked, so a café that
  stops paying can still remove a former employee and fix a wrong award.
- The stage is computed and enforced in our layer (BFF). It must never be
  implemented with Cloud environment suspension, a Cloud subscription status
  other than `active`/`trialing`, or LIP write-freeze, because each of those
  would also stop redemptions, voids and revocations. The Cloud subscription
  stays `active` while our stage engine runs; how this is kept in sync is
  decided in task 5.5.
- Branch QR rotation is a security action, like revocation, and is allowed in
  every stage.
- The `migration` adjustment classification (balance import) stays
  owner-only (PD-003) and is allowed in grace only; it is blocked in
  read-only and suspended (approved 2026-11-12). It is never a bypass:
  legitimate corrections and service recovery use `correction` and
  `service_recovery`, which stay allowed in every stage.
- Recording a payment restores full service immediately (unchanged).
- Needs executable verification (task 5.5): that the Cloud mapping above holds
  at runtime on the pinned commit.

Date / approved by: 2026-11-12, project owner.

## PD-006 — Hosting split and Postgres provider — Approved (2026-11-06, conditional)

Context: the LIP runtime deployed by `render.yaml` (`node apps/cloud/dist/cli.js`)
is one process running the control plane and every café's LIP runtime against
one shared database behind one listener (`apps/cloud/src/managed-data-plane.ts`);
it must run as one instance (PD-002) and refuses to share a database or role
between sandbox and production. No AWS/GCP/Azure, Supabase, Neon, Render or Fly
region exists in Egypt; Frankfurt is the nearest everywhere (research 2026-11-06).
Options considered for Postgres: Supabase (7-day PITR add-on $100/month alone
breaks the budget; direct connection IPv6-only), Neon Launch, Render Postgres.

Decision: everything runs on **Render, region Frankfurt, Pro workspace**: three
services per environment (LIP runtime, BFF, one Next.js web app) and **Render
Postgres**, for staging and production, behind Cloudflare.

**Conditions** (PD-006 reopens if any fails):
1. Before task 2.2 is done: the Postgres lease conformance test and `lip test`
   pass against the Render staging database (proves session advisory locks work
   on a direct Render Postgres connection).
2. Confirm on Render's billing page: whether the Pro fee is per workspace or per
   seat; whether point-in-time restore is billed extra; whether suspended
   services are billed. If the fee is per seat, record the seats we actually need
   (currently 1: the project owner) and recompute the total.
3. The confirmed monthly total stays ≤ $100, after the fallback below.
4. The restore drill (task 5.3) uses Render Postgres point-in-time restore, not
   an upstream local backup command.

Consequences:

*Topology*
1. *BFF* is a long-running Node service (not serverless), in the same region as
   LIP and the database. It runs timers (claim expiry, subscription stages, OTP
   circuit breaker, message sending) and holds the merchant key. If the BFF ever
   runs more than one instance, those timers run under a Postgres lease or a
   single worker so scale-out cannot double-run them (same lesson as task 2.7).
2. *LIP and BFF are separate services.* LIP stays at 1 instance; the BFF can
   scale later. They talk over Render's private network; only the BFF reaches
   LIP; only the BFF environment holds the merchant key.
3. *One Next.js app* (`apps/web`) serves the customer, staff and owner surfaces,
   routed by subdomain (`app.`, `staff.`, `dashboard.`), with Cloudflare as CDN
   in front. Code stays split by surface inside the app so it can be split
   later. All surfaces and `api.` live under one registrable domain so PD-004's
   SameSite cookies work. Our apps are `apps/bff` and `apps/web` (supersedes the
   example list in PD-002's fork rules).
4. *Environments:* staging and production only, each with its own database and
   roles; local development uses `docker compose --profile postgres`. Staging
   uses the smallest sizes and may be paused when unused, if that does not break
   advisory locks.

*Database*
5. *Connections:* every service connects directly or through a session-mode
   pooler, never transaction mode. A session-mode pooler keeps one server
   connection per client session, so session advisory locks work; only
   transaction mode is ruled out. Render Postgres has no built-in pooler; we use
   its direct internal connection.
6. *Backups:* production keeps 7-day point-in-time restore (needs the Pro
   workspace; Hobby keeps 3 days). Restore drill per condition 4.

*Cost* (USD/month, research 2026-11-06; items in condition 2 unverified)

| Item | Production | Staging |
| --- | --- | --- |
| Render Pro workspace | 25 (shared) | — |
| LIP runtime (0.5 CPU / 512 MB) | 7 | 7 |
| BFF (0.5 CPU / 512 MB) | 7 | 7 |
| Web app (0.5 CPU / 512 MB) | 7 | 7 |
| Render Postgres | 19 (1 GB) + 3 (10 GB storage) | 6 (256 MB) + 3 (10 GB storage) |
| Cloudflare (free plan) | 0 | 0 |
| **Subtotal** | **68** | **30** |
| **Total** | **98** | |

Domain name (~$1/month) and messaging (WhatsApp/SMS) are not included.

7. *Memory risk:* memory for the LIP process (all cafés in one process) is
   **unmeasured**; task 0.8 reports its idle memory. If production LIP needs the
   next size (1 CPU / 2 GB, $25, +$18 → ≈ $116), the fallback, in order:
   1. Suspend staging's three services when unused (saves $21 if suspended
      services are not billed — to be confirmed).
   2. Raise the cap to $125 **only with the project owner's explicit approval at
      that time**; never applied automatically.
8. *Budget:* ≤ $100/month for staging and production together (hosting,
   database, CDN; messaging excluded) until the first paying cafés.

*Region and law*
9. Frankfurt for staging and production. Legal facts below are **unverified
   (secondary sources)**: Egypt's PDPL 151/2020 executive regulations were
   reportedly issued in November 2025; transferring personal data outside Egypt
   reportedly needs a permit from the Personal Data Protection Center (Reg.
   Art. 16); the one-year grace period reportedly ended around 1 November 2026;
   whether the Center issues permits yet is unclear. Task 0.10 is therefore a
   hard gate before the pilot (5.6). If counsel says data must stay in Egypt,
   PD-006 reopens for Egyptian hosting.
10. *Design hedge* so an "Egypt-only" answer does not force a full re-host:
    personal data (phone, name, birthday, consent) lives only in the platform
    customer directory (G-01, task 2.3), in its own schema and database role,
    behind its own service interface. LIP keeps only opaque `member_id` values.
    The BFF never copies phone numbers into LIP, logs, analytics or message-job
    payloads beyond what sending requires. Only the customer directory would
    then need to move to an Egyptian host.

Date / approved by: 2026-11-06, project owner.

## PD-007 — Arabic-first, English second — Approved (2026-11-06); clarified 2026-11-12 (C1: expiry moments)

Context: the brief requires Arabic + English with RTL as first class (G-14).
LIP has no localization: `ProgramDefinition.name/description` and
`RewardDefinition.name/description` are single optional strings
(`packages/reference/src/config.ts`), and nothing in `packages/protocol` or
`spec/` mentions a locale.

Decision: Arabic (RTL) is the default language of every product surface;
English is second. Localized content lives in our layer, never in LIP.

Consequences:

*UI language*
- The customer, staff and owner surfaces default to Arabic RTL regardless of
  browser or phone language; anyone can switch to English. The choice is stored
  on the account (customer, staff member, owner).
- Before sign-in (landing and OTP screens) the choice is kept in a cookie and
  copied to the account at sign-in.
- Super-admin screens may stay English-only for now.

*Café content*
- LIP keeps one internal label per program/reward in its `name` field. Display
  text per language (program names, reward names and descriptions, branch
  names) is stored in our layer, keyed by `program_id` / `reward_id` / branch
  id and language. No fork patch adds locales to LIP.
- Each café chooses its main content language (Arabic by default). Main-language
  text is required; the other language is optional and falls back to the main
  one. The program wizard (task 3.7) asks for both, requires only the main one.

*Numbers, money, direction*
- Western digits (0–9) are displayed in both languages, including prices,
  codes, phone numbers and balances. Every input accepts Western, Arabic-Indic
  and Persian digits and normalizes them to Western.
- Money format: Arabic `45 ج.م` / `45.50 ج.م` (ج.م = جنيه مصري); English
  `EGP 45` / `EGP 45.50`. Zero piasters are hidden; two decimals are shown only
  when piasters are non-zero.
- The cashier enters pounds with up to two decimals; the BFF converts to integer
  piasters, never floats (golden rule 2).
- Codes, phone numbers and amounts inside Arabic text are rendered with Unicode
  bidi isolation (`<bdi>` or `dir="ltr"` on the element), never by inserting
  directional control characters.

*Messages*
- OTP, transactional and (later) marketing messages follow the customer's
  language. At launch every WhatsApp template (OTP, transactional) exists in
  Arabic; English versions are optional and fall back to Arabic. Each language
  version needs its own Meta approval (0.11-dependent). Café-written marketing
  text follows the café's main-language rule.

*Time*
- Dates and times are displayed in the IANA zone `Africa/Cairo`, Gregorian
  calendar. Day-based business rules (expiry, birthdays, send windows, the
  7/14/30-day inactivity checks, subscription stages) use `Africa/Cairo`.
  Timestamps are stored in UTC.
- Always the zone name `Africa/Cairo`, never a fixed offset such as `+02:00`:
  Egypt observes daylight saving time. LIP's `tier_policy` time zone (when tiers
  ship) is set to `Africa/Cairo` for the same reason.

Date / approved by: 2026-11-06, project owner.

### Clarification C1 — 2026-11-12: expiry moments computed by LIP

Context: the *Time* rule above says day-based business rules, including
expiry, use `Africa/Cairo`. Facts from code (2026-11-12, source read only):
LIP computes point expiry as earn time + days × 24 hours, an exact moment in
UTC, not the end of a Cairo calendar day; stamps have no expiry
(`packages/reference/src/engine.ts`).

Decision (clarification, not a change of intent):
- Point and reward expiries computed by LIP are exact moments. The product
  shows them as date **and time** in `Africa/Cairo` (for example "expires 12
  Nov 2027, 3:40 pm"), never as a date alone, so a customer is never told a
  later day than LIP will honour.
- Stamps never expire (PD-012, PD-020).
- Day-based rules that our own layer computes (subscription stages, inactivity
  checks, send windows, birthdays) keep using Cairo calendar days.
- No fork patch changes LIP's expiry arithmetic.

Date / approved by: 2026-11-12, project owner.

## PD-008 — Purchase capture: bill amount only (roadmap task 0.6) — Approved (2026-11-06); amended 2026-11-12 (A1: void with automatic stamp restore)

Context: small cafés have no POS integration (G-04). Facts from code
(2026-11-06): LIP earning exclusions are item-based (`excluded_product_ids`,
`excluded_category_ids`, `excluded_tags`, `excluded_line_kinds`); stamps are
per order (`visit_stamp_policy.amount_per_order`), with no per-item stamp rule
even when items are sent; `free_item` reward effects name products/categories
and a `max_value`.

Decision: in the MVP the cashier records a purchase as a **bill amount only**.
The BFF turns it into one synthetic, loyalty-eligible order line with an
`order_id` generated per scan session.

Consequences:

*Program design*
- Product/category/tag exclusions do nothing with one synthetic line; the
  program wizard hides them. Only minimum eligible spend and channel rules apply.
- Stamps are "1 per paid order" (amount per order), not per item.
- First backlog item after the MVP: bill amount + an optional short product list
  picked by the cashier (enables exclusions; per-item stamps would still need a
  fork patch because LIP stamps are per order).

*What the cashier types*
- An owner setting labels the input. Default **"Amount paid"** (many small cafés
  print no itemized receipt). Cafés that print subtotal/service/VAT can switch
  to **"Subtotal before service & VAT"**. We never compute taxes or service.
- The amount is what the customer actually paid for eligible items, after
  discounts and excluding any free reward item received at the same visit.
- The confirm screen shows the amount and the points/stamps it will earn; the
  preview comes from LIP `orders/evaluate`, never from client-side math.

*Typing mistakes* (approved by PD-020: threshold 2,000 EGP, café setting)
- Each café sets a "large bill" threshold (default 2,000 EGP). Above it the
  cashier must type the amount a second time. Above 5 × the threshold the amount
  is rejected; only the owner can award it, as a classified adjustment.

*Fixing a wrong amount*
- The same staff member can void their own purchase within 10 minutes: a full
  clawback on the same `order_id` through `orders/adjust` (audited), then
  re-record. A void never grants new purchase or tier value (consistent with
  PD-003); the only stamps it adds back are the tightly scoped system
  stamp-restore correction of PD-003 A2, which returns stamps the purchase's
  card reset had removed.
- *(amended by A1)* If the voided purchase crossed a stamp threshold and LIP
  issued a reward for it, the void also cancels that reward through
  `issued-rewards/cancel` when it is still unredeemed. These are two LIP calls,
  not one database transaction: the BFF runs them as one void operation with
  idempotency keys derived from the void id, cancel first, so a retry completes
  both and never double-applies.
- *(amended by A1)* If that reward was already redeemed, the cashier's void is
  blocked; only the owner can resolve it (task 3.6).
- After 10 minutes, or for another staff member's purchase, only the owner can
  correct it (task 3.6).
- Task 3.6 must check and record how LIP's stamp reset / balancing adjustment
  behaves when an order that crossed the threshold is adjusted. *(Answered at
  source level by A1; task 3.6 still confirms it with executable tests.)*

*Redeeming free-item rewards*
- The cashier hands over the item; the reward runs reserve → capture
  (PD-003). Its `product_ids` / `category_ids` are descriptive only in the MVP.
- Task 3.4 must check whether LIP allows reserve/capture against a synthetic
  order with no item lines, or without an order. If not, raise a new decision;
  do not patch around it. *(Answered at source level by A1: a zero-value
  synthetic order with one line is valid; task 3.4 still confirms it with
  executable tests.)*

Date / approved by: 2026-11-06, project owner.

### Amendment A1 — 2026-11-12: void with automatic stamp restore (Option A)

Context — facts from source inspection on 2026-11-12 (pinned commit; source
read only, **not executed**):
- In stamp programs LIP issues ⌊balance / threshold⌋ rewards when stamps are
  accrued and resets the card by that many thresholds
  (`packages/reference/src/engine.ts`, reset-mode issuance). The reset ledger
  entries carry no `order_id`, so they are not reversed when the order is
  voided.
- A void claws back exactly the stamps that order earned, minus earlier
  adjustments to it; it is not capped at the current balance, and the ledger
  has no balance floor, so the card can go negative.
- Cancelling the issued reward does not give the stamps back. Manual
  adjustments never issue rewards.
- So the original wording ("cancel the reward, then void") leaves the card
  short or negative whenever the voided purchase triggered a reset.
- A zero-value order with one line is valid
  (`packages/protocol/src/validation.ts`); orders need at least one line.

Decision: **Option A — automatic compensating restore.** This replaces the
second and third bullets of *Fixing a wrong amount* above.

Scope:
- Stamp programs only. Cards always reset on issue (PD-012). Every stamp
  clawback — a cashier void, an owner void, an owner full refund — uses this
  algorithm.
- Points programs only claw back points; no reward is cancelled and no restore
  runs.

*Purchase record (kept by the BFF for every stamp purchase)*
- The reward marker: the highest stamp-reward sequence number already issued
  to that member before the purchase.
- The balance before and after the purchase, the threshold t, and the program
  revision.
- **The authoritative stamps-earned amount `a`, taken from the accrual
  result LIP returned for this purchase and stored with the record.** The void
  plan always reads `a` from this record; it is never recomputed from the
  current program settings, which may have changed since the purchase.

*Plan* (computed once, saved, then replayed — never recomputed)
- a = stamps the purchase earned; cur = current card balance.
- k = max(0, ⌈(a − cur) / t⌉) rewards must be cancelled; restore = k × t
  stamps. The final balance is cur + k × t − a, which always lies in [0, t).
- Candidates: rewards named `stamp-<member>-<n>` with n above the purchase's
  marker, status `issued`, and no active reservation. Any k candidates are
  correct; the newest are chosen first.

*Preconditions* — if any fails, the void is blocked and goes to the owner:
1. A cashier void: same staff member and within 10 minutes (unchanged).
2. The program has not been republished since the purchase.
3. 0 ≤ cur < t.
4. No other void is in progress for that member.
5. At least k candidate rewards exist.

*Steps* (one void operation, per-member lock, every LIP call idempotent)
1. Cancel each chosen reward through `issued-rewards/cancel`, key
   `void:<void id>:cancel:<reward id>`.
2. Void the order through `orders/adjust`, adjustment id `void-<void id>`.
3. If k > 0, post the system stamp-restore correction of k × t stamps (PD-003
   A2), adjustment id `void-<void id>-restore`.

*Recovery*
- Forward-only: after a crash or error, use the persisted step plan, exact
  request bodies and stable business IDs to verify each uncertain effect in
  authoritative LIP records. A call may have succeeded before the BFF saved
  its result; confirm it or retry idempotently with the same identifiers,
  never create a second effect or recompute the plan. Nothing is rolled back.
- Automatic retries for 15 minutes; then the void is marked *needs owner*.
  The owner either retries it or settles it with a `correction` adjustment.
  Still open after 24 hours → escalated to the Super Admin. Recovery actions,
  reconciliation evidence and decisions are audited; operational alerts
  continue while the case remains unreconciled.
- A void may become terminal only after reconciliation verifies all expected
  reward cancellations, order clawback and, when required, stamp restore
  against authoritative LIP reward and ledger records, including any owner
  settlement. This requirement applies equally to owner and Super Admin
  resolution. Only successful reconciliation clears the durable member flag;
  no force-close or administrative override can clear it while ledger or
  reward inconsistencies remain. Unreconciled cases stay blocked and escalated
  for audited recovery.
- Customer deletion (PD-001 rule 8) is queued while a void is in progress for
  that member.

*Safeguards* (C1–C8, the counterexamples from the 2026-11-12 stress test;
each needs a test in task 3.6)
- **C1 — some candidate rewards are redeemed or reserved, others are free.**
  Choosing the "k most recent" would pick a blocked one and fail needlessly.
  Safeguard: cancel any k cancellable stamp rewards issued since the
  purchase; block only if fewer than k are cancellable.
- **C2 — an owner gift reward.** "Most recent" could cancel the owner's gift
  instead of a stamp-backed reward. Safeguard: only ids matching
  `stamp-<member>-<n>` are candidates; owner gifts use ids that never start
  with `stamp-`, and the BFF never issues a `stamp-` id (an id clash makes the
  engine fail the purchase or silently reuse the reward).
- **C3 — finding "rewards since the purchase" by timestamp.** Same-millisecond
  rewards or gifts could slip in. Safeguard: at purchase time, under the
  member lock, record the highest stamp-reward number (the marker); candidates
  are rewards numbered above it.
- **C4 — crash after the void step, then a retry that recomputes.** The
  balance has already dropped, so a recomputed k would restore too many
  stamps. Safeguard: save the whole plan (cur, a, t, k, chosen reward ids,
  exact request bodies) before the first call and replay it, never recompute.
  The manual-adjustment body must match byte for byte, or a retry is rejected
  as a conflict.
- **C5 — a balance outside [0, t).** Causes: an owner stamp adjustment, a
  stamp clawback that bypasses the algorithm, or a threshold changed by a
  republish. Safeguards: preconditions 2 and 3 above; every stamp clawback by
  anyone uses this algorithm; **an owner stamp adjustment outside a void must
  leave the balance in [0, t) — the BFF rejects an adjustment that would
  leave that range (manual adjustments never issue rewards)**; reset mode
  stays fixed on.
- **C6 — redeeming a stamp reward without its issued reward.** Reserve
  charges the catalogue cost, which may be 0. Safeguard: stamp rewards are
  reserved only with `issued_reward_id`, and the reward's direct cost is set
  to t (PD-012).
- **C7 — a reservation past its expiry but never reversed.** The stored
  "reserved" status can block cancel until something else triggers expiry.
  Safeguard: the BFF reverses any redemption it abandons (hold per PD-020);
  a void blocked this way retries after the hold time, then goes to the owner.
  Needs an executable test (check (a) below).
- **C8 — any other balance-changing operation for the same member runs
  between void steps.** It changes cur or uses up a chosen reward.
  Safeguard: one per-member lock covers **every operation that can change the
  member's stamp balance or rewards**: purchases, redemptions, voids, owner
  adjustments of any classification, and campaign, automation or import
  grants. A durable "void in progress" flag (saved with the plan) makes the
  BFF refuse each of them for that member with a clear "void in progress"
  error until the flag clears. Only the void's own steps and the owner's
  settlement of a *needs owner* void (see *Recovery*) bypass it.
  The flag clears only after the reconciliation in *Recovery* succeeds. An
  unresolved void is *needs owner* after 15 minutes and escalates to the Super
  Admin after 24 hours; escalation or administrative closure alone never clears
  the flag. The block is per member only; other customers are not affected.

*Redemption-only visits*
- A customer who redeems without buying gets a synthetic zero-value order in
  its own `order_id` namespace. It is never accrued.
- The minimum eligible spend is at least 1 piaster (PD-012), so a zero-value
  order can never earn.

*Verification status* — the design above is an approved product requirement.
These technical behaviours are **not yet verified by execution** and must be
proven on Linux with PostgreSQL 17 before task 3.6 is done:
- (a) whether a stale stored "reserved" status blocks `issued-rewards/cancel`
  (C7);
- (b) whether idempotency records and lazily applied expiry are persisted in the
  same commit;
- (c) serialization through Cloud's managed data plane;
- (d) crash recovery and the per-member lock;
- (e) fixed-format member ids, so `stamp-<member>-<n>` parsing cannot be
  confused;
- (f) characterization tests that pin the engine's `stamp-<member>-<n>` and
  `-reset` naming, so an upstream change is detected.

Date / approved by: 2026-11-12, project owner.

## PD-009 — Wallet loyalty passes (Google Wallet first) — Approved (2026-11-06, conditional)

Context: hard constraint of zero added cost at launch (no paid accounts or
subscriptions until the first paying cafés). Research on 2026-11-06 (official
Google pages; unverified items marked): passes can be saved from a website via a
signed "Save to Google Wallet" link (service account, no Android app);
`LoyaltyObject.rotatingBarcode` supports TOTP-SHA1 codes; at most 3 push
notifications per pass per 24 h (assume messages and field updates share it);
field updates notify only for balance fields; users can disable pass
notifications and there is no delivery receipt; `accountName` / `accountId`
are optional; `LocalizedString.translatedValues` exist (Arabic RTL display
unverified); Egypt is on Google Wallet's country list (real use unverified);
no fee is stated anywhere, but "free" is not stated either (unverified); the
publishing docs allow "a real business, organization, or individual". Apple
Developer Program: $99/year (verified).

Decision: each customer membership can be added as a **Google Wallet loyalty
pass**. Apple Wallet is deferred. Priority **P1**, roadmap task **6.8**.

**Conditions** (checked during issuer setup, before task 6.8 is done; PD-009
reopens if any fails):
1. Zero cost confirmed: no fee, and no billing account or card required.
2. Publishing approval granted, with the platform as the single issuer; each
   café's pass class uses its logo with the café's agreement, written into the
   café onboarding terms.
3. Real-device test on Android in Egypt: the pass saves; the staff surface scans
   the rotating code; Arabic displays right-to-left; a notification arrives.
4. Wallet save/delete callbacks (`callbackOptions`) exist and work (from memory,
   not verified by the research).

Consequences:

*Issuance and data*
1. The "Add to Google Wallet" button appears only after verified OTP sign-in
   (PD-004). One pass per membership (per café, PD-001). Closing the membership
   or deleting the account sets the pass expired/inactive via the API (part of
   PD-001 rule 8). A phone change does not affect the pass (it belongs to the
   stable customer id).
2. The pass carries only café brand, balance/stamps, reward status and an opaque
   pass id; no phone and no name (`accountName` is optional). The pass id is a
   separate random id — not the customer id or LIP `member_id` — so pass data
   cannot be linked to our records from outside. The 0.10 legal opinion must
   also cover Google Wallet as a provider holding data abroad.
3. Pass text follows PD-007: `defaultValue` in the café's main content language,
   `translatedValues` for the other language.

*Code on the pass*
4. The pass shows a **rotating TOTP code** (`rotatingBarcode`) and is treated as
   a customer device under PD-003 A1 (see PD-003 A1 addendum): it counts toward
   the 3-device limit, can be revoked, its key is replaced via the API from time
   to time, and each code is single-use on the server and bound to
   {customer, pass, café}. The code contains the random pass id, never a
   customer id. No static fallback barcode.
5. If the real-device test (condition 3) fails for the rotating code, the pass
   carries **no barcode** (balance + notifications only; the customer opens the
   web app to show the code). A static QR is rejected: it would let a cashier
   award a friend from a screenshot without the friend present, the case PD-003
   removed.
6. The pass code is for **earning only**. Redemption always starts from the
   customer's "Redeem" button in the web app (reward QR, PD-003). The pass shows
   reward status and a link to the web app.

*Notifications and channel order*
7. Stamp added / points earned → balance field update with `notifyPreference:
   NOTIFY`. Reward ready / reward expiring → message with `TEXT_AND_NOTIFY`.
8. Budget: 3 notifications per pass per 24 h. Priority: reward expiring >
   reward ready > stamp added; over budget, update silently.
9. Customers with an active pass (saved and not deleted, per the callbacks) get
   the pass only — no WhatsApp fallback — accepting that delivery cannot be
   confirmed. Customers without a pass get WhatsApp (task 6.5). WhatsApp
   transactional cost therefore scales only with customers who have no pass
   (all iPhone users until Apple Wallet, plus Android users who did not add it);
   the saving cannot be quantified until the WhatsApp utility rate for Egypt is
   verified.
10. No marketing through the pass. Pass messages only concern that customer's
    own card; marketing stays on WhatsApp with per-café consent.
11. Review point: compare the rate of rewards that expire unredeemed for
    pass-only customers vs WhatsApp customers. If pass-only customers lose
    noticeably more rewards, reopen the "no WhatsApp fallback for reward
    expiring" rule. (Passes ship in Phase 6, after the pilot, so the comparison
    runs once task 6.8 has been live for 8 weeks — proposed.)

*Dependencies and Apple*
12. Task 6.8 depends on 6.4 and 3.1. It does **not** depend on 0.11, because the
    docs allow an individual issuer — subject to confirmation during issuer
    setup. If Google requires a business entity after all, add the 0.11
    dependency then.
13. Apple Wallet stays deferred ($99/year Apple Developer Program). Trigger:
    first paying café **and** the owner approves the fee. Until then iPhone
    users use the web-app card (offline per PD-003 A1).

Date / approved by: 2026-11-06, project owner.

## PD-010 — Owner, Super Admin and staff sign-in — Approved (2026-11-12)

Context: PD-004 covers customer sign-in only. Owners, the Super Admin and
staff need their own rules before Phase 2.

Decision:
- **Owner:** phone number + OTP through the PD-004 OTP service. Session 30 days,
  sliding. A fresh OTP is required to create or deactivate staff, publish the
  program, post a manual adjustment, or change the owner's phone number.
- **Super Admin:** OIDC sign-in with MFA enforced by the identity provider. We
  store no Super Admin passwords. The provider is chosen in task 2.2 and must be
  zero-cost or fit the PD-006 budget.
- **Staff:** PIN on a registered branch device (task 2.6).

Consequences:
- Every session (customer, staff, owner, Super Admin) can be revoked.
- Cookies are host-only with the `__Host-` prefix, one per subdomain.
- PD-004's "no outside identity provider" applies to customer sign-in only; the
  Super Admin OIDC provider does not conflict with it.
- **Depends on task 0.11** for live OTP delivery to real owner numbers (sender
  registration, Meta verification).

Date / approved by: 2026-11-12, project owner.

## PD-011 — Café onboarding by invitation — Approved (2026-11-12)

Context: Cloud invitations are email-only and cannot grant the owner role
(`apps/cloud/src/types.ts`, source read 2026-11-12).

Decision:
- The Super Admin provisions each café through Cloud: operator tools in P0, the
  console UI in task 6.7.
- The owner receives a single-use invite bound to the owner's phone number,
  valid 72 hours, stored hashed in our layer (not a Cloud invitation).
- The owner accepts the invite, signs in by OTP, and then sets up the program.

Consequences:
- Self-serve café sign-up is P1 (backlog).
- Task 1.4's "first-stamp time" is measured from invite acceptance.
- **Depends on task 0.11** for live delivery of invites and OTPs to real
  numbers.

Date / approved by: 2026-11-12, project owner.

## PD-012 — Loyalty program rules for P0 — Approved (2026-11-12)

Decision:
- One active program per café, either stamps or points. The type is locked
  after the first publish (LIP also forbids changing the primary unit after
  publish).
- Stamp programs: `reset_on_issue` is always true; the stamp reward's direct
  cost equals the threshold t; stamp rewards are reserved only through their
  issued reward (PD-008 A1).
- Minimum eligible spend is at least 1 piaster, so a zero-value order never
  earns.
- Expiry follows PD-020. Stamps never expire.
- Publishing or changing the program is blocked in the read-only and suspended
  stages (PD-005 A2).

Consequences:
- Several programs per café go to the backlog.
- The program wizard (task 3.7) offers only these options.

Date / approved by: 2026-11-12, project owner.

## PD-013 — Customer data visible to cafés — Approved (2026-11-12; legal confirmation pending in task 0.10)

Decision:
- **Owner** sees each customer's first name, card progress, visit history and
  the last 3 digits of the phone number. Search is by first name plus last 3
  digits only.
- **Cashier** sees first name and card progress only.
- No customer export in P0.
- No personal data is written to LIP's `/platform/v1` customer records
  (`packages/server/src/customer-data.ts`); the customer directory (G-01) is the
  only store.
- Every Super Admin read of customer directory data is audited with a reason.

Consequences:
- **Depends on task 0.10:** the legal opinion must confirm showing the last 3
  digits to owners and the owner search. If it does not, this decision reopens.

Date / approved by: 2026-11-12, project owner.

## PD-014 — Roles and where permissions are enforced — Approved (2026-11-12)

Context: on `/lip/v1` the server checks only the permission; `protocol:write`
covers every write, including manual adjustments, and a key's
`allowed_location_ids` is not enforced there (`packages/server/src/server.ts`,
source read 2026-11-12, not executed).

Decision:
- P0 roles: Super Admin, Owner, Cashier, Customer. Branch Manager is P1.
- The BFF enforces every product permission. Tenant and branch always come from
  the session or registered device, never from the request body.
- An owner awards or redeems only through a staff session on a registered
  device.
- One owner per café.

Consequences:
- The cashier fork patch to `access-control.ts` (G-05) becomes optional; it is
  made only if a later task needs it, and logged in `07-fork-patches.md`.
- Task 2.5 proves cross-branch and cross-tenant denial with tests.

Date / approved by: 2026-11-12, project owner.

## PD-015 — Rewards in P0 — Approved (2026-11-12)

Decision:
- Rewards are free items only. Discount rewards are P1.
- At most one reward per order, enforced by the BFF with a unique constraint
  (concurrent attempts included).
- A redemption never takes a balance below zero. A clawback (void, refund) may.

Consequences:
- Free-item redemptions write no ledger entry in LIP, so "rewards redeemed"
  reports count reservation (capture) records, not ledger entries.
- Reward stacking goes to the backlog.

Date / approved by: 2026-11-12, project owner.

## PD-016 — Messaging in P0 — Approved (2026-11-12)

Decision:
- P0 sends OTP messages only. Marketing consent is still captured at sign-up so
  later campaigns can use it.
- The customer app shows balances that will expire soon (instead of a message).

Consequences:
- Transactional and marketing messages stay in their later tasks.
- **Depends on task 0.11** for live delivery (sender registration, Meta
  verification).

Date / approved by: 2026-11-12, project owner.

## PD-017 — Billing scope in P0 — Approved (2026-11-12)

Decision:
- The manual billing core (task 5.5) is P0: payment records, set/extend the
  period, and the automatic stage engine.
- Stages and their permissions follow PD-005 A2.
- The owner sees the plan, end date and current stage in P0. The renewal
  reminder stays in task 6.2.

Date / approved by: 2026-11-12, project owner.

## PD-018 — Owner dashboard scope in P0 — Approved (2026-11-12)

Decision:
- The 8 dashboard pages planned in task 4.4.
- The plan, end date and stage are shown on Overview and Settings.
- The "rewards redeemed" KPI counts reservation (capture) records (PD-015).

Date / approved by: 2026-11-12, project owner.

## PD-019 — Support and corrections — Approved (2026-11-12; legal and messaging dependencies pending)

Decision:
- Support is a platform WhatsApp number with a phone fallback, on a number
  separate from the OTP and marketing senders.
- Balances are corrected only through voids (PD-008 A1) or owner adjustments
  with a classification (PD-003); support staff never change balances.
- Task 1.2 writes the recovery procedures: customer account recovery, and owner
  recovery (out-of-band identity check, revoke all sessions, audited).
- A ticketing system is P1.

Consequences:
- **Depends on task 0.10:** support chats are held by a provider outside Egypt.
- **Depends on task 0.11:** the support number needs Meta business
  verification.

Date / approved by: 2026-11-12, project owner.

## PD-020 — Operational defaults — Approved (2026-11-12)

Context: `04-business-rules.md` listed many values as "proposed starting
values". These are now approved. "Café setting" means the owner can change it
within the stated range; "platform-fixed" means only we can.

| Setting | Approved value | Who can change it |
| --- | --- | --- |
| Pending claim lifetime / attempts | 15 minutes / 3 attempts | platform-fixed |
| OTP | 6 digits, valid 5 min, resend after 60 s, 5 sends/hour and 10/day per number, 5 wrong attempts; plus IP/device limits, Turnstile and the circuit breaker (PD-004) | platform-fixed |
| Large-bill threshold | 2,000 EGP; re-type above it; reject above 5 × | café setting |
| Void window | 10 minutes | platform-fixed |
| Rewards per order | 1 | platform-fixed (PD-015) |
| Reward expiry | 30 days after issue | café setting, 7–90 days |
| Point expiry | 365 days after earning | café setting: 180, 365, 545 or 730 days, or never |
| Point expiry warning | `warning_days: [30]` | platform-fixed |
| Stamp expiry | never | platform-fixed |
| Minimum eligible spend | 1 piaster | café setting, never below 1 piaster |
| Earn-rate suggestion (points) | 5 points per 100 EGP | wizard suggestion only |
| Subscription stages | grace days 1–7, read-only 8–37, suspended 38+ (Cairo days) | platform-fixed (PD-005 A2) |
| Owner session | 30 days, sliding (PD-010) | platform-fixed |
| Customer session | 90 days, sliding (PD-004) | platform-fixed |
| Owner invite | 72 hours, single-use (PD-011) | platform-fixed |
| Reward reservation hold | 120 seconds, then the BFF reverses it | platform-fixed |
| Void retries | 15 minutes, then *needs owner*; Super Admin after 24 hours | platform-fixed |
| Phone digits shown to owner | last 3 (PD-013; task 0.10) | platform-fixed |

Point expiry restrictions:
- "Never" versus "expiring" is locked after the café's first purchase.
- A change of duration applies only to points earned after the change; LIP
  keeps existing point lots as they are.
- A void consumes the soonest-expiring points first (LIP behaviour; accepted).
- Expiry is shown as date and time in Cairo (PD-007 C1).

Date / approved by: 2026-11-12, project owner.

---

Template for new entries:

```
## PD-0XX — Title — Proposed|Approved
Context:
Decision:
Consequences:
Date / approved by:
```
