# Product brief — Loyalty & Customer Retention Platform

Working name: TBD (do not reuse upstream "Crave" branding).

## One-liner

A multi-tenant SaaS that helps cafés and restaurants turn one-time visitors into
regulars through loyalty programs, rewards, and behavior-driven automated
marketing. Launch market: Egypt. Later: wider MENA / international.

## Value

- **Customer:** earns rewards, sees progress, receives relevant offers.
- **Owner:** knows their customers, increases visit frequency, wins back lapsed customers.

## Approved product decisions (see 01-decisions.md)

| Topic | Decision |
| --- | --- |
| Target market | Many independent cafés & restaurants (not one café) |
| Customer experience | Web app first, mobile app later (P2) |
| Loyalty types | Flexible: stamps and points (tiers later) |
| Transaction capture | Customer scans branch QR **and** staff scans customer QR |
| Business model | SaaS subscription (Starter / Growth / Premium — draft) |
| Architecture | Multi-tenant, data isolated per business at DB level |
| Languages | Arabic + English (RTL first-class) |
| Customer account | PD-001: one universal customer account, many brand cards |

An earlier, unrelated idea (offline Windows C#/WPF single-machine loyalty app)
is **out of scope** and must not be mixed into this architecture.

## Users

| Role | Does |
| --- | --- |
| Platform super admin | Manages businesses, plans, payments, usage, suspensions |
| Business owner | Branches, staff, loyalty program design, campaigns, customers, reports |
| Staff / cashier | Records purchases, adds stamps/points, redeems rewards; sees minimum data |
| Customer | Holds cards, tracks points/rewards, receives notifications, visit history |

## Modules and priority

P0 = first sellable release, P1 = after MVP proof, P2 = later.

| Module | Priority |
| --- | --- |
| Authentication (owner/staff + customer phone OTP) | P0 |
| Tenant management | P0 |
| Branch management | P0 |
| Customer management | P0 |
| Loyalty engine (stamps + points, rewards, expiry) | P0 |
| QR & transactions (both scan methods) | P0 |
| Staff management & permissions | P0 |
| Customer web app | P0 |
| Owner dashboard | P0 |
| Subscription billing | P1 |
| Push notifications | P1 |
| Campaign management | P1 |
| Customer segmentation | P1 |
| Mobile app | P2 |
| Geofencing | P2 |
| Advanced analytics | P2 |

## Loyalty engine requirements (owner-configurable)

Program type (stamps / points); earn rate per spend; stamps needed per reward;
eligible and excluded products; reward value; point expiry; reward expiry;
transferability (default: not transferable); stacking of rewards; which branches
participate. Each program has independent configuration; new program types must
be addable without rebuilding the system. Tiers (Silver 500 / Gold 1,500 /
Platinum 3,000 EGP — illustrative) are a later program type.

## Transaction capture

- **Method A — customer scans branch QR:** branch identified → customer confirms
  account → *pending* transaction → cashier confirms → stamp/points posted.
- **Method B — staff scans customer QR (preferred, anti-fraud):** customer opens
  card → short-lived rotating QR → cashier scans → enters bill amount or items →
  server validates → balance updated.

Customer-scan never grants value without staff confirmation.

## Retention automation (P1)

Triggers → actions: registered → welcome; first purchase → welcome reward;
1 stamp remaining → reminder; no visit 7/14/30 days → reminder / offer / win-back;
birthday → reward; reward earned → notification; reward expiring → reminder.
Guardrails: opt-out per brand, frequency caps, send-hour windows, no expired
offers, no duplicate campaign per customer. Measure **attribution** (who came
back because of the message), not just delivery.

## Owner dashboard pages

Overview, Customers, Loyalty Programs, Transactions, Rewards, Campaigns,
Branches, Staff & Permissions, Analytics, Billing & Subscription, Settings.
Overview cards: total customers, active (30d), visits, rewards redeemed,
customers needing attention (inactive 30d, at risk, near reward), campaign performance.

## Success metrics

Repeat visit rate, visit frequency, customer retention, reward redemption rate,
campaign conversion, business churn, MRR. North star: *did the subscribing café's
customer return rate actually increase?*

## Delivery phases

1. Discovery & PRD v1.0 (current) 2. UI/UX 3. Foundation (DB, auth, tenancy,
branches, roles) 4. Core loyalty (engine, QR, transactions, rewards, redemption)
5. Engagement & SaaS (campaigns, notifications, analytics, subscriptions)
6. Testing & launch (security, tenant isolation, QR abuse, performance, pilot cafés).
