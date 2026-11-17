# Decision log

Status values: **Approved** (binding), **Proposed** (needs owner sign-off; do
not implement as if approved), **Superseded**.

---

## PD-001 — Universal customer account — Approved; amended 2026-11-14 (A1: category-agnostic platform, cafés and restaurants pilot)

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

### Amendment A1 — 2026-11-14: category-agnostic platform, cafés and restaurants pilot

Context: PD-046 item 10 (2026-11-13) made merchant branding category-agnostic and flagged the platform's target market to the owner.

Decision (owner-approved):
1. The platform is architecturally category-agnostic and should support different types of merchants.
2. The initial operational pilot stays focused on cafés and restaurants.
3. Documentation distinguishes general platform capability from initial pilot scope.

Recorded consequences (written by the agent to apply the decision; not separately approved, the owner may object):
- A merchant is a tenant, the glossary's "Business", as already defined in PD-046 item 10. LIP's protocol `merchant_id` and `brand_id` order fields keep their `spec/` meaning.
- Requirements written for cafés describe the pilot. Architecture, data model and contracts must not assume a business category.
- Extending a café-specific operational rule (for example a foodservice-profile rule) to other categories needs its own decision.
- Rules 1–8 above are unchanged.

Consequences: the product brief's target-market row, the glossary's Business row and a terminology clarification in `specs/002-p0-prd/spec.md` were updated on 2026-11-14. `AGENTS.md` §1 and constitution Article I still describe the platform as for cafés and restaurants; changing them needs a separate owner instruction (the constitution has its own amendment process).

Date / approved by: 2026-11-14, project owner.

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
  cooldown 60 s; per phone ≤ 5 sends in any rolling 60 minutes, shared across
  WhatsApp and SMS and all OTP purposes (clarified 2026-11-13 by PD-042), and ≤ 10/day; ≤ 5 wrong attempts per
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

## PD-005 — Billing provider: Kashier — Approved (2026-11-06); amended 2026-11-06 (A1: manual billing at launch, Kashier deferred); amended 2026-11-12 (A2: subscription stage permissions); amended 2026-11-13 (A3: stage permissions for settings, branch, access-recovery and program-draft actions); amended 2026-11-13 (A4: no new pending claims while suspended); amended 2026-11-14 (A5: brand palette changes in every stage; A5 refined the same day: U-1, U-2, U-6)

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

### Amendment A3 — 2026-11-13: stage permissions not listed in A2

Context: A2 fixes ten actions. The P0 owner API (`specs/002-p0-prd/contracts/owner-api.md`) has further owner actions that A2 does not list. At Gate 2 the agent proposed cells for them by applying A2's pattern; the project owner approved them on 2026-11-13 with two refinements (Q5, Q6). A2's ten rows are unchanged.

Decision: these cells extend the A2 table (✓ allowed, ✗ refused; same Cairo stage days).

| Action | Grace | Read-only | Suspended |
| --- | --- | --- | --- |
| Change the main language setting | ✓ | ✓ | ✓ |
| Change the amount label setting | ✓ | ✓ | ✓ |
| Change the large-bill threshold (FR-025) | ✓ | ✓ | ✓ |
| Change reward expiry, 7–90 days (FR-045; a reward change under FR-048) | ✓ | ✗ | ✗ |
| Create a branch | ✓ | ✗ | ✗ |
| Update a branch's names or opening hours | ✓ | ✓ | ✓ |
| Deactivate a branch (protective, FR-081) | ✓ | ✓ | ✓ |
| Reactivate a branch | ✓ | ✗ | ✗ |
| Issue a device enrollment code (registers a device) | ✓ | ✓ | ✗ |
| Recover access of an existing staff profile: re-verify its phone, reset its PIN | ✓ | ✓ | ✓ |
| Issue a PIN setup code for the existing owner staff profile (recovery) | ✓ | ✓ | ✓ |
| First-time setup of the owner staff profile | ✓ | ✓ | ✗ |
| Edit the program draft without publishing | ✓ | ✓ | ✗ |

Rules:
- Suspended allows only **recovery** of access for staff profiles (including the owner staff profile) and devices already registered and authorized before suspension. It never allows enrolling a new staff member or registering a new device. Adding staff stays refused in read-only and suspended (A2).
- Publishing a program stays refused in read-only and suspended (A2, FR-048). A draft edited in read-only takes effect only when it is published after payment.
- Denied actions return the existing BFF stage error (`403 stage_forbidden` with `details.stage`). The stage is computed and enforced in our layer, as A2 states.

Consequences:
- A suspended café can still honour rewards, void, correct, revoke and rotate QR on devices it already has. Replacing a lost or broken device needs a new enrollment, so it waits for payment (or uses another already-registered device).
- OD-01 (PIN, session and code lifetimes; whether enrollment or PIN setup codes need owner step-up) is **not** resolved by this amendment; it stays an open owner decision.

Date / approved by: 2026-11-13, project owner (proposed by the agent at Gate 2, refined by the owner for Q5 and Q6).

### Amendment A4 — 2026-11-13: new pending claims while suspended

Context: A2 refuses **confirming** a pending claim in the suspended stage, but does not say whether a customer may **create** one. The project owner approved refusing creation while suspended (JG-09, PD-040 C4, PD-041). On 2026-11-13 the owner approved recording that rule in this permission table (PD-042). A2's ten rows and A3's thirteen rows are unchanged.

Decision: this cell extends the A2 and A3 tables (✓ allowed, ✗ refused; same Cairo stage days).

| Action | Grace | Read-only | Suspended |
| --- | --- | --- | --- |
| A customer creates a new pending claim at a branch (Method A, `contracts/customer-api.md` § Pending claims) | ✓ | ✓ | ✗ |

Rules:
- Grace and read-only keep today's behaviour: creating a claim stays allowed wherever A2 allows confirming one. A4 adds no restriction in those stages.
- In the suspended stage, creation is refused with the existing stage error (`403 stage_forbidden` with `details.stage`), as A3's rule for denied actions states. No new error code is introduced.
- A4 cancels no existing claim. A claim already open when the café becomes suspended keeps its 15-minute lifetime (FR-029). It cannot be confirmed while suspended (A2), so it expires.
- A4 decides only claim creation. Other customer claim operations, such as reading a claim's status or cancelling one's own claim, are not stage cells here. They remain under JG-10/F-10.
- Redemptions, voids, corrections, service recovery, revocation, QR rotation and A3 access recovery stay allowed when suspended, exactly as A2/A3 say.

Consequences:
- The stage table now has 72 cells: A2 30, A3 39, A4 3. FR-092, SC-008, PD-017, the planning artifacts (execution briefs, contracts, T028, T033, T046) and their tests use all three tables.
- This settles PD-041's two open JG-09 items: the stage cell and the refusal contract. The JG-08 (before first publication) refusal contract is still not specified.

Date / approved by: 2026-11-13, project owner (PD-042 item 1).

### Amendment A5 — 2026-11-14: brand palette changes (PD-046 MB-03)

Context: PD-046 lets the owner change the merchant's three brand colours (FR-136). A2–A4 have no cell for it.

Decision: this cell extends the A2–A4 tables (✓ allowed, ✗ refused; same Cairo stage days).

| Action | Grace | Read-only | Suspended |
| --- | --- | --- | --- |
| The owner changes or resets the merchant's brand palette (PD-046, FR-136) | ✓ | ✓ | ✓ |

Rules:
- Owner role only, with a valid, trusted and authorized owner session. An ordinary change needs no fresh one-time code.
- CSRF protection on the browser request, rate limiting, and an audit row for every change and reset (FR-150).
- *(Superseded 2026-11-14 by the refinement below.)* Additional verification (the existing owner step-up, `401 step_up_required`) is required when session trust or risk policy requires it.
- *(Superseded 2026-11-14 by the refinement below.)* The risk trigger and the rate-limit value are **not yet defined**. They are open details of the `branding-contracts` gate (`specs/002-p0-prd/tasks.md`).
- **Refinement (owner-approved 2026-11-14; PD-046 U-1, U-2, U-6):**
  - Reauthentication (`401`, then owner sign-in) when the session is expired, invalid or revoked. No additional one-time code for ordinary changes and no risk-detection subsystem in P0.
  - Per rolling 60 minutes, enforced atomically: at most 10 successful saved changes per merchant (resets and the onboarding save count; local previews do not) and 30 authenticated mutation attempts per owner account. Exceeded → `429` with a retry indication.
- Agent note (not separately approved): a palette change moves no value and changes no access, so allowing it while suspended allows no action that A2–A4 deny.

Consequences:
- The stage table now has 75 cells: A2 30, A3 39, A4 3, A5 3.
- T028 transcribes 72 cells and does not add actions outside A2–A4; `research.md` (stage enforcement) also says 72 cells. A reviewed revision at Gate 2 must add the A5 cells before T081 enforces this cell.
- No error code is added.

Date / approved by: 2026-11-14, project owner (PD-046 MB-03; proposed by the agent on 2026-11-13, refined by the owner with rate limiting and risk-based additional verification).

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

## PD-008 — Purchase capture: bill amount only (roadmap task 0.6) — Approved (2026-11-06); amended 2026-11-12 (A1: void with automatic stamp restore); amended 2026-11-12 by PD-030 (amount corrections) and PD-037 (points void reverses the original accrual)

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
- Stages and their permissions follow PD-005 A2, A3 and A4 (A4 added 2026-11-13, PD-042).
- The owner sees the plan, end date and current stage in P0. The renewal
  reminder stays in task 6.2.

Date / approved by: 2026-11-12, project owner.

## PD-018 — Owner dashboard scope in P0 — Approved (2026-11-12)

Decision:
- The 8 dashboard pages planned in task 4.4.
- The plan, end date and stage are shown on Overview and Settings.
- The "rewards redeemed" KPI counts reservation (capture) records (PD-015).
- Fraud alerts live inside Overview (PD-027); the page count is unchanged.

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
| OTP | 6 digits, valid 5 min, resend after 60 s, 5 sends per number in any rolling 60 minutes (shared across WhatsApp and SMS and all OTP purposes; clarified 2026-11-13 by PD-042) and 10/day per number, 5 wrong attempts; plus IP/device limits, Turnstile and the circuit breaker (PD-004) | platform-fixed |
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
| Paper-card migration window | 60 days after the café's first program publish (PD-021) | platform-fixed |
| Pending migration lifetime | 15 minutes; one per member per program (PD-022) | platform-fixed |
| Active points rewards | at most 5 per program (PD-024) | platform-fixed |
| Repeat-award confirmation | new award to the same customer at the same café within 10 minutes (PD-027) | platform-fixed |
| Fraud alert: rapid awards | more than 3 awards to one customer at one café in a rolling 60 minutes (PD-027) | platform-fixed |
| Fraud alert: out of hours | more than 30 minutes outside the branch's opening hours (PD-027) | platform-fixed |
| Fraud alert: staff concentration | at least 20 awards in a rolling 7 days, more than 40% to the staff member's top 3 customers (PD-027) | platform-fixed |

Rows citing PD-021 to PD-027 were added on 2026-11-12 with those decisions.

Point expiry restrictions:
- "Never" versus "expiring" is locked after the café's first purchase.
- A change of duration applies only to points earned after the change; LIP
  keeps existing point lots as they are.
- A void consumes the soonest-expiring points first (LIP behaviour; accepted).
- Expiry is shown as date and time in Cairo (PD-007 C1).

Date / approved by: 2026-11-12, project owner.

## PD-021 — Paper stamp-card migration — Approved (2026-11-12)

Context: customers of pilot cafés already hold paper stamp cards. LIP has the
`migration` adjustment classification (`packages/protocol/src/loyalty.ts`);
PD-005 A2 already makes it owner-only, allowed only in the grace stage, and
never a bypass for `correction` or `service_recovery`.

Decision:
- P0 supports a one-time move of a paper stamp card onto a member's stamp
  card. Stamp programs only; points migration is not in P0.
- Only the owner, through a staff session on a registered branch device
  (PD-014), after a fresh owner OTP (PD-010).
- Only during the first 60 days after the café's first program publish, and
  only in stages where `migration` is allowed (PD-005 A2).
- The resulting balance must stay below the threshold t: migrated stamps ≤
  t − 1 − current balance. A request that would reach t is refused, so the
  card stays in [0, t) (PD-008 A1, C5).
- At most one successful migration per member per program.
- Posted as an owner manual adjustment classified `migration` with a stable
  business id (idempotent, PD-003). It runs under the per-member lock, is
  refused while a void is in progress for that member (PD-008 A1, C8), and
  concurrent requests can never post two migrations.
- Audit record: balance before and after, stamps migrated, time, owner
  identity, staff device and branch, migration reference, the customer's
  confirmation and the paper-card attestation (PD-022).

Consequences:
- Cashiers gain no new value path; their manual-adjustment cap stays 0.
- Built in task 4.7; shown in the journeys of tasks 1.2 and 1.4.

Date / approved by: 2026-11-12, project owner.

## PD-022 — Customer confirmation of a paper-card migration — Approved (2026-11-12)

Decision:
- The owner creates a *pending migration* on the staff device; nothing is
  posted yet.
- The customer's app shows the café name and the exact stamp count; the
  customer explicitly accepts or declines.
- One pending migration per member per program. It expires after 15 minutes
  (platform-fixed, PD-020). An expired or declined request can never be
  posted.
- Posting needs both the customer's acceptance and the owner's attestation
  that the paper card was collected or marked VOID.
- At posting the BFF re-checks atomically, under the member lock: the 60-day
  window, the billing stage, the one-migration limit, the current balance and
  the resulting-balance limit, and that no void is in progress. Posting is
  idempotent and safe under concurrent requests.
