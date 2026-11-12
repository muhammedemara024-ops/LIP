# Business rules and invariants

"MUST" rules are binding. "Default" values are **proposed starting values,
not yet approved** — owner-configurable once approved in 01-decisions.md.
Exception: the values listed in PD-020 (operational defaults) were approved on
2026-11-12 and are marked "approved" with the PD-020 reference where they
appear below; any other "Default" stays proposed.
Rules marked (LIP) are already enforced by the LIP engine/spec — do not
reimplement them, call LIP. Rules marked (OURS) must be built in our layer.

## Tenancy & privacy

- MUST: every business-owned row is isolated at the database level (Postgres RLS),
  not only filtered in the UI. (LIP for engine tables; OURS for new tables)
- MUST: a business sees only customers enrolled in its own program. (OURS, PD-001)
- MUST: points and rewards never transfer between businesses. (LIP — separate programs)
- MUST: raw phone/email never cross `/lip/v1`; only opaque `member_id`. (LIP)
- MUST: personal data (phone, name, birthday, consent) lives only in the
  platform customer directory, in its own schema and database role, behind its
  own service interface. The BFF never copies phone numbers into LIP, logs,
  analytics or message-job payloads beyond what sending requires. (OURS,
  PD-006 — so only the directory would move if data must stay in Egypt)
- MUST: identity values never appear in logs, URLs, or idempotency keys. (LIP spec)
- MUST: marketing consent is stored per business with purpose, policy version,
  source and timestamp; transactional messages do not require marketing consent. (LIP platform; OURS for per-brand UI)
- MUST: account deletion closes every membership, erases profile PII, keeps the
  pseudonymous immutable ledger. (LIP erase contract + OURS orchestration)
- MUST: account deletion is queued, not run, while a void is in progress for
  one of the customer's memberships; it runs after the void completes or is
  resolved. (OURS, PD-008 A1)
- MUST: the owner sees a customer's first name, card progress, visit history
  and the last 3 digits of the phone number; owner search is by first name plus
  last 3 digits only; the cashier sees first name and card progress only; no
  customer export in P0. (OURS, PD-013 — legal confirmation pending in task 0.10)
- MUST: no personal data is written to LIP `/platform/v1` customer records; the
  customer directory is the only store. (OURS, PD-013)
- MUST: every Super Admin read of customer directory data is audited with a
  reason. (OURS, PD-013)

## Money, points, stamps

- MUST: integer minor units; EGP uses piasters (`4550` = 45.50 EGP). (LIP)
- MUST: eligible spend = line subtotal − line discount; tax, tip, service charge
  do not earn by default. (LIP foodservice profile)
- MUST: rounding applies once on total eligible spend, never per line. (LIP)
- Default points rule (illustrative): 5 points per 100 EGP (approved as the
  wizard suggestion, PD-020).
- Default stamps rule (illustrative): 1 stamp per paid order; 5 stamps → 1 free drink; card resets on issue.
- MUST: one active program per café, stamps or points; the type is locked after
  the first publish. (OURS + LIP, PD-012)
- MUST: stamp programs always reset the card on issue (`reset_on_issue: true`).
  (OURS, PD-012)
- MUST: minimum eligible spend is at least 1 piaster, so a zero-value order
  never earns. (OURS, PD-012)
- MUST: reaching a stamp threshold issues the reward exactly once per accrued order. (LIP)
- MUST: after a completed void, a stamp card's balance lies in [0, threshold).
  (OURS, PD-008 A1)
- MUST: stamps never expire. (LIP behaviour; OURS setting, PD-012)
- Point expiry (approved, PD-020): 365 days after earning by default; café
  setting 180, 365, 545 or 730 days, or never. "Never" vs "expiring" is locked
  after the café's first purchase; a duration change applies only to points
  earned afterwards; warning 30 days before. Expiry is shown as date and time
  in Cairo (PD-007 C1).
- MUST: expired points are consumed FIFO by earliest expiry; spent points never expire. (LIP)
- A void consumes the soonest-expiring points first. (LIP; accepted, PD-020)

