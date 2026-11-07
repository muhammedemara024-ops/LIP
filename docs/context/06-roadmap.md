# Roadmap — phases, tasks, dependencies, acceptance

> ملخص: 8 مراحل (0 → 7). مفيش تطوير Features قبل ما المرحلة 0 تخلص.
> كل مهمة مربوطة بالفجوة اللي بتقفلها (G-xx في `03-gap-analysis.md`) وبالقرار
> اللي بتعتمد عليه (PD-xxx في `01-decisions.md`).

Status: **Draft v0.1 (2026-11-06)** — needs owner approval before Phase 1 starts.

## Rules for Claude and contributors

1. Work only on tasks whose phase gate is open and whose dependencies are done.
2. A task that depends on a **Proposed** decision is blocked until that decision is Approved.
3. Every task ends with: tests passing, docs/context updated if behavior changed,
   and a one-line entry in the task's "Done" column (date + commit).
4. New ideas go to the Backlog section at the bottom, never into an active phase.
5. Estimates are deliberately omitted until Phase 0 measures the real baseline.

## Milestones

| ID | Milestone | Exit = phase gate |
| --- | --- | --- |
| M0 | Decisions locked, baseline proven | Phase 0 DoD |
| M1 | PRD v1.0 + clickable Arabic prototype approved | Phase 1 DoD |
| M2 | Foundation: platform identity, cashier role, scalable data, OTP | Phase 2 DoD |
| M3 | A cashier can award and redeem in a real café flow (staging) | Phase 3 DoD |
| M4 | Customer web app + owner dashboard MVP | Phase 4 DoD |
| M5 | Pilot live in 1–3 real cafés | Phase 5 DoD |
| M6 | Paid launch: manual billing, automation, WhatsApp, retention KPIs | Phase 6 DoD |
| M7 | Mobile app, geofencing, advanced analytics | Phase 7 DoD |

---

## Phase 0 — Decisions & baseline (gate)

| ID | Task | Closes | Depends on | Acceptance criteria | Done |
| --- | --- | --- | --- | --- | --- |
| 0.1 | Decide PD-002: adopt LIP as loyalty core (fork + pin upstream `8ad93c8`) | — | — | PD-002 Approved or Superseded in 01-decisions.md | 2026-11-06 — Approved, conditional on 0.7 + 0.8 |
| 0.2 | Decide PD-003: staff scan is the only path that grants value | — | — | PD-003 Approved | 2026-11-06 — Approved |
| 0.3 | Decide PD-004: customer OTP provider + channel (SMS/WhatsApp) | G-06 | — | Provider and channel chosen. (JWKS condition dropped: PD-004 runs OTP in our BFF, so there is no outside token to verify. Real-number delivery test moved to 2.4.) | 2026-11-06 — Approved, conditional on the 2.4 real-number test |
| 0.4 | Decide PD-006: hosting (LIP, BFF and one Next.js app on a container host in Frankfurt; Postgres provider) | — | 0.1 | Approved; region chosen; per-service monthly cost table ≤ $100 for staging + production | 2026-11-06 — Approved (Render Frankfurt, Pro workspace, Render Postgres), conditional |
| 0.5 | Decide PD-007: Arabic-first, English second | G-14 | — | Approved | 2026-11-06 — Approved |
| 0.6 | New decision: purchase capture = bill amount only vs items | G-04 | 0.2 | Decision recorded with its effect on product exclusions | 2026-11-06 — Approved as PD-008 (bill amount only) |
| 0.7 | Baseline: `npm ci && npm run typecheck && npm test` on Node 22 | — | — | All green, result + Node version recorded here | 2026-11-07 — Passed on Linux (`node:22.22.0`, npm `10.9.4`): 62/62 files, 479/479 tests, 0 failed, 0 skipped (Windows informational run: 450 passed, 6 failed, 23 skipped) |
| 0.8 | Baseline: run Postgres profile + `lip doctor` + `lip test` | — | 0.7 | Conformance passes against Postgres runtime; idle memory of the LIP process recorded (sizes the instance, PD-006) | 2026-11-07 — Passed (`lip doctor` PASS 3/3, `lip test` PASS 5/5 against `lip-postgres`); idle memory: 27.71 MiB container cgroup / 87,780 kB (~85.7 MiB) `VmRSS` (fits PD-006 512 MB instance) |
| 0.9 | Fix upstream AI-doc drift (`skills/lip/*`, old gap doc) or mark them non-authoritative; resolve `docs/postgres.md` "attached environment-specific disks" vs diskless `render.yaml` + release runbook | — | — | Skills and docs no longer contradict code | |
| 0.10 | Legal pre-check: Egypt personal data law (151/2020), who is data controller (platform vs café) | — | — | Hard gate before the pilot (PD-006): written opinion from Egyptian counsel on whether hosting personal data in Frankfurt needs a PDPC permit and how to get it, or a permit application filed. Legal facts in PD-006 are unverified (secondary sources). If data must stay in Egypt, PD-006 reopens | |
| 0.11 | Legal entity: company commercial registration | — | — | Registration issued; blocks SMS sender-ID registration, Meta Business verification, WhatsApp authentication-template approval, the real-number test in 2.4, and the pilot (5.6) | |
| 0.12 | Dependency audit (`npm audit --omit=dev`) | — | 0.7 | Record total production vulnerabilities, critical + high packages, and prod vs dev breakdown; mandatory gate before 5.6 (Pilot) | 2026-11-07 — Recorded: 9 production vulnerabilities (1 critical: `proxy-addr`; 4 high: `@modelcontextprotocol/sdk`, `body-parser`, `fast-uri`, `zod`; 4 moderate: `@hono/node-server`, `hono`, `ip-address`, `qs`) + 10 dev-only (19 total) |