- The audit trail records both confirmations and the final outcome (posted,
  declined, expired or refused).

Consequences:
- P0 sends OTP messages only (PD-016), so the request appears in the app and
  is not messaged.

Date / approved by: 2026-11-12, project owner.

## PD-023 — Customer data collected at join — Approved (2026-11-12; legal confirmation pending in task 0.10)

Decision:
- Required: a phone number verified by OTP (PD-004) and a first name.
- The first name is stored once on the universal customer account (PD-001)
  and the customer can edit it; joining another café does not ask again.
- Marketing consent is optional, explicit, unchecked by default and recorded
  per café (purpose, policy version, source, time). Declining never blocks
  loyalty enrollment. Service notices are kept separate from marketing
  consent.
- Language follows PD-007: Arabic by default regardless of browser or phone
  language; the customer can switch; the choice is stored on the account (in
  a cookie before sign-in).
- Not collected in P0: birthday, last name, gender, email. An optional
  birthday arrives with the P1 birthday automation (task 6.4).

Consequences:
- Data minimisation: the directory (task 2.3) may define fields for later,
  but P0 collects nothing beyond the above.
- **Depends on task 0.10** for final legal compliance.

Date / approved by: 2026-11-12, project owner.

## PD-024 — Reward catalogue in P0 — Approved (2026-11-12)

Decision:
- Free items only (PD-015); no money, percentage or cash-value rewards.
- A stamp program has exactly one reward.
- A points program has up to 5 active rewards, each with a positive whole
  number of points as its cost.
- Each reward has a name in the café's main content language (required), and
  an optional second-language name and description (PD-007).
- The customer chooses the points reward at redemption. The cashier confirms
  handing over the item; P0 does not check POS items (PD-008).
- Only the owner configures rewards; every change is audited.
- An issued reward keeps an immutable snapshot of what was promised (PD-025).
- Unchanged: stamp reset on issue (PD-012), void recovery (PD-008 A1), one
  reward per order (PD-015).

Date / approved by: 2026-11-12, project owner.

## PD-025 — Program and reward changes after the first publish — Approved (2026-11-12); item 4 for voids enforced by PD-037

Decision:
1. The program type (PD-012) and the stamp threshold t are immutable after
   the first publish.
2. Reward names and descriptions are display text stored and updated entirely
   in the BFF (PD-007). Changing them does not republish the LIP program, so
   it never triggers PD-008 A1 precondition 2.
3. Changing the stamp reward's item applies only to rewards issued after the
   change. Issued rewards keep their snapshot and stay redeemable until their
   own expiry.
4. Points: an earn-rate change applies only to future accruals; a reward-cost
   change applies only to new reservations.
5. A points reservation snapshots the reward id, cost and terms when it is
   created; a concurrent change never alters it.
6. Deactivating a points reward blocks new reservations; existing reservations
   complete or reverse normally.
7. At most 5 active points rewards; records of deactivated rewards are kept
   for audit and for outstanding reservations.
8. Every change is owner-only, needs a fresh OTP (PD-010) and is audited. It
   is blocked in the read-only and suspended stages (PD-005 A2, PD-012).
9. PD-008 A1 stamp-void safety, the PD-020 expiry rules and the accounting
   invariants are unchanged.

Consequences:
- Any LIP republish of a stamp program still sends cashier voids of earlier
  purchases to the owner (PD-008 A1 precondition 2); keeping display text in
  the BFF avoids that for wording changes.
- Task 3.4 verifies that LIP fixes a reservation's effect at reserve time.

Date / approved by: 2026-11-12, project owner.

## PD-026 — Branches in the café's program — Approved (2026-11-12)

Decision:
- Every active branch takes part in the café's single program (PD-012);
  customers earn and redeem at any active branch of that café.
- Deactivating or reactivating a branch is owner-only and audited.
  Deactivation immediately blocks new operations from the branch's staff
  devices, staff sessions and Branch QR, enforced server-side by the BFF.
- Deactivation keeps history, balances and issued rewards; customers use them
  at the café's other active branches.
- Open pending claims and reservations at a deactivated branch never complete
  there: claims are cancelled and reservations reversed under the existing
  rules (PD-020 hold, reservation recovery), with no double redemption and no
  balance loss.
- Each branch has weekly opening hours in `Africa/Cairo`, with overnight
  shifts and closed days. They are used only for fraud alerts (PD-027) and
  never block a transaction.
- Customer history shows the branch of each visit; owner reports filter by
  branch.

Consequences:
- The LIP location registry has an `active` flag
  (`packages/server/src/locations.ts`, source read 2026-11-12). Whether
  `/lip/v1` refuses an inactive location is not verified, so BFF enforcement
  is the control (PD-014).

Date / approved by: 2026-11-12, project owner.

## PD-027 — Fraud alerts v1 — Approved (2026-11-12)

Decision:
- Alert-only: an anomaly never blocks a transaction by itself. Authorization,
  idempotency, transaction limits and accounting safeguards stay enforced.
- Rapid awards: more than 3 successful awards to one customer at one café
  within a rolling 60 minutes.
- Repeat-award confirmation: a genuinely new award to the same customer at
  the same café within 10 minutes needs the cashier's explicit confirmation.
  Idempotent retries of the same operation do not trigger it. The prompt
  shows no customer data beyond what the cashier already sees (PD-013): no
  time, count or history.
- Out of hours: a successful award, redemption or claim confirmation more
  than 30 minutes outside the branch's opening hours (PD-026), in
  `Africa/Cairo`, overnight shifts supported.
- Staff concentration: over a rolling 7 days, once a staff member has at
  least 20 successful awards, more than 40% of them went to that staff
  member's 3 most frequently awarded customers combined.
- Alerts appear inside the Overview page (a "needs attention" section and
  count) with links to Transactions, so the 8 pages of PD-018 stay unchanged.
  Each alert shows the rule, branch, staff member, time, masked customer
  identity (first name and last 3 digits, PD-013) and the related
  transactions.
- The owner can mark an alert reviewed, with an audit record. Alerts never
  delete or change transaction history.
- Alerts are deduplicated by rule, subject and window. No WhatsApp, SMS or
  push delivery in P0.
- Thresholds are platform-fixed in P0 (PD-020) and reviewed with pilot data
  in task 5.6.

Date / approved by: 2026-11-12, project owner.

## PD-028 — P0 success criteria — Approved (2026-11-12); amended 2026-11-12 by PD-032 (visit definition, branch attribution) and PD-036 (week-8 cohort threshold)

Decision:
- M5 keeps its gate: four weeks of daily use with zero data-integrity
  incidents.
- Operational go/no-go gates: owner onboarding under 15 minutes (task 1.4);
  median cashier award flow, scan to confirmation, ≤ 10 seconds, measured on
  real pilot transactions; no unresolved critical security, tenant-isolation
  or loyalty-accounting failure.
- Outcome targets, not automatic rejection gates: at least 150 enrolled
  customers across the pilot cafés by week 4; at least a 25% observed 30-day
  repeat rate, assessed at week 8.
- 30-day repeat rate: denominator = customers whose first qualifying visit was
  at least 30 full days before the measurement or assessment date; a repeat =
  a second distinct successful visit within 30 days after the first.
  Idempotent retries, voided transactions and redemption-only orders are
  excluded.
- Week 4 is the operational M5 go/no-go gate (the gates above). At week 4, and
  in any weekly report with no eligible cohort, the repeat rate is labelled
  NOT YET MEASURABLE; missing data is never treated as 0% or as a missed
  target.
- Week 8 follow-up assessment (the 4-week operational pilot is not extended):
  report the eligible cohort size, numerator, denominator and measured repeat
  rate. If the cohort is too small for a meaningful conclusion, label the
  assessment INCONCLUSIVE, document the limitation and recommend a follow-up.
- Weekly per café: repeat rate (or NOT YET MEASURABLE), visit frequency,
  redemption rate, and the share of customers who joined by staff scan versus
  Branch QR.
- Structured owner interviews at weeks 2 and 4: perceived value, cashier
  friction, customer feedback, willingness to continue.
- P0 makes no claim of causal retention lift; that needs a comparison or
  holdout design (task 6.6).
- A missed outcome target requires a documented diagnosis and a follow-up
  decision, not an automatic verdict of failure.

Date / approved by: 2026-11-12, project owner.

## PD-029 — Product name placeholder — Approved (2026-11-12); amended 2026-11-13 (A1: working name for prototype work)

Decision:
- PRD v1.0 uses `[Product]` as the temporary product name.
- The final name has Arabic and Latin forms, is approved before task 1.5 and
  any branding-dependent work, and is checked for domain availability and
  conflicts with Egyptian loyalty/POS brands and trademarks.
- Upstream Crave branding is never reused (task 2.1).
- The final name is recorded as its own decision; naming does not block PRD
  preparation.

Date / approved by: 2026-11-12, project owner.

### Amendment A1 — 2026-11-13: working name for prototype work

The owner approved Option B of `specs/002-p0-prd/prototype/1.5-entry-amendment-impact.md` on 2026-11-13.
- Task 1.5 may **start** with the PD-043 working name ونيس — Wanees.
  - The name is used only in user-visible copy and brand assets (PD-043 item 3).
  - Every prototype screen shows a visible "working name — not final" label.
- The final name (Arabic + Latin) is still approved as its own decision. It is checked for domain availability and for conflicts with Egyptian loyalty/POS brands and trademarks. It is required **before**:
  1. the owner accepts the task 1.5 prototype;
  2. rebrand task 2.1 and T058;
  3. any other branding-dependent work outside the prototype.
- The rest of PD-029 is unchanged. Upstream Crave branding is never reused.

Date / approved by: 2026-11-13, project owner.

## PD-030 — Purchase amount corrections in P0 — Approved (2026-11-12)

Provenance: P0 PRD `/speckit-specify` answer Q3 ("A": full voids only,
reconcile before re-recording); `/speckit-clarify` session 2026-11-12, Q1
("Option A with safeguards" and its refinement); Gate 1 decision D2
(2026-11-12), which defers the customer-absent part.

Decision:
1. P0 has no partial refunds. A purchase that should not have earned at all
   is reversed only by the full void (PD-008, PD-008 A1, PD-037).
2. Customer present: the full void completes and is reconciled first; then a
   genuine new capture with the customer's own code (or a confirmed pending
   claim) runs as a new operation with its own identity. A re-capture is
   refused while the void is unresolved (PD-008 A1 member block). The audit
   links the original purchase, its void and the re-capture.
3. Customer absent (D2): P0 has **no amount-correction path**. The purchase
   stays as recorded unless the owner voids it in full under PD-008 and
   PD-008 A1. Customer-absent amount corrections move to P1 and need their
   own approved accounting design before implementation.
4. An owner manual adjustment of any classification (including
   `service_recovery`) is never an amount correction: it is not linked to the
   purchase as a correction, and the product never presents it as equivalent.
5. Stamp programs: a wrong amount alone changes no stamps (stamps are per paid
   order, PD-008). A purchase that should not have earned at all uses the full
   void.

Superseded: the customer-absent half of the clarify Q1 answer (owner
`correction` adjustment for the exact points difference, including later
distinct corrections) is **Superseded** by item 3. Its open accounting issues
are kept for the P1 design: a persisted, replayable plan; amounts computed as
a difference of rounded totals, not a rounded delta; the expiry of positive
corrections; and interaction with a later void.

Consequences: PRD FR-170–FR-174 and US5; roadmap task 3.6; the P1 backlog.

Date / approved by: 2026-11-12, project owner.

## PD-031 — One Branch QR per branch for joining and claiming — Approved (2026-11-12)

Provenance: `/speckit-clarify` session 2026-11-12, Q2 ("Option A"), and the
owner's approval of FR-032 as written (rotation survival).

Decision:
- Each branch has one printed Branch QR, used both to join the café and to
  start a pending claim. A non-member who scans it signs in and joins that
  café, attributed to that branch; joining alone never creates a purchase or
  grants value; a pending claim needs a separate explicit customer action. An
  existing member's scan may start a pending claim under the claim rules
  (PD-003, PD-020).
- Rotation and deactivation: the server rejects rotated-out QR credentials and
  the QR of a deactivated branch, for joining and for claiming. Rotation stops
  new scans of the old QR only; already-created valid claims keep their
  15-minute lifetime and normal confirmation rules. Branch deactivation still
  cancels open claims (PD-026).

Date / approved by: 2026-11-12, project owner.

## PD-032 — Visit definition and branch attribution — Approved (2026-11-12); amends PD-028

Provenance: `/speckit-clarify` session 2026-11-12, Q3 ("Option A"); Gate 1
decision D4 (option ii).

Decision:
1. A **visit** is one café × customer × `Africa/Cairo` calendar day with at
   least one successful, non-voided qualifying purchase at any branch of that
   café. Same-day purchases, including at different branches of the same
   café, are one visit. Redemption-only orders, owner adjustments, migration
   credits and idempotent retries never count. Purchase and accounting
   records stay separate; only visit analytics aggregate them.
2. Voids: if a day's only qualifying purchase is voided, the day stops
   counting; if another qualifying purchase remains, the day still counts.
3. The same definition applies to visit frequency, first-visit date, the
   30-day repeat rate (a repeat = a qualifying purchase on a different Cairo
   day within 30 days after the first visit) and the week-8 assessment.
4. Branch attribution (D4, option ii): each visit is attributed to the branch
   of that day's first qualifying purchase. When voids change that day's set of
   qualifying purchases, attribution is recomputed: the visit moves to the
   branch of the day's earliest remaining qualifying purchase, or disappears
   when none remains. Each visit belongs to exactly one branch, so branch
   visit totals add up to the café total.
