# Business rules and invariants

"MUST" rules are binding. "Default" values are **proposed starting values,
not yet approved** — owner-configurable once approved in 01-decisions.md.
Rules marked (LIP) are already enforced by the LIP engine/spec — do not
reimplement them, call LIP. Rules marked (OURS) must be built in our layer.

## Tenancy & privacy

- MUST: every business-owned row is isolated at the database level (Postgres RLS),
  not only filtered in the UI. (LIP for engine tables; OURS for new tables)
- MUST: a business sees only customers enrolled in its own program. (OURS, PD-001)
- MUST: points and rewards never transfer between businesses. (LIP — separate programs)
- MUST: raw phone/email never cross `/lip/v1`; only opaque `member_id`. (LIP)
- MUST: identity values never appear in logs, URLs, or idempotency keys. (LIP spec)
- MUST: marketing consent is stored per business with purpose, policy version,
  source and timestamp; transactional messages do not require marketing consent. (LIP platform; OURS for per-brand UI)
- MUST: account deletion closes every membership, erases profile PII, keeps the
  pseudonymous immutable ledger. (LIP erase contract + OURS orchestration)

## Money, points, stamps

- MUST: integer minor units; EGP uses piasters (`4550` = 45.50 EGP). (LIP)
- MUST: eligible spend = line subtotal − line discount; tax, tip, service charge
  do not earn by default. (LIP foodservice profile)
- MUST: rounding applies once on total eligible spend, never per line. (LIP)
- Default points rule (illustrative): 5 points per 100 EGP.
- Default stamps rule (illustrative): 1 stamp per paid order; 5 stamps → 1 free drink; card resets on issue.
- MUST: reaching a stamp threshold issues the reward exactly once per accrued order. (LIP)
- MUST: expired points are consumed FIFO by earliest expiry; spent points never expire. (LIP)

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
- (OURS) A "bill amount only" purchase becomes one synthetic order line marked
  loyalty-eligible; the BFF owns `order_id` generation per scan session.

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
- Token is server-signed, single-use, bound to {customer, business}, TTL ≤ 60 s,
  refreshed in the app automatically.
- Replay of a consumed token MUST fail with a clear error, not a silent success.

Method A — customer scans branch QR (convenience path):
- Creates a *pending claim* only; no value is granted until a staff member of
  that branch confirms it and enters the bill amount.
- The customer's phone shows their first name and a claim code, unique among
  open claims at that branch.
- MUST: the cashier confirms by **typing** the claim code; no pick-from-a-list.
  A wrong code is rejected; repeated wrong codes cancel the claim (default 3).
- Pending claims expire (default 15 min). One open claim per customer per branch.
- Branch QR codes are rotatable by the owner if leaked.

## Rewards & redemption

- MUST: redemption = reserve → capture; abandon = reverse/expire. Use the
  effect returned by the reservation, never recompute from display text. (LIP)
- MUST: an issued reward code/QR is a bearer credential: unique, never logged. (LIP)
- Default: one reward per order; owner may allow stacking.
- Default reward expiry: 30 days after issue (configurable).

## Staff controls (OURS)

- Cashier role: record purchase, redeem reward, view customer first name +
  card progress. No export, no program edits, no other branches.
- MUST: manual adjustments are owner-only; the cashier cap is 0. (PD-003)
- MUST: every non-purchase source of value (manual adjustment, campaign,
  automation, import) carries a stable business id and is idempotent. (PD-003)
- MUST: a staff profile's phone number is OTP-verified at creation; changing it
  requires owner approval. (PD-003)
- MUST: a staff session cannot award, confirm a claim, or redeem for the
  customer account with the staff member's own phone number; the owner can,
  with an audit record. (PD-003)
- Owner alert on anomalies: many scans of the same customer in a short window,
  scans outside opening hours, a staff member awarding to the same few customers.

## Messaging & automation (OURS, P1)

- MUST: marketing sends require per-brand marketing consent; every message has opt-out.
- Default frequency cap: max 2 marketing messages per customer per brand per 7 days.
- Default send window: 10:00–21:00 Africa/Cairo.
- MUST: never send an offer that is expired or already redeemed.
- MUST: never send the same campaign to the same customer twice.
- Attribution: a return visit within the attribution window counts toward the
  campaign; use LIP holdout groups to measure lift.

## Subscriptions (OURS on LIP Cloud)

- Plan limits (customers, branches, messages) enforced server-side under a lock (LIP Cloud quotas).
- Billing via Kashier (PD-005): we run renewals ourselves by charging the saved
  card token each cycle; a renewal is idempotent per (subscription, period) so a
  retry never charges twice; payment status changes only from a verified webhook.
- On payment failure: grace period, then read-only dashboard; customers keep
  their balances and can still redeem (never punish the end customer).