**DoD:** PD-002/003/004/006/007 and 0.6 approved; baseline green; drift fixed.

### Phase 0 Baseline & Audit Records (Tasks 0.7, 0.8, 0.12)

#### Windows run (Task 0.7 — informational only)
- **Result:** 450 passed, 6 Windows-specific failures, 23 skipped (479 total across 62 test files).
- **Windows-specific failures (6):** POSIX `chmod` file-permission assertion (`0o600` no-op on NTFS), SQLite `EBUSY` locked-file temp directory cleanup on Windows, and Windows `spawn npm ENOENT` executable resolution without `.cmd` shell wrapper.
- **Skipped tests (23):** All 23 skipped tests were PostgreSQL-gated suites (`LIP_TEST_POSTGRES_URL` unset during the host run).
- **Status:** Informational only — not a deployment blocker (Linux is the target deployment environment per PD-006).

#### Official Linux run (Task 0.7 — Docker `node:22.22.0` + `postgres:17-alpine`)
- **Node version:** `v22.22.0` (matches `.nvmrc`)
- **npm version:** `10.9.4`
- **Installation (`npm ci`):** Succeeded (`added 310 packages, and audited 325 packages in 50s`).
- **Typecheck (`npm run typecheck`):** Succeeded (`tsc -b --pretty false && npm run typecheck --workspace @loyalty-interchange/admin`, exit code `0`).
- **Test totals (`npm test` / `vitest run`):** 62 test files passed (62 total) | **479 total tests** | **479 passed** | **0 failed** | **0 skipped** (`9.28s`).
- **Skipped tests and explanations:** **0 skipped.** Configuring `LIP_TEST_POSTGRES_URL=postgres://loyalty:lip-local-password@postgres:5432/loyalty` against the disposable `compose.yaml` PostgreSQL 17 service enabled all 23 previously skipped PostgreSQL-gated tests across 8 test files (`tests/unit/tenant-isolation-live.test.ts` [11], `tests/unit/postgres-storage.test.ts` [1], `tests/conformance/postgres-lease-conformance.test.ts` [2], `tests/unit/location-report-read-path.test.ts` [2], `tests/unit/postgres-platform.test.ts` [2], `apps/cloud/src/cloud.test.ts` [1], `apps/cloud/src/migrate.test.ts` [3], `apps/cloud/src/operator-auth.test.ts` [1]).
- **Explicit tenant-isolation & lease verification:**
  1. `tenant-isolation-live` (`tests/unit/tenant-isolation-live.test.ts`): **11/11 passed** (`1124ms`) — verified live PostgreSQL RLS isolation across tenants for members, accounts, rewards, orders, redemptions, ledger entries, reservations, idempotency records, and `/platform/v1` state.
  2. Storage PostgreSQL tenant-isolation (`packages/storage-postgres/src/tenant-isolation.test.ts` + `tests/unit/postgres-storage.test.ts`): **11/11 passed** (`366ms`) and **5/5 passed** (`559ms`, including live `Postgres storage integration > migrates, round-trips normalized engine state, coordinates mutations, and leases`).
  3. `postgres-lease-conformance` (`tests/conformance/postgres-lease-conformance.test.ts`): **2/2 passed** (`181ms`) — verified `PostgresStorageAdapter.withLease` mutual exclusion and overlap prevention on live PostgreSQL.