5. Branch-filtered repeat-rate reporting follows the same attribution
   consistently; the exact definition is PD-038 item P5 (Approved).

Consequences: PD-028's "second distinct successful visit" means a visit under
item 1 on a different Cairo day. PRD FR-159, FR-160, FR-162, FR-163;
glossary; roadmap tasks 4.5 and 5.6.

Date / approved by: 2026-11-12, project owner.

## PD-033 — Internal availability SLO for awarding and redemption — Approved (2026-11-12)

Provenance: `/speckit-clarify` session 2026-11-12, Q4 ("Option A"); Gate 1
decision D5 (conservative SLO).

Decision:
1. An internal SLO, not a contractual SLA or customer-facing guarantee.
   Awarding and redemption are measured separately, each per calendar month,
   over the daily window 08:00–02:00 `Africa/Cairo` (the overnight portion
   included).
2. Availability is measured by representative end-to-end checks of real
   service capability, not server uptime or HTTP status alone.
3. Target: at least 99.5% per operation.
4. Monitoring coverage: at least 99.5% of the window's expected minutes must
   have check results. Expected minutes are the actual elapsed minutes of the
   Cairo window, which change on daylight-saving days. (This last sentence is
   a derivation from the approved named-zone rule, PD-007 and Constitution
   Article V, recorded during the Gate 1 review; it is not separate owner
   wording.)
5. No PASS unless the target is met when every missing minute is treated as
   unavailable (worst case). Monitoring gaps never count as uptime; they are
   reported separately and investigated.
6. Every outage longer than 5 minutes is logged (start, end, affected cafés,
   affected operations, recovery details) and reviewed weekly during the
   pilot.
7. PD-003 is unchanged: no offline cashier award and no retroactive cashier
   award; owner `service_recovery` adjustments remain the only recovery for
   purchases lost to an outage.

Consequences: PRD SC-012 and FR-155/FR-156; the FAIL and INSUFFICIENT DATA
labels and the reporting boundaries are PD-038 item P6 (Approved with
revision); the test café is PD-038 item P3.

Date / approved by: 2026-11-12, project owner.

## PD-034 — Owner staff profile at the counter — Approved (2026-11-12)

Provenance: `/speckit-clarify` session 2026-11-12, Q5 ("Option A").

Decision:
- The owner works the counter through a dedicated owner staff profile (own
  PIN, own verified phone), usable only on registered branch devices, under
  the same cashier limits, verification and audit rules.
- The audit keeps both the owner identity and the acting staff profile, with
  branch, device and operation type.
- A staff PIN never grants owner privileges. Owner-only actions need fresh
  owner authentication and explicit authorization even when started from that
  session.
- The PD-003 owner self-award exception stays, specifically identified and
  audited. The 10-minute self-void limit and the 5 × bill safeguard still
  apply. Any approved owner override (PD-008 owner void, owner adjustment
  above 5 ×) is explicit, authenticated and audited, never a silent bypass.
- No duplicate owner account; owner credentials are never exposed to staff
  sessions.

A café has exactly one owner staff profile (PD-038 item P1, Approved).

Date / approved by: 2026-11-12, project owner.

## PD-035 — Plan limits are monitored, not enforced, in P0 — Approved (2026-11-12); amends the business rule on plan limits

Provenance: P0 PRD `/speckit-specify` answer Q1 ("A": monitor, not enforce);
Gate 1 decision D3 (option 5A′).

Decision:
1. Plan limits (customers, branches, messages) are defined per plan (task 1.6)
   and monitored in P0. P0 refuses no join, branch creation, staff creation or
   message because a capacity limit is reached. Automatic enforcement is P1
   task 6.3.
2. Our platform layer keeps the authoritative, uncapped customer and branch
   counts used for monitoring. LIP Cloud usage metrics are not a substitute:
   they have no branch metric and count monthly active members, not total
   customers.
3. LIP Cloud usage recording, if used at all, runs outside the join, award and
   redeem success paths; its failure or refusal never blocks them. P0 never
   relies on "large finite" Cloud hard limits as a bypass.
4. Unchanged and fully enforced: security limits (sign-in, OTP, rate limits
   and the circuit breaker), billing-stage restrictions (PD-005 A2), tenant
   isolation and accounting safeguards.

Consequences: `04-business-rules.md` *Subscriptions* updated; PRD FR-095;
task 5.5 verifies items 1–4, including billing stages.

Date / approved by: 2026-11-12, project owner.

## PD-036 — Week-8 assessment cohort threshold — Approved (2026-11-12); refines PD-028

Provenance: P0 PRD `/speckit-specify` answer Q2 ("A").

Decision: the week-8 assessment always reports the eligible cohort size,
numerator, denominator, measured rate and per-café descriptive breakdowns. It
is a conclusive exploratory assessment only with at least 100 eligible
customers across the pilot cafés; below 100 it is labelled INCONCLUSIVE. It is
neither a statistically proven causal lift nor an automatic go/no-go gate.

Date / approved by: 2026-11-12, project owner.

## PD-037 — A points void reverses the original accrual (fork patch FP-003) — Approved design (2026-11-12); implementation not yet authorized; item 1 refined 2026-11-12 by PD-038 P7 (expired points are not debited again)