## Transactions

- MUST: every write has an idempotency key and a stable business id. Retrying
  the same key with the same payload returns the original result; same key with
  different payload is a conflict. (LIP)
- MUST: the same `order_id` can never earn twice, even with a new idempotency key. (LIP)
- MUST: refunds/voids are new adjustments that claw back value; hiding a
  clawback is not allowed; negative balance may be allowed. (LIP)
- MUST: corrections are new ledger entries; no UPDATE/DELETE on ledger. (LIP)
- MUST: manual adjustments carry classification (`bonus|gift|migration|service_recovery|correction`),
  reason, actor, and an explicit tier-qualification flag. (LIP)
- (OURS, PD-008) A "bill amount only" purchase becomes one synthetic order line
  marked loyalty-eligible; the BFF owns `order_id` generation per scan session.
  Product/category/tag exclusions do not apply; stamps are per paid order.
- MUST (PD-008): the cashier types the amount actually paid for eligible items
  (after discounts, excluding free reward items); the input label is a café
  setting: "Amount paid" (default) or "Subtotal before service & VAT".
- MUST (PD-008): the earn preview comes from LIP `orders/evaluate`, never from
  client-side math.
- MUST (PD-008): above the café's large-bill threshold (default 2,000 EGP,
  approved, PD-020) the amount is typed twice; above 5 × the threshold it is
  rejected (owner-only adjustment).
- MUST (PD-008, amended by A1): a void never grants new purchase or tier value;
  the only stamps it adds back are the system stamp-restore correction
  (PD-003 A2). A cashier may void only their own purchase
  within 10 minutes (full clawback via `orders/adjust`). Owner voids and owner
  full refunds of stamp purchases use the same void operation.
- MUST (PD-008 A1): in a stamp program the void operation computes a plan once,
  saves it and replays it, never recomputes it: cancel k unredeemed,
  unreserved stamp rewards issued after the purchase (k = max(0,
  ⌈(stamps earned − current balance) / threshold⌉), where stamps earned is the
  amount stored on the purchase record, never recomputed from the current
  program), void the order, then post
  the system stamp-restore correction of k × threshold (PD-003 A2). Ids:
  `void:<void id>:cancel:<reward id>`, `void-<void id>`,
  `void-<void id>-restore`.
- MUST (PD-008 A1): the void is blocked and goes to the owner if the program was
  republished since the purchase, another void is in progress for that member,
  the balance is outside [0, threshold), or fewer than k cancellable rewards
  exist.
- MUST (PD-008 A1): after a crash or failure, reconcile uncertain LIP calls
  against authoritative records using the persisted step plan and stable
  business IDs; retry idempotently with the same identifiers and request bodies.
  Calls may have succeeded before the BFF saved their results. After 15 minutes
  of retries mark the void *needs owner*; after 24 hours escalate to the Super
  Admin. Audit recovery and evidence, and alert while unreconciled.
- MUST (PD-008 A1): owner and Super Admin resolution, like automatic completion,
  reaches a terminal state and clears the durable member flag only after all
  expected cancellation, clawback and required stamp-restore effects are
  verified against authoritative LIP reward and ledger records, including any
  owner settlement. No force-close or administrative override clears the
  block while inconsistencies remain; unreconciled cases remain blocked and
  escalated for audited recovery.
- MUST (PD-008 A1): every operation that can change one member's stamp balance
  or rewards — purchases, redemptions, voids, owner adjustments of any
  classification, and campaign, automation or import grants — is serialized
  by a per-member lock. A durable "void in progress" flag refuses all of them
  for that member (clear error) until the void completes or is resolved; only
  the void's own steps and the owner's settlement of a *needs owner* void
  bypass it. Escalation after 15 minutes and 24 hours never clears the flag
  without the reconciliation required above.
- MUST (PD-008 A1): a redemption without a purchase uses a synthetic zero-value
  order in its own `order_id` namespace and is never accrued.

## QR flows (OURS, PD-003)