- *Operational note:* `PostgresMigrator.migrate()` executes `CREATE TABLE IF NOT EXISTS lip_schema_migrations` before acquiring its transaction advisory lock (`lockTransaction(client, "lip:schema-migrations")`), which can trigger a PostgreSQL catalog race (`pg_type_typname_nsp_index`) if multiple Vitest workers connect simultaneously to a brand-new unmigrated database before the first migration completes.

#### Official Linux runtime & memory verification (Task 0.8)
- **PostgreSQL profile verification:** `docker compose --profile postgres up -d --build` built and started `postgres` (`postgres:17-alpine`, healthy), `lip-postgres` (`node:22-alpine`, healthy on `127.0.0.1:3211->3210/tcp`), `lip` (SQLite profile, healthy on `127.0.0.1:3210->3210/tcp`), and `wallet` (healthy on `127.0.0.1:3230->3230/tcp`).
- **`lip doctor` result (against `lip-postgres`):** **PASS** (3/3 checks passed: `discovery: LIP 1.0 foodservice discovery is valid`, `health: server reports healthy`, `authentication and capabilities: Bearer authentication accepted; capabilities are valid`).
- **`lip test` result (against `lip-postgres`):** **PASS** (5/5 checks passed: `discovery`, `health`, `authentication and capabilities`, `authentication rejection: unauthenticated mutation rejected`, `schema rejection: invalid payload rejected with problem details`).
- **LIP process idle memory (`lip-postgres`, PID 1 `node packages/server/dist/cli.js`):**
  - Container cgroup working set (`docker stats --no-stream`): **27.71 MiB** idle before diagnostics (**32.84 MiB** after `lip doctor` + `lip test`).
  - Linux kernel `/proc/1/status`: **`VmRSS`: 87,780 kB (~85.72 MiB)** idle (**90,424 kB / ~88.30 MiB** post-test); **`VmHWM` (peak RSS): 106,172 kB (~103.68 MiB)**.
  - SQLite `lip` container comparison: **29.21 MiB** cgroup idle (`VmRSS`: **92,748 kB / ~90.57 MiB**, `VmHWM`: **115,864 kB / ~113.15 MiB**).
  - **Sizing conclusion (PD-006):** Well within the 512 MB Starter container limit (~5.4% cgroup working set, ~16.7% total `VmRSS`).

#### Dependency audit (Task 0.12 — `npm audit --omit=dev`)
- **Command:** `npm audit --omit=dev` (audited across all monorepo workspaces: 182 production dependencies, 203 development dependencies, 385 total).
- **Total production vulnerabilities (`--omit=dev`):** **9 vulnerabilities** (1 critical, 4 high, 4 moderate, 0 low).
- **Critical production vulnerabilities (1):**
  - `proxy-addr` (`1.1.0 - 2.0.7`, indirect production dependency): IP spoofing via IPv4-mapped IPv6 trust subnet (`GHSA-jqcg-44mw-7w3h`, CVSS 9.1).