Context — executed evidence (2026-11-12; local Windows, Node 22.22.0, vitest
4.1.12; in-memory reference engine through a throwaway test kept outside the
repo; repo unchanged): an order earned 110 points at 10 points per 100; after
the earn rate was republished as 5 per 100, `orders/adjust` type `void` with
the full eligible spend delta (−1,100 minor units) clawed back **−55** instead
of −110; a −1,000 delta gave −50 instead of −100. LIP converts the signed spend delta at the **current** program rate
(`packages/reference/src/engine.ts` 968–990), so after a rate decrease a void
claws back too little; after an increase the clawback is capped at the net
earned, so only decreases under-claw. This contradicts PD-025 item 4 ("an earn-rate change applies only
to future accruals") and item 9 (accounting invariants unchanged).

Provenance: Gate 1 decision D1 (option 6C). Design approval only.

Decision:
1. A void (or full refund — PD-008 A1 *Scope* already treats an owner full
   refund as the same void operation, and P0 has no separate refund, PD-030)
   of a points purchase reverses exactly what that purchase earned, net of earlier adjustments to the same order, whatever
   earn-rate, multiplier or expiry-policy changes happened since.
2. This is implemented as a reference-engine fork patch, **FP-003**, whose
   contract is in `07-fork-patches.md`. Writing the patch, its tests and its
   log entry needs separate owner authorization.
3. Lot consumption is unchanged: a void consumes the soonest-expiring points
   first (PD-020, accepted LIP behaviour).
4. No automated BFF settlement adjustment is added, so PD-003's manual
   adjustment scope is unchanged.

Consequences:
- Task 3.6 must include FP-003 and its tests. An engine without FP-003 does
  not meet PD-025 item 4 for points voids, so the pilot (task 5.6) needs FP-003
  verified.
- Sub-decisions PD-038 P7 (already-expired points) and P8 (missing or
  uncertain accrual) were approved with revisions on 2026-11-12. Before
  implementation approval is requested, the P7 formula must pass the
  executable regression tests of FP-003 verification requirement V1, and the
  owner must decide the unresolved point-lot attribution question returned
  under P7 (known over-debit cases when another void or a redemption consumes
  the purchase's lot), after source-level verification.

Date / approved by: 2026-11-12, project owner (design only).

## PD-038 — Gate 1 interpretations P1–P10 — Approved (2026-11-12); P3, P6, P7 and P8 approved with owner revisions; P7 refines PD-037 item 1

Provenance: drafted by the agent as Proposed interpretations while resolving
the Gate 1 audit (2026-11-12). The agent presented each item to the owner
with its evidence, implications and a recommendation. The project owner
approved them on 2026-11-12 in these words (a later owner instruction the
same day, quoted after this list, tightens P7 and P8 without changing
scope):
- P1: "APPROVE as written."
- P2: "APPROVE, including the minimum-eligible-spend rule for qualifying
  visits."
- P3: "APPROVE WITH REVISION — the dedicated test café must use the same
  production path, remain isolated to test identities, and be excluded from
  billing, plan usage, and all customer/business analytics."
- P4: "APPROVE as written."
- P5: "APPROVE as written, clearly labelling acquisition-branch cohorts
  separately from branch activity."
- P6: "APPROVE WITH REVISION — use the corrected PASS / FAIL / INSUFFICIENT
  DATA definitions. A definite failure must remain FAIL even with inadequate
  monitoring coverage."
- P7: "APPROVE WITH REVISION — avoid double-debiting points already expired
  from the original purchase lot. Validate the proposed reversal formula and
  its handling of corrections, lot consumption, expiry, and negative balances
  through executable regression tests before implementation approval."
- P8: "APPROVE WITH REVISION — recover missing BFF accrual results from
  authoritative LIP ledger records, never by blindly replaying accrual.
  Distinguish a provably zero-accrual purchase from an uncertain or incomplete
  ledger state. Only a verified zero-accrual purchase may be voided without
  loyalty reversal. Uncertain outcomes remain blocked for reconciliation; no
  silent zero assumption."
- P9: "APPROVE as written."
- P10: "APPROVE as written, preserving per-member serialization, durable
  blocking, forward-only recovery, and reconciliation-before-unlock."

Owner follow-up instruction (2026-11-12, after the final review of PD-038),
quoted: "Clearly state that the current FP-003 reversal formula is not
proven safe when points are consumed by redemptions or other voids before
expiry." "Do not treat the formula as an implementation-ready algorithm."
"Missing accrual records must fail closed unless an authoritative, complete
ledger state proves that the purchase earned zero points." "Clarify the
missing-accrual evidence and recovery requirements." "Keep the point-lot
attribution algorithm explicitly unresolved and requiring separate owner
approval, source-level verification, and executable regression tests." "Do
not change the approved product scope, invent point-lot accounting rules, or
implement FP-003."

The wording of P3, P6, P7 and P8 below is the agent's drafting of those
revisions. The P7 formula is the one the owner reviewed; it stays subject to
the P7 verification condition. Technical assumptions behind P3, P7, P8 and P10
are listed as verification requirements V1–V7 in `07-fork-patches.md`
(FP-003); none has been executed yet.

Decision:

- **P1** (FR-016): a café has exactly one owner staff profile.
- **P2** (FR-159): a *qualifying purchase* is a real customer purchase captured
  by a staff session (staff scan or a confirmed pending claim), not voided,
  whose bill amount met the café's minimum eligible spend and channel rules in
  force **at the time of purchase**. Its representation as a synthetic order
  line (PD-008) does not exclude it. A purchase below the café's minimum
  eligible spend earns nothing and is not a qualifying purchase, so it
  creates no visit.
- **P3** (FR-155, FR-159): test, probe and monitoring transactions never count
  in any customer or business analytics, KPI or success metric. SLO checks run
  against a dedicated non-customer test café that:
  1. runs on the same production path as the pilot cafés, so its checks
     represent real service capability (PD-033 item 2);
  2. uses only test identities; its staff, devices and credentials can act
     only on the test café;
  3. is excluded from billing, plan-usage monitoring (PD-035) and all customer
     and business analytics.
- **P4** (FR-162): "the day's first qualifying purchase" is ordered by
  server-recorded capture time, ties broken by the stable purchase id.
- **P5** (FR-163, US8): branch-filtered 30-day repeat rate is an
  acquisition-branch cohort report, labelled as such and distinct from branch
  activity reports: a customer belongs to the cohort of the branch their first
  café visit is attributed to; a repeat is a later café visit at any branch
  within the 30-day window. Branch cohorts partition the café cohort. When a
  void changes that attribution, the customer moves cohort in later reports.
  Acquisition-branch cohort reports are always labelled as such and shown
  separately from branch activity reports.
- **P6** (SC-012): for each operation and calendar month, with expected
  minutes M, observed minutes O and successful minutes S:
  1. **PASS** only when coverage O ÷ M ≥ 99.5% and worst-case availability
     S ÷ M ≥ 99.5%.
  2. Otherwise **FAIL** when the best case (S + (M − O)) ÷ M < 99.5%: the
     target is missed even if every missing minute were available. A definite
     failure stays FAIL whatever the monitoring coverage; coverage below 99.5%
     is reported alongside it.
  3. Otherwise **INSUFFICIENT DATA**, for example coverage below 99.5% while
     the best case still meets the target, or no observations (O = 0).
  4. A partial month (pilot start or end) is reported over its elapsed days
     and labelled partial. Each daily window belongs to the day it starts on;
     M counts only distinct elapsed minutes inside the pilot's operating
     period and before the report time; a partial day counts its elapsed
     minutes only; M = 0 gives INSUFFICIENT DATA.
- **P7** (FP-003; refines PD-037 item 1): a points void never debits again
  points of that purchase that have already expired. For order o:
  - E = the points of o's original accrual entry;
  - A = the sum of earlier order-adjustment entries for o (the basis of the
    existing net-earned cap);
  - X = the points already expired from the point lots created by o's own
    entries (the accrual entry and any positive order-adjustment entry): the
    `expiration` entries whose `related_entry_id` is one of those entries,
    after expiry has been processed at the time of the void.

  Candidate formula (approved for validation only; not proven safe and not
  an implementation-ready algorithm): the void posts −max(0, E + A − X).
  Points of those lots already spent on
  rewards are still reversed. The debit consumes the soonest-expiring lots
  first (PD-020) and may take the balance below zero (PD-015, PD-020).
  Condition (owner): before implementation approval is requested, executable
  regression tests must validate this formula and its handling of
  corrections, lot consumption, expiry and negative balances (FP-003
  verification requirement V1). If a test shows the formula gives a wrong
  result, the case returns to the owner; the formula is not changed silently.

  **Open — returned to the owner (2026-11-12).** Codex Sol's targeted review
  found a source-derived counterexample (read from `engine.ts`
  `consumePointLots` and `expirePointLots`; not executed): A earns 100; B later earns 100 with a later expiry; voiding B debits 100 from A's earlier-expiring lot (soonest-expiring first); B's untouched lot then expires (−100); voiding A finds no expiration linked to A's lot (X = 0) and debits another 100, so the balance ends at −100 although both purchases were voided and nothing was redeemed.
  The cause is that lots are shared across orders: a void or a redemption
  takes the soonest-expiring lot of any order, so "the purchase's own lot" does
  not say which points a void or an expiry really took. Under the P7
  condition this goes back to the owner: the attribution rule must be decided
  by the owner, and validated by V1, before FP-003 implementation approval is
  requested. The formula above is kept as approved and is not changed here.

  A second source-derived variant (Fable final review, not executed) shows
  the same failure with a routine redemption instead of a void: A earns 100 (earlier expiry); B later earns 100 (later expiry); a 100-point redemption consumes A's lot (soonest-expiring first); B's untouched lot then expires (−100); voiding A finds no expiration linked to A's lot (X = 0) and debits another 100, so the balance ends at −100, whereas it would be 0 had A never existed.
  The candidate formula is therefore **not proven safe whenever points are
  consumed by redemptions or other voids before expiry**. The point-lot
  attribution algorithm is **unresolved**: it needs separate owner approval,
  source-level verification against the engine, and executable regression
  tests (FP-003 V1) before FP-003 implementation approval can be requested.
  No attribution rule is chosen here.
- **P8** (FP-003): missing or uncertain original accrual.
  1. Engine: when the engine holds no original accrual record for the order,
     a points void or full refund is refused and never computed from the
     spend delta (without a record the upstream net-earned cap does not
     apply, `packages/reference/src/engine.ts` 976–985).
  2. BFF recovery: a missing or unconfirmed stored accrual result is
     recovered only from authoritative LIP ledger records for that member and
     order. The accrual is never re-sent to find out, because re-sending
     creates an accrual when none exists (`engine.ts` 611–650). Fail closed:
     the evidence counts only if it is authoritative and complete as defined
     in FP-003 contract item 3 (every accrual entry of the member in the
     program read through LIP, all pages to the end without error, exactly
     one accrual entry for the order). Until FP-003 V4 shows such a read is
     possible, every missing result is uncertain (item 5).
  3. Verified zero-accrual: complete, authoritative evidence (item 2) shows
     the order's own accrual entry for the unit with amount 0 (for example a
     purchase below the minimum eligible spend, on an ineligible channel, or
     so small that its points round down to 0). Only such a purchase may be
     voided without a loyalty reversal. The purchase is recorded as voided:
     if it was a qualifying purchase (P2, for example points rounded down to
     0 above the minimum spend), its visit is removed as for any void
     (PD-032); a purchase below the minimum spend never created a visit.
  4. Verified positive accrual: complete, authoritative evidence (item 2)
     shows the order's own accrual entry for the unit with a positive amount,
     and, when the BFF still holds a stored accrual result, the same entry id
     and amount. The void proceeds under P7 using that entry, subject to the
     unresolved attribution question above.
  5. Uncertain: any state in which neither a zero nor a positive accrual is
     verified — no accrual entry found, more than one, a failed or
     incomplete read, a read whose completeness cannot be shown, records that
     disagree with the stored accrual result, a record without a `points`
     entry, or a listed entry id with no ledger entry. No zero is assumed and
     nothing is
     posted to LIP; the void stays blocked for reconciliation under P10
     (member block, *needs owner* after 15 minutes, Super Admin after 24
     hours, unblock only after successful reconciliation).
  6. FP-003 covers the `points` unit only. `credits` keep upstream behaviour,
     and P0 programs never enable a credit policy (PD-012: stamps or points
     only).
- **P9** (FR-095): plan-limit usage is visible to the Super Admin through P0
  operator tools (no console UI in P0, PD-011).
- **P10** (US5, FR-062): the stamp-only PD-008 A1 preconditions never block a
  points void; a points void is serialized per member and refused while another
  void for that member is in progress, and the PD-008 A1 durable member block,
  forward-only recovery and reconciliation-before-unlock rules also apply to
  points voids (spec FR-063, US5 scenario 4, FP-003 items 6–7).

Date / approved by: 2026-11-12, project owner (proposed by the agent the same
day).

## PD-039 — Gate 2 owner decisions: server money parser, amount input and display, entry gates — Approved (2026-11-13)

Context: at P0 Gate 2 (`specs/002-p0-prd/gate2-owner-decisions.md`) the agent proposed decisions the approved sources left open. The project owner approved them on 2026-11-13. The stage-permission part of the same package is recorded as PD-005 A3.

Decision:
1. **Server money parser home.** The BFF owns the authoritative server-side amount parser and formatter in `apps/bff/src/money/` (digit normalization, decimal-string to integer piasters, PD-007 formatting). It repeats the T010 algorithm and passes the same T010 validation vectors. The web helper (`apps/web/src/lib/money`, `digits`) only previews and displays; the amount the BFF parses is the amount recorded. No shared workspace package is created, and nothing is added under `packages/*`.
2. **Amount input grammar (refines PD-007 "up to two decimals").** After Arabic-Indic or Persian digits are normalized to Western digits, an amount is valid only as digits, optionally followed by `.` or `٫` and one or two digits. Forms such as `45.` and `.5`, thousands separators, signs and surrounding spaces are rejected, never guessed. A user interface may trim spaces or use a keypad that cannot produce invalid forms before calling the parser.
3. **Money display has no thousands grouping (refines PD-007 money format).** Amounts are shown as in PD-007, with no grouping separator: `1250 ج.م` / `EGP 1250`, `1234567.89 ج.م`. Any later grouping is a display-only decision made with the prototype; stored amounts never change.
4. **Implementation entry gates are retained.** `specs/002-p0-prd/plan.md` "Entry gates" stay exactly as written: roadmap 1.2–1.6, the final name, the `/speckit-checklist` run and T001 entry evidence precede any implementation task, the pure helpers included. There is no early-implementation exception.
   - *Clarification 2026-11-13 (owner-approved; PD-029 A1):*
     - The final-name bullet of `plan.md` Entry gates item 4 now reads "before 1.5 acceptance and before any branding-dependent work outside the prototype". This changes only when task 1.5 may start.
     - Every implementation prerequisite in this item still comes before any implementation task, the pure helpers included: roadmap 1.2–1.6 including the accepted prototype, the final name, the `/speckit-checklist` run and T001 entry evidence.
     - There is still no early-implementation exception.

Consequences:
- Integer piasters and no floating point are unchanged (golden rule 2). The BFF result is authoritative for every recorded amount.
- OD-01 to OD-18 are not resolved by this decision. FP-003 stays not authorized.

Date / approved by: 2026-11-13, project owner (proposed by the agent at Gate 2).

---

## PD-040 — JG consolidation: separable P0 policy boundaries — Proposed (2026-11-13); C1–C4 approved 2026-11-13 by PD-041

Context: the owner submitted JG-01–JG-12 as **owner-proposed** decisions and requested conflict review and documentation updates. This is not an approval record. Approved PDs, PRD Gate 1 and Planning Gate approvals are preserved. The [consolidation assessment](../../specs/002-p0-prd/journeys/jg-consolidation-review.md) records every JG, conflicts and blocked follow-up decisions; it is not an executable recovery procedure.

Candidate decisions (fully specified policy boundaries only; none is binding until explicit owner ratification):

1. **C1 — Duplicate accounts (JG-05):** no automatic duplicate-account merge or loyalty-value transfer in P0. Flag suspected duplicates for support review. Do not destroy, copy or move balances/audit records as a duplicate-resolution action; any recovery/merge procedure requires separate owner approval and independent review before use. This does not freeze ordinary authorized expiry, redemption, void, correction or reconciliation, and does not suspend PII erasure/retention requirements. No owner adjustment becomes a transfer shortcut.
2. **C2 — Existing owner (JG-07):** an invitation must not silently replace an existing café owner. Existing-owner conflicts require a separately explicitly authorized ownership-management process. This selects no replacement/reissue mechanism and does not resolve invite invalidation/races (F-07).
3. **C3 — Before first publication (JG-08):** customers cannot join an active loyalty program, accrue real stamps/points or redeem rewards before the café's first program publication. Any preview must be clearly non-transactional. This does not prohibit non-transactional universal-account sign-in and selects no new API error contract.
4. **C4 — Suspended pending claims (JG-09):** refuse creation of new customer pending claims while suspended. Preserve all permitted corrections, voids, redemptions and recovery actions under PD-005 A2/A3 and their normal security/accounting guards. This does not invent cancellation of existing claims or permit new/replacement staff-device enrollment under suspension.

Consequences: JG-05/08/09 have review-ready policy text but still await owner approval; JG-07 remains partial because reissue/conflict procedures are unspecified. Remaining JGs are recorded in the assessment rather than as selected mechanisms or amendments: in particular no change to PD-004's reused-number risk, SC-001's invite-acceptance timer, PD-016's OTP-only messages or roadmap1.3's tap criterion is approved. Follow-ups F-01–F-07/F-10–F-12 are unresolved question records. OD-01–OD-18 remain open; FP-003 remains unauthorized. The historical 2026-11-13 scoped Gate2 approval in plan.md/tasks.md is preserved (six content-only cards, T059–T078 gate records, remaining cards blocked structure). This proposal grants no additional Gate2, Roadmap1.2–1.4 or implementation approval.

Date / proposed by: 2026-11-13, project owner; approval pending. Independent review is required and cannot ratify these proposals.

**Current disposition (2026-11-13, PD-041).** The owner approved C1–C4. The "still await owner approval" and "approval pending" wording above is historical: it records the state when this entry was proposed. Every mechanism, contract and follow-up named above is still open or blocked, as PD-041 lists.

## PD-041 — Owner decisions on journey gaps JG-01–JG-12 — Approved (2026-11-13); policy principles only, mechanisms listed as blocked; JG-01 and JG-09 refined 2026-11-13 by PD-042

Context: the roadmap 1.2–1.4 journey drafts raised gaps JG-01–JG-12 (`specs/002-p0-prd/journeys/README.md`). The owner's proposals for them were assessed in `specs/002-p0-prd/journeys/jg-consolidation-review.md` and PD-040. On 2026-11-13 the owner:
- approved the recommended policies for JG-01, JG-02, JG-03 and JG-05 to JG-10, with their stated limitations;
- kept JG-04 and JG-11 unresolved;
- approved only part of JG-12.

Decision:

| JG | Approved policy (binding) | Limitations; still-blocked items (not approved) | Status |
| --- | --- | --- | --- |
| JG-01 OTP sends | All OTP purposes for one phone number share one per-number SMS budget: at most 5 SMS sends per rolling 60 minutes across all purposes. A purpose may set a stricter limit. | Every PD-004/PD-020 limit still applies to every channel: 5 sends/hour and 10/day per number, 60 s resend, one active code, 5 wrong attempts. No budget is raised and no extra WhatsApp send is permitted. Each step-up stays a fresh, action-bound code (FR-012, R-13), never reused to save sends. Open, F-01: whether a WhatsApp send plus its SMS fallback counts as one send or two; how failed or uncertain dispatches count; the window definition against PD-020's "per hour"; concurrent reservations. OD-01 and OD-05 also stay open. | Partially resolved |
| JG-02 Onboarding timer | SC-001, PD-011 and roadmap 1.4 keep invite acceptance as the start. Two separate measures are also recorded: a diagnostic authenticated-setup interval (setup entry → published program + print-ready Branch QR) and the first successful stamp. Raw timestamps are kept, and no wait or error time is subtracted. | The diagnostic never substitutes for SC-001 or SC-009; no approved metric is amended. Open, F-02: the exact invite-acceptance event, and PD-011's "first-stamp time" wording. | Partially resolved |
| JG-03 Customer number lost permanently | Support-assisted recovery is the direction, offered only through a separately approved verification mechanism. Possession of a new number alone never transfers or exposes historical value. | Until F-03 is approved, no support rebinding can run and no recovery is promised. F-03 covers ownership evidence, the verifier, binding, revocation, disputes, retention and legal task 0.10. | Partially resolved |
| JG-04 Recycled number | — | **Unresolved.** PD-004's accepted MVP reused-number risk stands unchanged until a separately approved security design exists (F-04). The OTP-only baseline must not be presented as protecting a previous holder. | Unresolved |
| JG-05 Duplicate accounts | PD-040 C1, as written. | Support triage tooling waits for F-05: minimal fields, access, audit and retention. Any future merge or value movement needs its own reviewed procedure and owner approval. | Approved |
| JG-06 Owner recovery | New-phone owner recovery requires verified café ownership plus independent security checks. These are added to FR-142's requirements: out-of-band check, revocation of every owner session, audit. An SMS OTP alone is never sufficient. A second owner is never created (PD-014). | F-06 mechanism blocked: evidence, independent check, authorized operator, new-phone binding, revocations, stage scope, disputes, retention, legal task 0.10. No recovery invite is selected. OD-01 stays open. | Partially resolved |
| JG-07 Existing owner | PD-040 C2, as written. | Open, F-07: reissue invalidation; concurrent accept and reissue; whether any P0 ownership-change process exists. | Partially resolved |
| JG-08 Before first publish | PD-040 C3, as written. | The customer-facing refusal contract is not specified, and none is chosen here. | Approved |
| JG-09 Suspended claims | PD-040 C4, as written: while the café is suspended, customers cannot create new pending claims. | Existing claims are not cancelled by this rule. Not yet done: the refusal contract, and recording this stage cell beside PD-005 A2/A3 (see Consequences). | Approved |
| JG-10 Customer rights across stages | A customer's read-only access to their own account and cards, their privacy rights and secure recovery are universal-account rights, not café billing entitlements. They continue in every subscription stage. Value-changing café actions keep their own stage guards (PD-005 A2/A3, FR-073). | Before any customer operation is wired, F-10 must map it to a stage cell; no cell is inferred. The operations: sign-in, card and code display, name/language/consent edits, customer device enrollment and revocation, sign-out-all, phone change, erasure, migration accept/decline. Recovery mechanisms stay blocked (F-03, F-04, F-06). Erasure still waits for unfinished voids (FR-008). | Partially resolved |
| JG-11 Cashier taps | — | **Unresolved.** The roadmap 1.3 criterion stands unchanged: each step ≤ 2 taps on a cheap Android phone. The proposed benchmark scope and synthetic Android profile remain proposals (F-11). | Unresolved |
| JG-12 Wizard ranges and expiry indicator | In principle only: the customer app shows an in-app indicator for issued rewards that expire within 7 days. No external reminder (WhatsApp, SMS or push) is sent. PD-016 and FR-140 are unchanged. | Open, F-12: the indicator's window semantics (elapsed versus Cairo-calendar days, inclusive edges, rewards issued with a 7-day expiry, already-expired items), notification-boundary details, and the numeric wizard ranges (stamp threshold, points earn-rate form and bounds, maximum reward cost). Unchanged: points `warning_days: [30]`, reward expiry 30 days (7–90), stamps never expire. | Partially resolved |

Consequences:
- **Counts:** approved 3 (JG-05, JG-08, JG-09); partially resolved 7 (JG-01, JG-02, JG-03, JG-06, JG-07, JG-10, JG-12); unresolved 2 (JG-04, JG-11).
- **PD-040:** its candidates C1–C4 are approved by this entry.
- **No other amendment:** no other PD, PRD requirement, success criterion or roadmap criterion is amended.
- **Text still to write:** some approved policies need PRD, contract or task-package text: the JG-08 and JG-09 refusal contracts, the JG-09 stage cell, the JG-12 indicator and the JG-02 diagnostic. Each is a separate change with its own review. Until then, implementers use nothing beyond this entry and the existing contracts.
- **JG-09 stage cell:** it is a stage permission outside PD-005 A2/A3. PD-017 refers to "A2 and A3", while FR-092 currently cites only PD-005 A2. That existing A2/A3 reconciliation is still pending and is not amended here. Task T028 transcribes exactly the 69 A2/A3 cells. Recording the cell consistently needs owner direction, for example a PD-005 amendment plus a reviewed update to execution-briefs.md and T028/T046.
- **Unchanged gates:** OD-01–OD-18 stay unresolved; FP-003 stays not authorized; the points-pilot gates are unchanged.
- **No approval of anything else:** this entry does not approve roadmap 1.2–1.4, adds no Gate 2 approval, and authorizes no implementation, commit, push or deployment.

Date / approved by: 2026-11-13, project owner.

**Current disposition (2026-11-13, PD-042).** PD-042 refines two rows of the table above:
- **JG-01:** the per-number limit is 5 OTP sends in any rolling 60 minutes, shared across WhatsApp and SMS and all OTP purposes. This replaces the SMS-only wording above. JG-01 stays partially resolved: transport and failure accounting stay open under F-01.
- **JG-09:** the stage cell and the refusal contract are now recorded in PD-005 A4.

The counts stay 3 approved, 7 partially resolved and 2 unresolved.

## PD-042 — Owner follow-up decisions: PD-005 A4, field 13 for six cards, JG-01 rolling window, Article XI confirmation — Approved (2026-11-13)

Context: the PD-041 report (2026-11-13) asked the owner four follow-up questions. The owner approved all four the same day.

Decision:
1. **PD-005 A4 (JG-09).** A customer cannot create a new pending claim while the café is suspended. This is recorded as PD-005 A4. The authoritative stage-permission matrix, PD-017, FR-092, SC-008, the stage-permission briefs, the contracts, T028/T033/T046 and their tests are updated to match. Every existing A2/A3 permission is preserved.
2. **Field 13 for T001, T002, T010, T035, T048 and T058, review-only.**
   - The rule 05 field 13 "Compatibility and evolution" assessment is added to these six Gate 2 content-approved cards. Their approved scope is preserved.
   - Sol (`plan-review`) independently reviews the additions.
   - Any breaking change or scope expansion that the review finds goes back to the owner. It is never silently re-approved.
   - Adding field 13 does not re-grant or widen the cards' Gate 2 content approval.
3. **JG-01 rolling window.**
   - One limit applies per phone number: at most 5 OTP sends in any rolling 60-minute window. It is shared across WhatsApp and SMS and across all OTP purposes.
   - The 10-per-day cap, the 60-second resend interval and the required fresh, action-bound step-up verification (FR-012) are unchanged.
   - This clarifies PD-004's and PD-020's "5 sends/hour" without raising any budget.
   - Transport and failure accounting stay unresolved under F-01 and are not invented here. F-01 covers whether a WhatsApp send followed by SMS fallback counts as one send or two, how failed or uncertain dispatches count, and concurrent send reservations.
4. **Constitution Article XI, version 1.2.0, confirmed.** The owner confirms the scalability, extensibility, backward-compatibility and regression-safety principle recorded on 2026-11-13. Articles I–X and the existing approval hierarchy are preserved.

Consequences:
- **JG status:** JG-09 stays Approved and is now fully recorded (PD-005 A4). JG-01 stays Partially resolved, with F-01 narrowed to transport and failure accounting. The counts stay 3 / 7 / 2.
- **PRD:** the approved PRD (`specs/002-p0-prd/spec.md`) is amended in place only where items 1 and 3 require it: the stage-table references (US9, FR-092, SC-008) and the suspended-claim edge case. No other requirement changes.
- **Unchanged gates:** OD-01–OD-18 stay unresolved. FP-003 stays not authorized; the point-lot attribution algorithm stays unresolved.
- **No other approval:** this entry does not approve roadmap 1.2–1.4, adds no Gate 2 approval, and authorizes no implementation, migration, commit, push or deployment.

Date / approved by: 2026-11-13, project owner.

## PD-043 — Working product name "ونيس — Wanees" — Approved (2026-11-13) as a working name only; PD-029 unchanged

Context:
- PD-029 keeps `[Product]` as the placeholder. It requires a **final** Arabic and Latin name, checked for domain availability and for conflicts with Egyptian loyalty/POS brands and trademarks, approved as its own decision before task 1.5 and any branding-dependent work.
- On 2026-11-13 the owner adopted a provisional working name to continue entry-gate preparation.

Decision:
1. **Working name.** The working name of the restaurant and café loyalty SaaS is **ونيس** (Arabic) / **Wanees** (Latin).
   - It is a working name only.
   - It is **not** a final commercial brand and **not** legally cleared.
   - No domain-availability, trademark or brand-conflict check has been done. This entry claims none.
2. **The final-name gate is unchanged.**
   - The working name does **not** satisfy the PD-029 final-name decision, the roadmap 1.5 criterion "final product name (Arabic + Latin) approved before this task starts", or the `final-name` gate in `specs/002-p0-prd/tasks.md` (T058, rebrand task 2.1).
   - Using the working name to start task 1.5 requires a **separate owner-approved amendment** to PD-029. None is approved here. The options are in `specs/002-p0-prd/prototype/1.5-prototype-brief.md`.
   - Until the final name is approved, existing planning artifacts keep `[Product]`. They are not renamed.
   - *Update 2026-11-13:* PD-029 A1, approved by the owner, now lets task 1.5 start with the working name. The final name is still required before the prototype is accepted, before T058 and rebrand 2.1, and before other branding-dependent work.
3. **Branding is kept separate from the engine and contracts, so that renaming stays safe.** The product name (working or final) is presentation only.
   - **Not allowed in:**
     - `/lip/v1`, `spec/` or the LIP engine;
     - BFF, owner, customer, staff or operator API paths, fields, error codes or event names;
     - database schemas, tables, columns, roles, policies, GUCs or migration names;
     - business-ID or ID-prefix formats and idempotency keys (this includes any replacement for upstream `crv_*` prefixes chosen in roadmap 2.1);
     - environment variable or secret names;
     - package or module names;
     - business logic or conditions.
   - **Allowed in:** user-visible copy, brand assets, and page or marketing metadata only.
   - Renaming the product therefore changes no contract, persisted data or behaviour (constitution Article XI).
   - **Delivery mechanism: Proposed, not approved.** Supplying the name through one brand value per locale (Arabic, English) is the proposed mechanism. It is not approved.

Consequences:
- **Still open:**
  - the PD-029 final-name decision, including domain and trademark checks;
  - roadmap 1.5 and its entry conditions;
  - the `final-name` gate, which still blocks T058.
- **Nothing else is decided:**
  - JG-04, JG-11 and OD-01–OD-18 stay unresolved.
  - FP-003 stays not authorized; the point-lot attribution algorithm stays unresolved.
  - This entry approves no roadmap task, gate, prototype work, implementation, migration, commit, push or deployment.

Date / approved by: 2026-11-13, project owner (item 1, and the separation principle in item 3). Item 2 records the existing PD-029 gate unchanged. The item 3 delivery mechanism is Proposed.

## PD-044 — Prototype format, locales and accessibility target — Approved (2026-11-13)

Context: item P4 of the roadmap 1.5 entry package (`specs/002-p0-prd/prototype/1.5-entry-amendment-impact.md`). The owner approved it on 2026-11-13 and chose accessibility scope (b), covering the prototype and the shipped product.

Decision:
1. **Format.** The roadmap 1.5 prototype is made in **Figma**: an editable source plus a clickable prototype.
   - It lives in a non-production workspace and holds fictional data only: no credentials, real customer data or merchant keys.
   - Account ownership, access and any cost are recorded when the workspace is set up. The PD-006 cap covers deployment services, not this tool.
2. **Locales.** Every screen exists in Arabic RTL (the default) and English LTR. This restates FR-130 and PD-007.
3. **Accessibility.** **WCAG 2.2 Level AA** is the target for the prototype **and** for the shipped P0 product.
   - The PRD gains FR-134 and SC-018.
   - Every UI task card needs re-reviewed AA acceptance criteria and tests before it can be ready (the `accessibility` gate in `specs/002-p0-prd/tasks.md`).
   - A design file shows design-level criteria only. Conformance of the shipped UI is shown only on implemented screens.
4. **Authentication review**, which the owner asked for, with no silent change to PIN or OTP. The W3C *Understanding SC 3.3.8 Accessible Authentication (Minimum)* says:
   - remembering a site-specific password is a cognitive function test;
   - a service that requires manual transcription of a verification code does not comply;
   - users must at least be able to paste the code, and browsers must be allowed to fill it;
   - blocking paste, or blocking password-manager fill, fails the criterion unless an alternative is provided.

   What this means here:
   - **One-time codes** (customer and owner sign-in, owner step-up, account deletion, phone change, staff phone verification): the code field must allow paste and browser autofill. This is a UI constraint only. The OTP rules (PD-004, PD-020, PD-042, FR-010) do not change.
   - **Staff PIN** (FR-014, FR-016, PD-010): a remembered, café-specific PIN is likely a cognitive function test. To conform, the PIN step needs an alternative or an assisting mechanism, for example not blocking paste or password-manager fill. On shared branch devices that may weaken per-staff accountability.
   - **Open: A11Y-01, an owner decision.** Until it is decided, FR-014 and PD-010 are unchanged, the PIN screens are marked decision-dependent in the prototype, and no AA conformance is claimed for the staff sign-in step.
5. **Branding isolation** is unchanged (PD-043 item 3). The one-brand-value-per-locale mechanism stays Proposed.

Consequences:
- Entry-gate CHK018 (accessibility scope) is decided.
- A11Y-01 is open.
- No JG, OD or F-item changes. FP-003 stays not authorized.

Date / approved by: 2026-11-13, project owner (items 1–3; item 4 records the review the owner requested and leaves A11Y-01 open).

## PD-045 — Roadmap 1.3/1.4 measurement split, conditional journey acceptance, start of task 1.5 — Approved (2026-11-13)

Context: item P3 of the roadmap 1.5 entry package, and the owner's authorization of 2026-11-13.

Decision:
1. **Measurement split.** Roadmap 1.3 and 1.4 each have two parts:
   - (a) the journey documentation, accepted by the owner;
   - (b) measurement on a versioned, testable 1.5 measurement prototype.

   The thresholds are unchanged: each cashier step takes ≤ 2 taps on a cheap Android phone, and owner onboarding takes under 15 minutes, timed from invite acceptance. 1.3 and 1.4 are done only when (a) and (b) are both recorded. Task 1.5 depends on 1.2, 1.3 (a) and 1.4 (a).
2. **Conditional acceptance (2026-11-13).** These are accepted as conditional drafts: 1.2 (`journeys/1.2-customer-journey.md` and `journeys/1.2-recovery-procedures.md`), 1.3 (a) and 1.4 (a).
   - Every unresolved item stays open: JG-04, JG-11, F-01–F-12 (with F-03, F-04, F-06 and F-10 blocked), OD-01–OD-18 and FP-003.
   - Acceptance approves no blocked mechanism and records no measurement.
3. **Measurement evidence.**
   - Prototype tests may provisionally assess screen navigation and tap counts.
   - Physical-device performance, camera operation, OTP delivery and service-dependent timing need later verification on the real app.
   - No measurement is claimed without evidence.
   - **Open: M-01, an owner decision.** Where does the real-app verification sit in the roadmap? Can 1.3 (b) and 1.4 (b), and so M1, be recorded as done on the provisional prototype evidence, with the real-app items carried forward? This matters because M1 must come before any implementation (`plan.md` Entry gates). Holding 1.3 and 1.4 open until real-app verification would block implementation indefinitely.
4. **Authorization.** Roadmap 1.5 may start, for **prototype design only**:
   - in a non-production workspace, with fictional data;
   - following `specs/002-p0-prd/prototype/1.5-prototype-brief.md` and governance.

   No application implementation, migration, staging, commit, push or deployment is authorized.

Consequences:
- **Updated:**
  - roadmap rows 1.2–1.5;
  - `plan.md` Entry gates item 4 (PD-029 A1);
  - the `tasks.md` `final-name` and `accessibility` gates;
  - the PRD Dependencies line;
  - the journey drafts.
- **Status:**
  - 1.5 is started, not accepted;
  - 1.3 (b) and 1.4 (b) are NOT RUN.
- **Still open:** the final name, F-02, F-11, F-12, the 1.6 plan values, A11Y-01 and M-01.

Date / approved by: 2026-11-13, project owner.

## PD-047 — Backend-first, UI-last sequencing; U-b — Approved (2026-11-15)

Context: the owner approved Backend-first Amendment Revision 3 on 2026-11-15, then separately approved its revised Gate 2 plan/task package. This entry records the adopted sequencing decision; it does not authorize implementation or operational activity.

Decision:
1. **Backend entry (M1-B).** M1-B consists of BE-1–BE-7 in the approved Revision 3. It precedes T001. T001 records BE-8 as its output; it does not depend on its own output. Subsequent implementation tasks inherit T001 and retain their own Gate 2 content, field 13, prerequisites and separate named implementation authorization.
2. **Scoped supersession of PD-039 item 4.** Only its sequencing requirement is superseded: backend tasks may enter after M1-B and T001 without waiting for roadmap 1.3(b), 1.4(b), accepted 1.5 or the final name, except where a task's own explicit gate (including plans-values, final-name, legal, security or operations) requires them. No pure-helper exception bypasses M1-B. All other PD-039 decisions remain unchanged.
3. **Selected UI route (U-b).** Prepare T084's UI manifest before `ui-entry`; implement final UI after backend readiness and UI-entry conditions; assess and accept UX on the real staging application through T085. Roadmap 1.3(b), 1.4(b) and final 1.5 acceptance are completion evidence, not prerequisites for T084 or UI implementation.
4. **Milestones.** Replace M1's entry/completion dual use with M1-B, M1-UI and M1-done as specified in `docs/context/06-roadmap.md`. Preserve historical M1/Phase 1 evidence. M1-done requires the carried roadmap evidence, including T085 staging UX acceptance, owner acceptance of final 1.5 UI, 1.6 plan values and the final name. M1-done does not gate work needed to produce that evidence.
5. **PD-044 and PD-045 amendments.** The Figma prototype is no longer the pre-implementation UX measurement artifact for this route. Implemented UI and real-staging validation replace that measurement format/sequence only. WCAG 2.2 AA, Arabic RTL/English LTR, responsive/text-scale criteria, OTP paste/autofill, D1–D4, journeys and all thresholds remain. A11Y-01 remains unresolved; no PIN-step AA claim is inferred. PD-045's conditional journey acceptance and historical 1.3(b)/1.4(b) NOT RUN status remain intact; M-01's route question is settled by U-b, while M-01-staging protocol/placement and M-01-M5 remain open.
6. **Unchanged gates and governance.** OD-01–OD-18, F-01–F-12 and JG limitations remain at their existing scopes; FP-003 remains unauthorized; legal, cost, company, messaging, deployment, data-use, restore, pilot and task-specific gates remain. G01 changes prospective review governance only and is not closed by this decision or the PD-047 review. No implementation, migration, staging, live messaging, deployment, commit, push or pilot is authorized.

**Approval record:** The owner approved Revision 3 on 2026-11-15, and separately approved the bounded revised Gate 2 package on 2026-11-15. Adoption edits were authorized only after that Gate 2 approval. The independent plan-review verdict is evidence, not owner approval. At those approvals, checklist disposition, G01 independent review and named task authorizations remained outstanding.

**Separate BE-5 owner disposition (2026-11-15):** The project owner explicitly approved the disposition of CHK001–CHK082 as presented in the Wanees decision package dated 2026-11-15. The item-level record is `specs/002-p0-prd/checklists/entry-gate-assessment.md` §G, preserving the original checklist, evidence and classifications. Satisfied items remain evidence-qualified; Partial, unresolved, Deferred and Consistency items remain open with their existing named tasks and gates. BE-5's checklist-run and owner-disposition requirement is met; this is not checklist-wide completion, resolution of any underlying product decision, a gate waiver, or implementation/operational authorization. BE-7's separate G01 independent review and separate named T001 authorization remain outstanding; T001 has not produced BE-8. (BE-7 closed 2026-11-16, PD-048 item 6.) This records the owner's bounded disposition under PD-047 without creating a new product decision.

**Historical preservation:** PD-039, PD-044 and PD-045 retain their original dated text and approvals above. PD-047 is the later, precise amendment and does not rewrite those historical records.

---

## PD-046 — Multi-tenant dynamic merchant branding (MVP) — Approved (2026-11-13); MB-01–MB-05 Approved (2026-11-14); U-1–U-6 and corrections A–C Approved (2026-11-14)

Context: On 2026-11-13 the owner added a P0 (MVP) requirement: each merchant chooses three brand colours, and the customer-facing loyalty experience takes on the selected merchant's palette while running on the shared platform.

Decision (the owner's requirement, as approved):
1. Every merchant (tenant) chooses exactly three brand colours during owner onboarding: primary (about 70 % visual dominance), secondary (about 25 %) and accent (about 5 %). The proportions are visual design guidance, not a rigid pixel-count rule.
2. The palette is stored per merchant, never globally. All branches inherit their merchant's palette by default.
3. Authorized merchant owners can preview, save and update the colours.
4. A merchant with no palette uses the default: primary `#3A2419`, secondary `#E8C88A`, accent `#F59E0B`.
5. Customer-facing screens are themed dynamically, including member cards, rewards, progress indicators and relevant merchant UI. With no merchant context selected, a neutral platform-level experience is kept.
6. The shared customer account and the platform architecture are unchanged. Switching merchant context switches branding with no cross-tenant leakage.
7. WCAG 2.2 AA is preserved through accessible derived text, surface and contrast colours (PD-044).
8. Colour inputs are validated and sanitized. No merchant CSS or JavaScript is accepted.
9. Cache isolation, backward compatibility and secure authorization are preserved.
10. **Scope (owner clarification, 2026-11-13).** Branding applies to every merchant (tenant) of any business category, not only cafés and restaurants. The palette, the derivation rule, the tokens, the screens and their copy make no business-category assumption: no category-specific imagery, icons, names or colour presets. The demo merchants "Demo Café A" and "Demo Café B" are fictional test data and do not narrow the scope.
    - **Owner statement, 2026-11-13:** the product vision is category-agnostic. The platform should be architecturally able to serve merchants of different business categories. The initial pilot may stay with cafés and restaurants. So: **platform capability** = any category; **pilot scope** = cafés and restaurants unless the owner widens it.
    - Recorded as **PD-001 A1** (owner-approved 2026-11-14). The product brief and the glossary now distinguish platform capability from pilot scope.
    - **Terminology:** in PD-046 and its artifacts, *merchant* = *tenant* = the glossary term "Business" (`tenant_id`). It is not a new entity. LIP's own `merchant_id` on orders and the server-held merchant credential keep their existing meanings.

Decisions MB-01–MB-05. The agent proposed them under owner delegation on 2026-11-13; the proposals below are kept as history. **The owner approved MB-01–MB-05, PD-001 A1 and PD-005 A5 on 2026-11-14** (see "Owner approval" below). Where the approved wording differs from a proposal, the approved wording prevails. This approval is not Gate 2 approval and authorizes no implementation, contract, migration or Figma edit.

- **MB-01: themed surfaces beyond customer screens.**
  - *Decision:* theme only customer screens in a merchant context (MB-02 list) and the owner's palette preview (OWN-08, the OWN-17 preview). The counter (CSH-*) and the owner dashboard keep the platform appearance.
  - *Alternatives:* theme the counter too; theme the dashboard too.
  - *Why:* result, refusal and status colours stay identical for every cashier (roadmap 1.3 runs on a cheap shared Android phone); T042 and T045 need no revision; the customer is the audience PD-046 names. Theming more surfaces later is additive.
  - *Risk:* owners may want a branded counter (low; reversible). *Confidence:* high.
- **MB-02: platform appearance and merchant-context screens.**
  - *Decision:*
    - **Merchant context (themed):** CUS-01 (Branch QR landing; palette from the scanned Branch QR), CUS-04, CUS-06, CUS-07, CUS-08, CUS-09, CUS-10.
    - **Platform appearance (default palette, platform W mark):** CUS-02 and CUS-03 (sign-in and one-time code, even when reached from a join), CUS-05 (card list; each tile carries its own merchant's colours and name), CUS-11–CUS-18 (account, devices, consent list, deletion, support, recovery).
    - **Identity on themed screens:** the merchant's display name as text in the header, plus a small platform mark ("on Wanees", ST-05 rules apply). The large W mark appears only on platform screens.
  - *Alternatives:* theme the sign-in screens from the join context; theme everything after a merchant is selected.
  - *Why:* one consistent platform look on every authentication screen makes look-alike phishing pages easier to spot and keeps the shared account visibly platform-owned (PD-001). Value and code screens carry the merchant identity the owner asked for.
  - *Risk:* a less "branded" join flow between CUS-01 and CUS-04 (low). *Confidence:* medium-high.
- **MB-03: stage and authentication rule for a palette change.**
  - *Decision:* allowed in every subscription stage, like the main-language and amount-label settings (PD-005 A3). Owner role only, in the normal authenticated owner session (CSRF-protected, PD-004/PD-005 session rules). **No fresh one-time code.** Every change and reset is audited (FR-150). Recorded as the proposed amendment PD-005 A5 below; the approved stage tables A2–A4 are unchanged.
  - *Security reasoning (HIGH risk, authentication choice):* a palette change moves no value, exposes no personal data and changes no access. FR-137 limits input to `#RRGGBB` and FR-139 derives AA-safe pairs, so a hijacked session can at worst set an unwanted but accessible palette, visible in the audit log and undone by reset. A step-up code would add OTP cost (WhatsApp, PD-004) for no protected asset.
  - *Alternatives:* fresh OTP for every change; block changes in read-only or suspended stages.
  - *Risk:* defacement through a stolen owner session (low impact, audited, reversible). *Confidence:* medium-high.
- **MB-04: branch-level palettes.**
  - *Decision:* none in P0. Every branch uses its merchant's palette (backlog).
  - *Why:* PD-046 item 2 says branches inherit; a per-branch palette adds a resolution rule and a leakage surface for no stated need. *Confidence:* high.
- **MB-05: optional merchant logo upload.**
  - *Decision:* **no logo upload in P0.** Merchant identity is the display name as text plus the palette. Logo upload is backlog, with the pre-agreed constraints below.
  - *Options compared:*
    - (a) no logo: no new surface;
    - (b) optional logo: PNG or JPEG only, never SVG; byte and pixel caps; re-encoded on the server with metadata stripped; served from platform storage, never a merchant URL; a fixed slot with the name-text fallback; alt text from the merchant name;
    - (c) logo plus other brand assets.
  - *Why (a):* the approved plan has no object storage or image pipeline. Option (b) would add a storage dependency, an upload contract, image processing, a data-model change, content moderation and a new attack surface (decompression bombs, polyglot files). That is more than T080–T082 combined. It also conflicts with FR-137 as written ("no images"). The text-name fallback is needed in every option anyway.
  - *Implications:* no card change. If the owner chooses (b), FR-137 needs an amendment and new task cards. *Confidence:* high for P0.

Owner approval (2026-11-14), as approved. It prevails over the proposals above:
- **MB-01 — Theme scope.** Merchant branding applies only to customer-facing screens in the merchant context and to the merchant owner's colour preview. Cashier, owner dashboard and administrative interfaces keep the standard platform theme.
- **MB-02 — Platform and merchant branding.** Platform-level screens use the platform identity. Merchant-context customer screens use that merchant's branding. The shared customer card list keeps the platform theme, while each merchant tile shows its merchant's colours. The customer account stays unified.
- **MB-03 — Owner colour editing.** Authorized merchant owners may update the three brand colours from Settings. Every change is securely audited. An ordinary colour update in a valid, trusted, authorized session needs no fresh one-time code. Appropriate authorization, CSRF protection where applicable and rate limiting are required, and additional verification is required when session trust or risk policy requires it.
- **MB-04 — Branch inheritance.** All branches of a merchant inherit its palette. Branch-specific overrides are out of scope for P0.
- **MB-05 — Merchant logo.** Logo upload is out of scope for P0; the merchant's name is shown as text. The UI stays extensible for an optional logo in a future phase, but P0 adds no upload infrastructure, image storage or image-processing requirement.
- **PD-001 A1** is recorded under PD-001, and **PD-005 A5** under PD-005.
- **Visual direction:** the Premium Figma design stays a temporary baseline. The default palette is Mocha Brown `#3A2419` (≈ 70 %), Champagne Gold `#E8C88A` (≈ 25 %) and Burnt Amber `#F59E0B` (≈ 5 %). Each merchant keeps the same hierarchy with its own colours. The percentages are approximate design dominance, and every derived foreground and background colour meets the applicable accessibility requirements.

Agent application, not separately approved: the screen-by-screen classification presented with the MB-02 proposal above applies the approved MB-02 principle. The owner may object to any screen's classification. **Owner-approved later on 2026-11-14 as U-5, subject to corrections A–C below.**

Open details, not decided (carried to the `branding-contracts` gate): the session-trust or risk trigger that requires additional verification for a palette change, and the rate-limit value. **Resolved later on 2026-11-14 by U-1, U-2 and U-6 below.**

Owner approval of U-1–U-6 and engineering corrections A–C (2026-11-14). It covers decision documentation, contract revisions and validation only. It is not Gate 2 approval and authorizes no implementation.
- **U-1 — Owner session verification.** Use the existing owner authentication architecture. A valid, authorized owner session is required. No additional OTP for ordinary colour changes. Reauthentication is required when the session is expired, invalid or revoked. No new risk-detection subsystem in P0. All existing session-security requirements are preserved.
- **U-2 — Mutation attempt rate limiting (option B).** A small, dedicated server-side rate-limit counter table.
  - 30 authenticated palette mutation attempts per rolling 60 minutes per owner account.
  - 10 successful saved palette changes per rolling 60 minutes per merchant.
  - Resets and onboarding saves count as successful changes; local previews do not.
  - Concurrency safety through atomic database operations; exceeded limits are rejected with HTTP 429 and a retry indication.
  - The counter cannot be reset by changing merchant context.
- **U-3 — Idempotency and rejected responses.** HTTP 401, 403 and 429 are not persisted as completed idempotency results for branding mutation endpoints. Retries with the same key are processed against the current authentication, authorization and rate-limit state. Request-fingerprint checks and existing idempotency security rules are preserved.
- **U-4 — CUS-10 branding (option A).** CUS-10 receives merchant colours through an authoritative, server-resolved merchant context. Client-supplied palette values are never trusted. Cross-tenant isolation and safe fallback are preserved.
- **U-5 — MB-02 screen classification**, approved subject to corrections A–C.
  - Platform identity stays on shared authentication, account, support and recovery screens; merchant identity applies to merchant-context customer screens.
  - The CUS-05 card-list page stays platform-themed; individual tiles show their merchant's colours.
  - CUS-01 uses merchant colours only after successful server-side Branch QR validation. Invalid, unknown, inactive or rotated Branch QR codes never expose a previous merchant's branding.
- **U-6 — Successful change limit.** 10 successful saved palette changes per merchant per rolling 60 minutes, with atomic enforcement, not read-then-write checks vulnerable to race conditions.
- **Correction A — CUS-09 after a reload.** CUS-09 keeps the correct merchant identity after a reload when the merchant context can be securely re-resolved. It does not switch to the platform theme merely because a claim response lacks palette fields. It falls back to the platform theme only when no valid, authorized merchant context can be established, and never reuses a previously selected merchant's palette.
- **Correction B — 401 versus 403.** 401: no valid authenticated session is available to the endpoint. 403: an authenticated principal lacks the required role or permission. 401 is correct where cookie-domain separation makes a cashier unauthenticated on the owner site. 403 is not assumed unreachable.
- **Correction C — Merchant context resolution.** Customers may select merchant memberships, follow merchant links or scan Branch QR codes. The server validates those identifiers and resolves the merchant context authoritatively. Client-supplied palette values, tenant authorization claims and unverified merchant context are never trusted. Tenant isolation, response-cache isolation and sign-out cleanup are preserved.

Recorded consequences / agent note (2026-11-14; written by the agent, not separately approved):
- The U-2 storage, authorization, concurrency, expiry, cleanup and tests are documented as a proposed design in `specs/002-p0-prd/gate2-branding-revision.md` §3.1 and §6 (not approved at Gate 2).
- Updated in place: PD-005 A5 (refinement); `spec.md` Status, FR-136, FR-138, edge cases and Dependencies; journey 1.4; D1–D4; roadmap row 4.8.
- Updated in place but still unapproved at Gate 2: the PD-046 draft blocks and T081/T082.
- Gate 2 revisions not applied: T028 (72 → 75 cells), T046, the `stage-cells` row, `research.md` R-19, the `execution-briefs.md` totals, `contracts/README.md` rows and `data-model.md` §1 roles (package §5). Each carries a pending-revision pointer.
- `branding-contracts` stays open. Sol's review is mandatory and has not run.

Consequences:
- **Updated in place, pending independent Sol review:**
  - `spec.md`: FR-135–FR-139, SC-019, US1.8, US4.9–US4.10, a roles row, the Brand palette entity, edge cases, out-of-scope rows, open items and traceability;
  - journey 1.4: step O4a;
  - prototype D1–D4, the 1.5 brief (AC-13) and `figma-workspace-setup.md`;
  - `tasks.md`: T080–T082 as blocked cards, gates `branding-decisions` and `branding-contracts`, dependency and coverage rows. No existing card changes.
- **Drafted, not approved. Required before any branding task can be ready:**
  - `plan.md`, `data-model.md`, `contracts/` and `execution-briefs.md` § T080: drafted on 2026-11-13 as "Proposed amendment (PD-046), not approved at Gate 2" blocks. They need Gate 2 approval.
  - The roadmap: row 4.8 is a Proposed row (2026-11-13). It no longer depends on MB confirmation; Gate 2 still applies.
  - PD-005 A5 adds 3 stage cells. T028 and `research.md` say 72; they need a Gate 2 revision before T081 enforces the palette cell.
- **Unchanged:** every other approved decision and entry gate, all OD, F and JG items, A11Y-01, M-01, and FP-003 (not authorized). No implementation is authorized.

Date / approved by: 2026-11-13, project owner (items 1–9; item 10 scope and the category-agnostic statement the same day). MB-01–MB-05, PD-001 A1 and PD-005 A5: 2026-11-14, project owner (proposed by the agent under delegation on 2026-11-13; MB-03 and MB-05 refined by the owner). U-1–U-6 and corrections A–C: 2026-11-14, project owner.

## PD-048 — G02: temporary Claude-led orchestration and review governance; final-verdict retired — Approved (2026-11-16), temporary and reversible

Context: Codex Sol (GPT-6.1 Sol High) is unavailable. Under G01 it was the orchestrator, `plan-review` and `final-verdict` model. On 2026-11-16 the owner authorized a temporary, reversible migration of Wanees orchestration and review governance from Codex Sol to Claude Code. The owner set the requirements: Opus 5.5 orchestrates; Sonnet 5.5 XHigh is `plan-review` for Opus-authored plans; no reviewer approves its own work, even across sessions; independent HIGH/CRITICAL review and the owner's implementation, push and deploy approvals are preserved; final-verdict is removed; history is preserved; the change is reversible. Items 2–3 below are how the orchestrator implements those requirements.

Decision:
1. **Orchestrator.** Claude Opus 5.5 High is the primary orchestrator. Codex Sol must not be invoked, retried or treated as a blocking dependency.
2. **Independent review.** Independent review stays mandatory for HIGH/CRITICAL work, with evidence-based resolution and at most two follow-up rounds. It runs in a separate session with enforced read-only permissions, routed by the AGENTS §5 author→reviewer table:
   - Opus-authored work (the orchestrator, `planning`, `migration-review`, `debate-sol`, `security-review-sol`, `critical-architecture-sol`) and `agy`-authored work go to `plan-review` (Sonnet 5.5 XHigh).
   - Sonnet-authored work (`ui`, `review`, `docs-review`, `plan-review`, or a Sonnet fallback) goes to `migration-review` (Opus 5.5 High). That review runs in a fresh read-only session that is not the orchestrator's session.
   - Work by any combination of authors is split by change set, and each part is routed as above. If the parts cannot be separated, it stays blocked for the owner.
   - Re-reviews after fixes follow the same table.
   - No reviewer approves work its own model authored, even across sessions.
3. **final-verdict retired.** The separate final-verdict role and gate are removed from the active workflow.
   - A material disagreement unresolved after two follow-up rounds keeps the task blocked and goes to the owner.
   - A push still needs the owner's explicit push authorization. Every HIGH/CRITICAL change in it must already carry a passing independent review that covers the final pushed content; later edits need re-review.
   - The `final-verdict` lane is removed from `.delegate/config.json`. Nothing in the repository dispatched it.
4. **Unchanged.**
   - Owner authorization for protected implementation tasks, commits, pushes and deployment.
   - Every Tier 2/Tier 3 gate.
   - The blocked Hydrogen XHigh `security-review` and `critical-architecture-hydrogen` lanes.
   - The Fable and Argon rules.
   - All other lane mappings.
   - Historical reviews and evidence, including the G01 Sol reviews.
5. **Reading older records.**
   - **Open Sol requirements.** Where a dated record names a Sol review as an open requirement (for example PD-042, PD-046, `plan.md`/`execution-briefs.md` PD-046 blocks, or `.scratch/` drafts), that requirement is satisfied only by an independent review under item 2. No Sol review is required, and none may be invoked.
   - **final-verdict premises.** A document whose premise is the `final-verdict` lane (for example `.scratch/review-gated-push/spec.md`) must be revisited before its next gate.
   - **Generators.** Generators that would re-emit G01 text, such as `.scratch/governance-audit-2026-11-12/generate_tasks.py`, are historical and must not be re-run without updating them.
6. **BE-7 (owner direction, 2026-11-16).** The owner's verbatim text, under "Phase 5 — Close BE-7 when eligible", is archived at `docs/context/evidence/G02-20261116/owner-authorization-verbatim.txt`. It reads (line breaks and list markers flattened):

   > "Once the new governance and reviewer requirements are verified: Dispatch one focused independent `plan-review` through Claude Sonnet 5.5 XHigh. Review only the existing BE-7 delta: G01-19, G01-23 and G01-24. T083–T085 prerequisite wording. Post-adoption PD-047 and BE-5 documentation changes. Reuse the existing evidence. If the independent review passes, reconcile BE-7 documentation and close the gate according to the updated policy. If it fails, fix only the identified findings and obtain a fresh independent review. Do not automatically start T001."

   - **Evidence.**
     - The pre-adoption G01 independent PASS: `docs/context/evidence/G01-independent-review-result/final.txt`, 2026-11-15 15:47Z.
     - The delta review: `docs/context/evidence/G02-20261116/review-BE7-delta/final.txt`, 2026-11-16. It returned **PASS** with 8 LOW findings, ran on the frozen pre-G02 snapshot in a separate read-only session, and reported `readOnlyViolation: false`.
   - **The orchestrator's reading** of "the existing BE-7 delta" and of what satisfies BE-7's "separate G01 independent review": the 15:47Z G01 PASS together with the passing delta review.
   - **Timing.** BE-7 stays open until G02 itself passes independent review ("once the new governance and reviewer requirements are verified") and a reconciliation edit records the closure.
   - **Closure (2026-11-16).** Both conditions were met. G02 passed independent review in follow-up round 2 (`docs/context/evidence/G02-20261116/review-G02-followup2/final.txt`), and the BE-7 delta review passed. The reconciliation edit recorded BE-7 closed in `tasks.md`, `plan.md`, `backend-first-amendment.md` (BE-7 closure record), `entry-gate-assessment.md`, `entry-gate.md`, `docs/context/06-roadmap.md` and PD-047's BE-5 note. The pre-edit roadmap and `entry-gate.md` are in the pre-G02 backup (addendum hash list `pre-G02-backup-addendum.sha256`). T001's separate named authorization remains outstanding.
   - **The 8 LOW findings** are recorded follow-ups. Under the PASS criterion none blocks BE-7. The reconciliation addresses F7, which concerns citing the evidence.
   - **Limits.** This direction closes no other gate and authorizes neither T001 nor any implementation.
7. **Scope.** This decision covers governance, configuration, documentation and compatibility changes only. It does not authorize application implementation, T001, staging, commits, pushes or deployment.

Isolation evidence (2026-11-16, `D:\Wanees-Delegation-Evidence\G02-20261116\`):
- **Read-only isolation.** An adversarial probe ran through the `claude-delegate` relay with `--read-only --model claude-sonnet-5-5 --effort xhigh`, on the pre-G02 tree.
  - The session's init event shows tools `[Glob, Grep, Read]`, `permissionMode: plan` and no MCP servers.
  - The brief asked it to write inside and outside the repository and to run a shell. Write, edit and shell tools were absent, so it made no such call; its only call was one Read.
  - The before/after hashes were identical for Git status, the diff, `AGENTS.md`, `.delegate/config.json`, `.scratch/` and the evidence directory.
  - `readOnlyViolation` was false.
  - The reviewer's session ID differed from the orchestrator's.
- **Effective effort.** Claude Code 2.1.325 documents a silent per-model effort downgrade. A Stop hook captured the CLI's post-downgrade `CLAUDE_EFFORT`. It reported `xhigh` for Sonnet 5.5 at `--effort xhigh` with the parent's inherited variable removed, and again with `--permission-mode plan` and the inherited parent environment.
  - Exact commands: `effort-probe/COMMANDS.md`.
  - Not captured directly: effort inside a relay `--lane plan-review` run, which uses the same flags but has no hook.
- **Limitations.**
  - On native Windows this is a tool restriction plus a Git tripwire, not OS isolation.
  - User and plugin hooks run outside the tool restriction. The only enabled hook plugin, Warp 2.4.0, has scripts that emit terminal notifications. Its SessionStart script also writes the CLI version to Claude's session environment file, which is outside the repository. Only its SessionStart hook was observed firing in a reviewer run.

Reversibility:
- Pre-G02 copies of every edited file and of `.delegate/config.json` (hash `a12c5ea3…62c2c`) are kept in two places:
  - `D:\Wanees-Delegation-Evidence\G02-20261116\pre-G02-backup\`;
  - `%USERPROFILE%\.config\delegate-skills\backups\G02-20261116\pre-G02-backup\`.
- Their hash list `pre-G02-backup.sha256` has SHA-256 `0b422044199efe583919b6249c9ce09d196236b19e9d3eaf773aef31d8a86e18`.
- These edits are uncommitted or untracked, so Git alone cannot restore G01.
- One further file, `.scratch/review-gated-push/spec.md`, is not in the backup. Its only change is the inserted "Note (2026-11-16)" blockquote after the Version line, plus a blank line; deleting both reverts it.
- To reinstate G01: restore those files, re-approve the project config, and mark this entry Superseded. Do this only on the owner's explicit instruction.

Consequences: these documents now cite G02:
- AGENTS §5;
- rule 04 item 4;
- `tasks.md`: the Status line, the Review-risk line, the routing summary, the review wording of all 85 cards, and the T081/T082 acceptance criteria;
- `backend-first-amendment.md` §8 and §10.

Superseded G01 wording in those passages is quoted verbatim or preserved alongside the change, or preserved in the pre-G02 backup (see Reversibility).

Date / approved by: 2026-11-16, project owner (authorization of the temporary migration and the BE-7 direction in item 6). Recorded by Claude Opus 5.5 as orchestrator.

---

## PD-049 — Conditional auto-merge of eligible Wanees Phase PRs; GitHub AI review supplements G02 — Approved (2026-11-16)

> **Partly superseded by PD-050 (2026-11-16):** item 8 (ruleset requires conversation resolution) and the PR-based routine delivery in item 1 no longer apply. The Consequences sentence on commit, push and PR authorization is likewise superseded by PD-050. The remaining items stay approved and dormant while `LIP_AUTOMERGE_ENABLED` is `false`.

Context: the owner approved the target flow "Spec Kit Phase → Delegate Implementation → Phase Tests → Independent Code Review → Commit → Push → PR → GitHub CI + Claude AI Review → Conditional Auto-Merge to main". The automation is `.github/workflows/claude-pr-review.yml`, `.github/workflows/claude-auto-merge.yml` and `.github/scripts/` (`automerge-policy.mjs`, `claude-review-gate.mjs`, `gate-policy.test.mjs`). Independent G02 review rounds 1–3 ran under `.scratch/pr-automation-20261116/review/`; the owner authorized round 3 and one focused delta review after it.

Decision:
1. **Conditional auto-merge.** This decision, together with the owner setting `LIP_AUTOMERGE_ENABLED` to `true` (item 10), is the owner's standing explicit authorization (constitution Article X.4, AGENTS §8, rule 04 item 5) for the Claude Auto-Merge Gate workflow to create the squash-merge commit on `main` for a PR that passes every policy check. It authorizes nothing else: commits, pushes and PRs by agents still need the owner's explicit authorization, and the pre-PR independent G02 review (AGENTS §5, PD-048) is still required for HIGH/CRITICAL work; a green gate never replaces it. A Phase PR (`feat/wanees-phase-<N>`) into `main` may be merged by the Claude Auto-Merge Gate workflow only when every policy check in `automerge-policy.mjs` passes on the exact head SHA. Every other PR, and every sensitive Phase PR (governance, security, auth, tenant isolation, schema, migration, contract, ledger, build, deployment, or anything outside the allowlist), requires a human merge by the owner. No agent merges.
2. **Review layering.** The GitHub Sonnet review supplements, and never replaces, the independent G02 review (PD-048, AGENTS §5).
3. **Native auto-merge stays OFF.** "Allow auto-merge" stays disabled in repository settings. The workflow never arms native auto-merge, and its `disarm` job cancels any armed request on a Phase PR.
4. **Security findings.** A security-category finding at any severity blocks auto-merge.
5. **Fail-closed cancellation (R3-1).** A review attempt whose review step started, including a force-cancelled step with a null or missing conclusion, and whose gate did not succeed, counts as a failed review for that SHA.
6. **No application code auto-merges (R3-2).** `apps/bff` is excluded (owner decision, round 2). Implementation detail reviewed under G02 (not an owner-listed item): in `apps/web` only non-executable files (stylesheets, images, fonts, locale message JSON) and new test files outside Next.js routing directories are eligible. Next.js server-side or uncertain code always needs a human merge.
7. **Tests** (implementation detail fixing review finding F1, reviewed under G02; not one of the owner's listed decisions). Only added test files are eligible; modifying, renaming or removing an existing test needs a human merge.
8. **Branch ruleset.** The `main` ruleset requires conversation resolution.
9. **Fork patch.** The added self-test step in upstream `.github/workflows/ci.yml` is recorded as FP-006 in `docs/context/07-fork-patches.md` (FP-004 and FP-005 stay reserved for the unauthorized OD-09 and OD-15 candidates).
10. **Activation** (implementation detail reviewed under G02; the owner sets the variable). The workflow stays inert until the owner sets repository variable `LIP_AUTOMERGE_ENABLED` to `true` after completing `.scratch/pr-automation-20261116/ACTIVATION.md`.

Consequences: `.agents/skills/wanees-phase/SKILL.md` no longer states that the owner merges every Phase PR; eligible Phase PRs may merge through the gate workflow, sensitive ones wait for the owner. Owner authorization for commits, pushes, PRs, deployment, T001 and every Tier 2/Tier 3 gate is unchanged. This decision does not itself change any GitHub setting or enable the workflow.

Date / approved by: 2026-11-16, project owner. Recorded by Claude Opus 5.5 as orchestrator.

## PD-050 — Direct-to-main delivery for Wanees development; PD-049 PR flow dormant — Approved (2026-11-16)

Context: the owner directed on 2026-11-16 (full verbatim text: `docs/context/evidence/PD-050/owner-instruction-20261116.md`): "I authorize normal commits and direct fast-forward pushes to main for completed, reviewed, authorized development tasks. Do not create new PRs for routine Phase delivery." The GitHub `main` ruleset "main protection (PD-049)" required a pull request, a `verify` check and a `Claude PR Review` check; the Claude review had failed on PR #6 (run 43854802214, job 133256180630).

Decision:
1. **Direct delivery.** Routine delivery is a fast-forward push to `main` of a commit that contains the latest `origin/main`. No PR is created unless the owner asks for one.
2. **Ruleset.** The `main` ruleset keeps `deletion`, `non_fast_forward` and the required `verify` check (strict, up to date), and has no bypass actor. Its `pull_request` rule and the `Claude PR Review` required check are removed. GitHub accepts a push to a branch with required checks only when they already passed on that commit on another ref, so the delivery commit is first pushed to `deliver/<slug>`; CI runs there (FP-007, `.github/workflows/ci.yml`; an implementation detail within owner item 2, reviewed under G02, not a separately listed owner decision).
3. **Gates before each push.** Task authorization and closed gates; relevant tests and standard verification run locally; an independent review (AGENTS §5, G02) that passes on the exact content pushed; a green `verify` on that exact SHA on the delivery branch; `main` fast-forwardable. A `deliver/*` branch is never deleted by an agent.
4. **PD-049 status.** Superseded in part (its item 8 and the PR-based routine delivery in item 1). The Claude PR review and auto-merge workflows stay in the repository, dormant. `LIP_AUTOMERGE_ENABLED` stays `false`; native auto-merge stays off.
5. **Not authorized.** Force pushes, branch deletion, deployment, application-secret changes, any task lacking its own authorization and any bypass actor.
6. **Orchestrator note.** G02 names Claude Opus 5.5 High as orchestrator. This decision was recorded by an orchestrator session running Claude Sonnet 5.5, a deviation from G02 and from the owner's instruction "Use Claude Opus 5.5 High for orchestration and high-risk decisions" (`docs/context/evidence/PD-050/owner-instruction-20261116.md`), reported to the owner in the session report of 2026-11-16 and not yet accepted by the owner; independent review was by the Opus 5.5 High `migration-review` lane.

Consequences: `AGENTS.md` §3 table row and §8, rule 04 item 5 and `.agents/skills/wanees-phase/SKILL.md` §7 are updated; `references/pr-template.md` is retained only for owner-requested PRs.

Date / approved by: 2026-11-16, project owner.

## PD-051 — Batch 2 design decisions D1-D8 and T006/T007/T012/T013 authorization (conditional) — Approved (2026-11-17)

Context: the owner issued the "Batch 2 Consolidated Decisions" on 2026-11-17 in response to `.scratch/batch2-drafts/consolidated-approval-proposal.md` (verbatim text recorded in the Wanees session of that date).

Decision:
1. **D1 (Approved).** Generate a complete per-column schema manifest and a per-table RLS policy matrix from the approved data model (`specs/002-p0-prd/data-model.md` §§1-4). Independent review and explicit validation of the resulting manifest are required before any schema implementation.
2. **D2 (Approved).** PostgreSQL `gen_random_uuid()` for directory UUID keys. Explicitly specified ULID text representations are preserved.
3. **D3 (Approved).** Migration tables are schema-qualified in their owning schemas (`bff`, `directory`) with a pinned secure migrator `search_path`.
4. **D4 (Approved as a rejection).** Not every LIP HTTP 500 is a definite refusal. Potentially committed accrual operations are uncertain until reconciliation. Recovery never creates a second business operation and never changes the idempotency key. (This replaces the proposal's "retry with the same key" recommendation.)
5. **D5 (Approved).** BFF-side balance synchronization before reservation cancellation or re-reservation, subject to verified concurrency and expiry behavior.
6. **D6 (Not approved).** Journal lease, dispatch-timeout and `source.system` values remain unselected. Evidence-based proposals only.
7. **D7 (Approved).** BFF enforcement prevents accrual at inactive locations, verifying authorization and location state at the appropriate operation boundary.
8. **D8 (Not approved).** T009 stays blocked. A benchmark input worksheet with sourced values and marked unknowns is prepared; no invented load assumptions or unauthorized staging access.
9. **Authorization.** Gate 2 content approval and implementation authorization for T006, T007, T012 and T013 only to the extent their existing reviewed scopes and entry conditions are fully satisfied by the decisions above. Portions depending on the unvalidated D1 manifest, on D6 constants or on other unresolved gates do not begin. T009 remains blocked.

Consequences: no existing Approved decision changes. D4 supersedes the Proposed text in `.scratch/batch2-drafts/journal-execution-brief.md`. The authorization is conditional and per-task; it is not a gate waiver.

Date / approved by: 2026-11-17, project owner.

---

---

Template for new entries:

```
## PD-0XX — Title — Proposed|Approved
Context:
Decision:
Consequences:
Date / approved by:
```

## PD-052 — Continuous, persistent Wanees execution workflow; consolidated approval requests — Approved (owner directive, 2026-11-17)

Context: the owner directed on 2026-11-17: "FIX THE WORKFLOW ITSELF … The owner requires continuous Spec Kit implementation across the entire dependency graph." Diagnosis: `phase-status.mjs` returned `resume` for any saved Phase not `merged` (so a Phase with recorded tasks or a blocked Phase wedged selection) and `stop`/`blocked` as terminal actions; selection and state were per Phase and per working tree (a delivery worktree saw no state and no fleet trust); `SKILL.md` ended with "report … then stop", reported on every invocation and treated a Phase as the unit of delivery; there was no run-level record to resume after compaction.

Decision:
1. `/wanees-phase run` is a continuous loop (Load State → Select Eligible Task → `/speckit-implement` → Test → Independent Review → Deliver → Update State → Select Next Task) over the whole dependency graph. Task, Phase and fast-forward-push boundaries never stop it. Exits: `finish` (COMPLETE or BLOCKED), a hard environment or governance fault, or compaction (resume through `run-state.mjs init`).
2. A blocked task is parked with the exact approval it needs and never terminates the run. Dependants still wait for verified `done`.
3. A recorded implementation authorization, including a labelled consolidated batch (`(owner, YYYY-MM-DD, batch <label>)`), is durable across Phases and deliveries and is never asked for again. PD-050 remains the standing delivery authorization. Recommendations, drafts and review verdicts are never approvals, and the orchestrator never records an authorization the owner did not write.
4. When no task is eligible, ONE consolidated approval request (every approval-pending task, the gates to close, what is not yet requestable) is written into the BLOCKED report.
5. The success marker `COMPLETE-<runId>.flag` is written only by `run-state.mjs finish`, only when every card is verified done, nothing is parked or in progress, and every completed task has a recorded delivery. Phase 8 gated tracks keep it unreachable until the owner un-gates them.
6. `speckit-implement` is the implementation engine and is not edited (managed by the `specify` CLI); its generic stop points are bound in `SKILL.md` §0.
7. No gate, approval, review requirement, Git safety rule or PD-050 delivery condition is weakened.

Consequences: `.agents/skills/wanees-phase/` (SKILL.md, state-schema.md, phase-status.mjs, run-state.mjs and both self-tests), the pointer `.claude/skills/wanees-phase/SKILL.md` and the AGENTS.md §3 row change. No product code, upstream LIP file or contract changes.

Date / approved by: 2026-11-17, project owner (directive); implementation review per AGENTS §5 (G02).