At the counter:
- MUST: purchase accrual and counter redemption run only from an authenticated
  staff session of the same business at an allowed branch; record staff id,
  device id, branch id.
- MUST: the staff member enters the bill amount; the customer never does.
- MUST: no cashier lookup of a customer by phone number (MVP). If the customer
  QR cannot be scanned, the fallback is Method A, or no award.
- MUST: the customer app never reserves or captures a reward. Its "Redeem"
  button only displays the reward QR (including issued rewards); reserve →
  capture runs from a staff session.
- MUST: no value is granted offline; the staff app shows a clear error.
  Purchases made during an outage are never awarded retroactively by staff;
  the owner may post a classified `service_recovery` adjustment with a reason.

Method B — staff scans customer QR (trusted path):
- Code is **server-verifiable, device-bound** (amended 2026-11-06, PD-003 A1;
  was "server-signed"): derived on the customer's device from a device secret,
  rotating with TTL ≤ 60 s, works offline on the customer side.
- MUST: each code is single-use on the server and bound to {customer, device}
  and to the business whose card is shown.
- MUST: at most 3 active devices per customer; the customer can see and revoke
  them. The device secret is rotated every time the app is online.
- Offline display requires the app to have been opened online at least once on
  that device (installed PWA with a service worker).
- A Google Wallet pass counts as a customer device (PD-003 A1 addendum, PD-009):
  rotating TOTP code, single-use, bound to {customer, pass, café}, earning only;
  no static barcode is ever accepted.
- Replay of a consumed token MUST fail with a clear error, not a silent success.

Method A — customer scans branch QR (convenience path):
- Creates a *pending claim* only; no value is granted until a staff member of
  that branch confirms it and enters the bill amount.
- The customer's phone shows their first name and a claim code, unique among
  open claims at that branch.
- MUST: the cashier confirms by **typing** the claim code; no pick-from-a-list.
  A wrong code is rejected; repeated wrong codes cancel the claim (3 attempts,
  approved and platform-fixed, PD-020).
- Pending claims expire (15 min, approved and platform-fixed, PD-020). One open
  claim per customer per branch.
- Branch QR codes are rotatable by the owner if leaked, in every subscription
  stage (PD-005 A2).

## Rewards & redemption

- MUST: redemption = reserve → capture; abandon = reverse/expire. Use the
  effect returned by the reservation, never recompute from display text. (LIP)
- MUST: an issued reward code/QR is a bearer credential: unique, never logged. (LIP)
- MUST: rewards are free items only in P0; discount rewards are P1. (OURS, PD-015)
- MUST: at most one reward per order, enforced by the BFF with a unique
  constraint, including concurrent attempts. Stacking is backlog. (OURS,
  PD-015; supersedes the earlier "default; owner may allow stacking")
- MUST: a redemption never takes a balance below zero; a clawback may. (PD-015)
- Reward expiry (approved, PD-020): 30 days after issue; café setting 7–90 days.
- MUST: stamp rewards are reserved only through `issued_reward_id`, never by a
  direct catalogue reserve; a stamp reward's direct cost equals the threshold.
  (OURS, PD-008 A1, PD-012)
- MUST: the BFF never issues a reward id starting with `stamp-`; owner gifts
  use other ids. (OURS, PD-008 A1)
- MUST: a reservation not captured within 120 seconds is reversed by the BFF.
  (OURS, PD-020)
- MUST: "rewards redeemed" reports count reservation (capture) records, because
  free-item redemptions write no ledger entry. (OURS, PD-015, PD-018)

## Staff controls (OURS)

- Cashier role: record purchase, redeem reward, view customer first name +
  card progress. No export, no program edits, no other branches.
- MUST: manual adjustments are owner-only; the cashier cap is 0. (PD-003)
  Only exception: the system stamp-restore correction inside a permitted void
  (PD-003 A2); no person can request it or enter its amount.
- MUST: the BFF enforces every product permission; tenant and branch come from
  the session or registered device, never from the request body. LIP's
  `protocol:write` alone is not a sufficient check. (OURS, PD-014)