- **High production vulnerabilities (4):**
  - `@modelcontextprotocol/sdk` (`<=1.31.0`, direct production dependency in `@loyalty-interchange/mcp`): OAuth credential forwarding (`GHSA-6qxp-vccf-f47h`), cross-session task access (`GHSA-22jm-h49p-29qw`), validation memory exhaustion (`GHSA-46jr-4wx8-v453`), HTTP request body/batch limits (`GHSA-f897-62hf-6gxq`), plus 2 moderate advisories (`GHSA-rvq5-wwqv-78pq`, `GHSA-6prh-2h8m-c8cw`).
  - `body-parser` (`2.0.0 - 2.3.0`, indirect production dependency): DoS via trailing bytes after compressed request body (`GHSA-27r3-jxmh-p828`, CVSS 7.5).
  - `fast-uri` (`3.0.0 - 3.1.8`, indirect production dependency via TypeBox/Ajv): SSRF, host confusion, and authority injection (`GHSA-5jgf-p345-68v8`, `GHSA-f65p-4m7j-42xc`, `GHSA-fph4-wmhf-6fwf`, `GHSA-jqff-g426-hqxp`, `GHSA-qw65-cvwx-89v3`, plus moderate/low advisories).
  - `zod` (`<4.6.6`, direct production dependency): Memory exhaustion while validating oversized constrained collections (`GHSA-mrhx-c7xc-m3w5`, CVSS 7.5).
- **Moderate production vulnerabilities (4):** `@hono/node-server` (`1.19.10 - 2.1.2`), `hono` (`<=4.13.10`), `ip-address` (`<=10.7.3`), `qs` (`2.2.5 - 6.16.0`).
- **Production vs. Development breakdown:** Out of **19 total vulnerabilities** across the full workspace (`npm audit`: 1 critical, 8 high, 10 moderate), **9 are in production dependencies** (1 critical, 4 high, 4 moderate) and **10 are in development-only dependencies** (4 high: `browserslist`, `js-yaml`, `source-map-js`, `vite`; 6 moderate: `@tailwindcss/typography`, `postcss-selector-parser`, `baseline-browser-mapping`, `vitest`, `@vitest/coverage-v8`, `@vitest/mocker`). No dependencies were upgraded in Phase 0; resolution is gated before Task 5.6 (Pilot).

## Phase 1 — PRD v1.0 & UX

| ID | Task | Closes | Depends on | Acceptance criteria | Done |
| --- | --- | --- | --- | --- | --- |
| 1.1 | PRD v1.0: scope, roles/permissions matrix, user stories, business rules, out-of-scope | — | M0 | Every P0 module has stories with acceptance criteria; references 04-business-rules.md | |
| 1.2 | Customer journey (join by QR → OTP → card → earn → redeem → delete account) | G-07 | 1.1 | Flow diagram + edge cases (lost phone, wrong number, duplicate account) | |
| 1.3 | Cashier journey (PIN login → scan → amount → confirm → redeem → undo) | G-02 G-04 G-05 | 1.1 | Each step ≤ 2 taps; works on a cheap Android phone | |
| 1.4 | Owner onboarding (sign up → branch → program wizard → print QR) under 15 min | G-08 | 1.1 | Timed walkthrough on prototype | |
| 1.5 | Arabic RTL design system + Figma/prototype of all P0 screens | G-14 | 1.2–1.4 | Owner approves prototype | |
| 1.6 | Plans & limits draft (Starter/Growth/Premium: customers, branches, messages, price in EGP) | G-12 | 1.1 | Numbers approved; WhatsApp authentication rate verified against Meta's official rate card (PD-004) | |

**DoD:** PRD v1.0 approved; prototype approved; no open question blocks Phase 2.

## Phase 2 — Foundation

**Gate (PD-002):** tasks 0.7 and 0.8 must pass before Phase 2 starts or any
application code is written.

| ID | Task | Closes | Depends on | Acceptance criteria | Done |
| --- | --- | --- | --- | --- | --- |
| 2.1 | Rebrand: remove Crave/CraveUp names, ids (`crv_cus_*`), keep LICENSE/NOTICE | — | M1 | Grep finds no upstream brand in shipped code/UI | |
| 2.2 | CI on GitHub Actions + staging environment (Postgres, LIP runtime, secrets manager) | — | 0.4 | Push to main deploys staging on Render (Frankfurt); tests required to merge; Postgres lease conformance + `lip test` pass against the Render staging DB (PD-006 condition) | |
| 2.3 | Platform customer directory above tenants (customers, memberships → member_id) | G-01 | 2.2 | One phone = one customer across cafés; café A cannot read café B's membership (RLS test); personal data (phone, name, birthday, consent) only in the directory's own schema + DB role behind its own service interface; no phone in LIP, logs, analytics or message payloads beyond sending (PD-006) | |
| 2.4 | Customer OTP sign-in run by the BFF (own OTP, WhatsApp Cloud API + Egyptian SMS provider; PD-004) | G-06 | 0.3, 2.3, 0.11 | Sign-in works end-to-end; customer session never reaches LIP; codes stored as HMAC, constant-time compare, one active code per phone; session ids ≥ 256 bits stored hashed, Secure/httpOnly/SameSite cookies, CSRF protection; per-phone/IP/device limits, Turnstile and global circuit breaker enforced; phone change revokes all sessions; WebOTP autofill works on Android; Arabic SMS fits one segment; Egyptian delivery tested with one real number over WhatsApp and SMS (moved from 0.3; PD-004 condition) | |
| 2.5 | Cashier role: protocol write limited to accrue/redeem at own location; minimal customer view | G-05 | 2.2 | Permission tests: cashier cannot export, edit program, post manual adjustments, or act in other branch; staff phone OTP-verified at creation, change needs owner approval | |
| 2.6 | Staff PIN login per branch device + device registration | G-05 | 2.5 | Lost device can be revoked by owner | |
| 2.7 | Move platform state (profiles, events, segments, campaigns) from JSON blob to RLS tables; make the platform layer multi-instance-safe | G-11 | 2.2 | Platform state lives in revisioned rows; no 100k event truncation; every scheduler (campaign, engagement, membership) and the webhook dispatcher run under `withLease()`; a test starts two instances and proves a due campaign runs exactly once; load test with 500 tenants × 10k customers | |
| 2.8 | i18n + RTL infrastructure; localizable program/reward names | G-14 | 0.5 | Arabic (default, RTL) and English render correctly; language stored per account (cookie before sign-in); Western digits, digit normalization on input; EGP format hides zero piasters; bidi isolation for codes/amounts; `Africa/Cairo` everywhere (PD-007) | |
| 2.9 | Audit log coverage for every staff/owner write | — | 2.5 | Every write has actor, branch, device, time | |

**DoD:** M2 — isolation tests for all new tables pass; OTP sign-in on staging; cashier role enforced server-side.

## Phase 3 — Core loyalty in the café

| ID | Task | Closes | Depends on | Acceptance criteria | Done |
| --- | --- | --- | --- | --- | --- |
| 3.1 | Rotating member QR code, device-bound (server-verifiable, single-use, ≤60 s, bound to customer+device+business; PD-003 A1) | G-02 | 2.3 | Replay fails; expired fails; other café's code fails; revoked device fails; a 4th device is refused; code works offline on an installed PWA opened online before | |
| 3.2 | Bill-amount order builder → valid `FoodserviceOrder` with stable `order_id` | G-04 | 0.6 | Double-submit awards once; totals reconcile; EGP piasters; input label per café setting ("Amount paid" default); preview from `orders/evaluate`; large-bill re-type and 5× rejection (PD-008) | |
| 3.3 | Staff scan flow: scan → amount → evaluate → accrue | G-02 G-04 | 3.1, 3.2, 2.6 | Stamp/points visible to customer within 2 s; staff cannot award to own customer account; offline shows clear error and awards nothing | |
| 3.4 | Redemption at counter: reserve → capture, cancel → reverse | — | 3.3 | A reward can never be used twice, including two cashiers at once; customer app cannot reserve or capture; verify reserve/capture works with a synthetic order without item lines (or without an order) — if not, raise a new decision (PD-008) | |
| 3.5 | Branch QR + pending claim queue + cashier confirm | G-03 | 3.3 | Claim never grants value until confirmed; cashier must type the claim code (unique among open claims at the branch); wrong code rejected, 3 wrong codes cancel the claim; expires after 15 min; one open claim per customer/branch | |
| 3.6 | Undo / correction flow (staff requests, owner approves → manual adjustment) | — | 3.3, 2.9 | Classified adjustment with reason; visible in audit; cashier self-void within 10 min (clawback + cancel unredeemed issued reward, idempotent); void blocked if that reward was redeemed; LIP stamp reset/balancing behavior on adjusting a threshold-crossing order checked and recorded (PD-008) | |
| 3.7 | Program wizard: stamps and points programs without JSON | G-08 | 2.8 | Owner creates "5 drinks → 1 free" in < 3 min; publishes via draft/publish; hides product/category/tag exclusions (PD-008); asks for both languages, requires only the café's main language (PD-007) | |
| 3.8 | Anti-fraud rules v1 (scan velocity, out-of-hours, staff→same customers) | — | 3.3 | Owner alert generated in test scenarios | |