- MUST: the owner awards and redeems only through a staff session on a
  registered device. One owner per café. (OURS, PD-014)
- MUST: an owner stamp adjustment outside a void keeps the balance in
  [0, threshold), is refused while a void is in progress for that member, and
  owner gifts never use `stamp-` reward ids. (OURS, PD-008 A1)
- MUST: balance corrections happen only through voids or owner adjustments
  with a classification; support staff never change balances. (OURS, PD-019)
- MUST: every non-purchase source of value (manual adjustment, campaign,
  automation, import) carries a stable business id and is idempotent. (PD-003)
- MUST: a staff profile's phone number is OTP-verified at creation; changing it
  requires owner approval. (PD-003)
- MUST: a staff session cannot award, confirm a claim, or redeem for the
  customer account with the staff member's own phone number; the owner can,
  with an audit record. (PD-003)
- Owner alert on anomalies: many scans of the same customer in a short window,
  scans outside opening hours, a staff member awarding to the same few customers.

## Language & locale (OURS, PD-007)

- Default UI language is Arabic (RTL) on every product surface, regardless of
  browser/phone language; English is second. The choice is stored on the
  account; before sign-in it is kept in a cookie and copied at sign-in.
- MUST: localized display text (program, reward, branch names/descriptions) is
  stored in our layer keyed by id + language; LIP keeps one internal label.
- MUST: each café's main content language is required; the other is optional
  and falls back to the main one.
- MUST: Western digits (0–9) on display; inputs accept Western, Arabic-Indic and
  Persian digits and normalize to Western.
- MUST: money shows as `45 ج.م` / `45.50 ج.م` (Arabic) and `EGP 45` /
  `EGP 45.50` (English); zero piasters are hidden. Entered pounds are converted
  to integer piasters.
- MUST: codes, phone numbers and amounts inside Arabic text use Unicode bidi
  isolation (`<bdi>` / `dir="ltr"`), never inserted control characters.
- MUST: messages follow the customer's language; every launch WhatsApp template
  exists in Arabic; English falls back to Arabic.
- MUST: time zone is always the IANA name `Africa/Cairo` (never a fixed offset;
  Egypt observes DST) for display and day-based rules; timestamps stored in UTC.

## Customer sign-in (OURS, PD-004)

- MUST: OTP codes are stored as an HMAC with a server-side secret (never plain
  or plain-hashed), compared in constant time; one active code per phone, and a
  new code invalidates the previous one.
- MUST: session ids are random (≥ 256 bits) and stored hashed; cookies are
  httpOnly + Secure + SameSite; state-changing requests carry CSRF protection.
- MUST: Node's built-in `crypto` only; no hand-rolled primitives.
- MUST: only Egyptian mobile numbers (`+20 1x…`) at launch.
- MUST: bot check (Turnstile) before the first send; per-phone, per-IP and
  per-device limits; a platform-wide circuit breaker (daily caps on OTP sends
  and spend) pauses sending and alerts the platform admin.
- MUST: changing the phone number requires an OTP to the new number and
  revokes every session and device secret.
- Defaults: 6-digit code, valid 5 min; resend cooldown 60 s; per phone ≤ 5
  sends/hour, ≤ 10/day; ≤ 5 wrong attempts per code; session slides 90 days.
- Channel: WhatsApp authentication template first; SMS fallback in Arabic,
  WebOTP-formatted (`@<domain> #<code>` last line), one 70-character segment.
- OTP cost is a platform cost, never counted against a café's message allowance.
- The OTP defaults above are approved and platform-fixed (PD-020).

## Owner and Super Admin sign-in (OURS, PD-010, PD-011)

- MUST: owners sign in by phone number + OTP through the PD-004 OTP service;
  session 30 days, sliding.
- MUST: a fresh OTP is required to create or deactivate staff, publish the
  program, post a manual adjustment, or change the owner's phone number.
- MUST: the Super Admin signs in through OIDC with MFA enforced by the identity
  provider; we store no Super Admin passwords (provider chosen in task 2.2).