**DoD:** M3 — full earn/redeem loop on staging with real phones; abuse test cases pass.

## Phase 4 — Customer web app & owner dashboard (MVP)

| ID | Task | Closes | Depends on | Acceptance criteria | Done |
| --- | --- | --- | --- | --- | --- |
| 4.1 | Customer surface of `apps/web` (`app.`; Next.js, AR/EN): my cards, progress, QR, rewards, history | G-07 | 2.4, 3.1 | Matches approved prototype; works offline-tolerant for showing QR (PD-003 A1); device list with revoke | |
| 4.2 | Join a café by scanning its QR; per-brand marketing consent toggle | G-07 | 4.1 | Consent stored per brand with policy version | |
| 4.3 | Account deletion across all memberships | G-07 | 4.1 | Profile PII erased, ledger kept pseudonymous | |
| 4.4 | Owner surface of `apps/web` (`dashboard.`): Overview, Customers, Programs, Transactions, Rewards, Branches, Staff, Settings | G-08 | 2.5, 3.7 | Each page uses real data; location-scoped views respected | |
| 4.5 | Overview KPIs v1: customers, active 30d, visits, redeemed, near-reward, inactive 30d | G-13 | 2.7 | Numbers match ledger in a reconciliation test | |
| 4.6 | Staff surface of `apps/web` (`staff.`) as installable PWA | G-05 | 3.3 | Installs on Android/iOS home screen | |

**DoD:** M4 — a non-technical person completes owner onboarding and a customer completes join → earn → redeem without help.

## Phase 5 — Pilot readiness & pilot

| ID | Task | Closes | Depends on | Acceptance criteria | Done |
| --- | --- | --- | --- | --- | --- |
| 5.1 | Security review: tenant isolation, authz, QR abuse, OTP abuse, secrets; explicitly the OTP and session code (PD-004) | — | M4 | Findings fixed or accepted in writing | |
| 5.2 | Load test: peak hour in 100 cafés concurrently | — | M4 | p95 accrue < 500 ms; no duplicate awards | |
| 5.3 | Backups + restore drill on production Postgres | — | 2.2 | Restore proven using Render Postgres point-in-time restore (not an upstream local backup command); RPO/RTO recorded (PD-006) | |
| 5.4 | Privacy policy, terms, consent texts (Arabic) | — | 0.10 | Published and linked in apps | |
| 5.5 | Manual billing core (super-admin): record a payment; set/extend plan + period end; subscription state follows end date (grace → read-only → suspended) | G-12 | 1.6, 2.2 | Payment stored in piasters with stable id (double submit records once); payment records append-only; every plan/period change audited; a lapsed café moves grace (1–7) → read-only (8–37) → suspended (38+) automatically; suspended café cannot award but its customers can redeem; recording a payment restores full service at once | |
| 5.6 | Pilot in 1–3 cafés; weekly review of repeat-visit rate | — | 5.1–5.5, 0.10, 0.11, 0.12 | **Mandatory gate (0.12):** All critical and high production vulnerabilities must be resolved or explicitly accepted in writing before the pilot. 4 weeks of data; issues logged to backlog | |

**DoD:** M5 — pilot cafés use it daily for 4 weeks with no data-integrity incident.

## Phase 6 — Paid launch (P1)

| ID | Task | Closes | Depends on | Acceptance criteria | Done |
| --- | --- | --- | --- | --- | --- |
| 6.1 | Renewals list (ending in next 7 days + overdue) and payment history per café (super-admin) | G-12 | 5.5 | List matches period end dates; history shows every recorded payment | |
| 6.2 | Owner dashboard: plan, end date, renewal reminder before expiry | G-12 | 5.5, 4.4 | Reminder visible before expiry; grace/read-only state shown clearly | |
| 6.3 | Free trial, monthly/annual, upgrade/downgrade, plan limits enforced | G-12 | 5.5 | Limits enforced server-side | |
| 6.4 | Automation engine: event triggers + "inactive N days" + birthday + near-reward + expiring | G-09 | 2.7 | Each trigger fires once per customer per rule window | |
| 6.5 | WhatsApp Business connector (+ SMS fallback), templates, opt-out | G-10 | 6.4 | Frequency cap + send window enforced; cost counted against plan | |
| 6.6 | Campaign attribution with holdout + retention KPIs (repeat rate, frequency, cohorts) | G-13 | 6.4 | Lift report per campaign | |
| 6.7 | Super-admin console: businesses, plans, suspensions, usage | — | 6.3 | Operator actions audited | |
| 6.8 | Google Wallet loyalty passes (PD-009): save link after OTP sign-in, one pass per membership, rotating code as a customer device, pass notifications with WhatsApp only for customers without a pass | — | 6.4, 3.1 (+0.11 only if Google requires a business entity) | Four PD-009 checks pass: zero cost (no fee, no billing account/card); publishing approval (platform as single issuer, café logo consent in onboarding terms); real Android device in Egypt (saves, staff scans rotating code, Arabic RTL, notification arrives); save/delete callbacks work. Fallback to no barcode if the rotating-code test fails. Expired-reward comparison scheduled 8 weeks after go-live | |

**DoD:** M6 — first café's offline payment recorded and its period extended in the super-admin console; automated win-back shows measurable lift vs holdout.

## Phase 7 — Expansion (P2)

| ID | Task | Closes | Depends on |
| --- | --- | --- | --- |
| 7.1 | Mobile app (React Native / Expo) + push notifications | G-15 | M6 |
| 7.2 | Geofencing reminders | G-15 | 7.1 |
| 7.3 | Tiers program type in wizard (Silver/Gold/Platinum) | — | M6 |
| 7.4 | Advanced analytics | G-13 | M6 |
| 7.5 | POS integrations (only if pilots demand it) | — | M6 |

## Critical path

`0.1 → 0.3 → 1.1 → 2.3 → 2.4 → 3.1 → 3.3 → 4.1 → 5.6 → 6.1 → 6.2`

The biggest technical risk is **2.3 (platform identity above tenants)**; build
and isolation-test it first in Phase 2.

## Backlog (not scheduled)

- **First after MVP (PD-008):** bill amount + optional short product list picked by the cashier (enables exclusions; per-item stamps would still need a fork patch)
- Offline queue for cashier device when internet drops
- Counter lookup by phone number (with OTP to the customer) when the QR cannot be scanned (PD-003)
- Item-level purchases / product exclusions: full line items (PD-008 chose bill amount only)
- Referral program, gamification
- Franchise funding settlement
- Kashier online billing (PD-005, deferred by A1): `KashierBillingProvider`
  (save token, HMAC-verified webhooks, card data never stored) + renewal
  scheduler (retries, idempotent per subscription/period). Former tasks 6.1/6.2.
  Revisit at 30 paying cafés or when manual collection becomes a bottleneck.
- Apple Wallet passes (PD-009): deferred. Trigger = first paying café **and**
  the owner approves the $99/year Apple Developer Program fee. Until then iPhone
  users use the web-app card (offline per PD-003 A1).