- MUST: every session can be revoked; cookies are host-only with the `__Host-`
  prefix, one per subdomain.
- MUST: an owner invite is single-use, bound to the owner's phone number, valid
  72 hours and stored hashed.
- Live OTP and invite delivery to real numbers depends on task 0.11.

## Messaging & automation (OURS; items marked P0 are P0, the rest P1)

- (P0) P0 sends OTP messages only (PD-016); consent is still captured at sign-up,
  and the customer app shows balances that expire soon. Live delivery depends
  on task 0.11.
- (P0) Support: a platform WhatsApp number with phone fallback, separate from the
  OTP and marketing senders (PD-019; depends on tasks 0.10 and 0.11).

- MUST: marketing sends require per-brand marketing consent; every message has opt-out.
- MUST: no marketing messages go to the customers of a café in the suspended
  stage; transactional messages (reward earned, reward expiring) still go out.
  (PD-005 A1)
- Default frequency cap: max 2 marketing messages per customer per brand per 7 days.
- Default send window: 10:00–21:00 Africa/Cairo.
- MUST: never send an offer that is expired or already redeemed.
- MUST: never send the same campaign to the same customer twice.
- MUST (PD-009): a customer with an active Google Wallet pass gets transactional
  notifications on the pass only (no WhatsApp fallback); others get WhatsApp.
  At most 3 pass notifications per 24 h, priority reward expiring > reward
  ready > stamp added; over budget, update silently. Pass messages never carry
  marketing.
- MUST (PD-009): pass data is only café brand, balance/stamps, reward status and
  a random pass id unlinkable to customer id or `member_id`; no phone, no name.
- Attribution: a return visit within the attribution window counts toward the
  campaign; use LIP holdout groups to measure lift.

## Subscriptions (OURS on LIP Cloud)

- Plan limits (customers, branches, messages) enforced server-side under a lock (LIP Cloud quotas).
- Billing at launch is manual (PD-005 A1): payment is collected offline (cash,
  InstaPay, Vodafone Cash, bank transfer) and recorded by the super admin. No
  online payment and no stored card tokens.
- MUST: a payment record holds café, amount in integer piasters (EGP), method,
  reference, payment date and recorded-by, and carries a stable id so a double
  submit records it once.
- MUST: payment records are append-only; a mistake is corrected with a
  reversing entry, never an edit or delete.
- MUST: every change to a subscription's plan or period end is audited (actor,
  before/after, time).
- MUST: subscription state follows the period end date on the server, with no
  human step. Stages after the end date (approved, PD-020; Cairo calendar days):
  1. Grace, days 1–7: everything works normally.
  2. Read-only, days 8–37: owner cannot add staff, publish or change the
     program or campaigns, or post `bonus`/`gift`/`migration` adjustments
     (`migration` is owner-only and never a bypass for `correction` or
     `service_recovery`, PD-005 A2); cashiers keep
     awarding and redeeming; voids, `correction`/`service_recovery`
     adjustments, revoking staff, devices or sessions, and rotating a Branch
     QR still work.
  3. Suspended, day 38 onward: no new awards, no claim confirmations, no
     new customer joins and no `bonus`/`gift`/`migration` adjustments; customers can still redeem what they hold; voids,
     `correction`/`service_recovery` adjustments, revocations and Branch QR
     rotation still work. Balances are never removed.
  Full table: PD-005 A2.
- MUST: the stage is computed and enforced in our layer. It is never
  implemented with Cloud environment suspension, a Cloud subscription status
  other than `active`/`trialing`, or LIP write-freeze, because each would also
  block redemptions, voids and revocations. (PD-005 A2; runtime check in task
  5.5)
- MUST: the owner sees the plan, end date and current stage on the dashboard
  Overview and Settings pages. (PD-017, PD-018)
- MUST: recording a payment restores full service immediately.
- During suspension, point and reward expiry keep running as configured;
  customers are never messaged about a café's billing.
- Deferred (Kashier, PD-005): when online billing returns, a renewal is
  idempotent per (subscription, period) and payment status changes only from a
  verified webhook.
