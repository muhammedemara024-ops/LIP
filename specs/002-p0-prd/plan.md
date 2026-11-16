# Implementation Plan: [Product] — P0 MVP (multi-tenant café loyalty SaaS)

**Branch**: `002-p0-prd` (spec directory only; no git branch created) | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)

**Input**: Approved PRD v1.0, `specs/002-p0-prd/spec.md` (Gate 1 approved 2026-11-12; published in commit `3016954e190df50d9deeba575456f15c789ae4c8`)

**Status**: **P0 Planning Gate approved by the project owner on 2026-11-12; `/speckit-tasks` separately authorized.** Approval reconciled from the owner's explicit confirmation in the continuation request. Gate 2 was approved in scoped form on 2026-11-13 (see the next paragraph); implementation authorization remains outstanding. OD-01–OD-18 remain unresolved; FP-003 remains blocked.

**Gate 2 (scoped) — approved by the project owner on 2026-11-13.** Approved as content only: T001, T002, T010, T035, T048, T058. Approved as gate records: T059–T078. Every other card, including the new T079, is approved as blocked structure only. Owner decisions recorded the same day: PD-005 A3 (stage cells), PD-039 (server money parser in `apps/bff/src/money/`, strict amount input, no grouping, entry gates retained), and PD-042. PD-042 covers three items: PD-005 A4 (no new pending claims while suspended); the JG-01 rolling window; and rule 05 field 13 added to T001, T002, T010, T035, T048 and T058 as a review-only addition that leaves their approved scope unchanged and is not a new approval. This approval authorizes **no** implementation, migration, staging, commit, push or deployment; implementation needs a separate, named owner authorization after the Entry gates below close. OD-01–OD-18 stay unresolved; FP-003 stays not authorized.

**PD-047 revised Gate 2 adoption — approved by the owner on 2026-11-15.** The bounded package at `specs/002-p0-prd/evidence/backend-first-20261115-revision3/gate2-approval-package.md` was approved for content/structure on 2026-11-15 after separate owner approval of PD-047 Revision 3. Its scope is the M1-B/M1-UI/M1-done sequence; exact task dependency/gate changes; revised T001/T002/T010/T035/T048/T058 wording; T083–T085 cards and evidence seams; and the mixed PM milestone entry/completion splits. The package excludes T080–T082 branding, checklist disposition and implementation authorization. This Gate 2 approval authorizes no implementation or operational action. At that approval, BE-5 checklist disposition, BE-7 G01 independent review and each named task authorization remained outstanding.

**BE-5 owner disposition — approved 2026-11-15:** The owner approved the CHK001–CHK082 disposition as presented in the Wanees decision package dated 2026-11-15; see [entry-gate-assessment.md §G](checklists/entry-gate-assessment.md#g-be-5-owner-disposition--approved-2026-11-15). BE-5's checklist-run and explicit-disposition requirement is met. Original evidence, item-level classifications and all 82 unchecked markers are preserved; evidence-qualified Satisfied assessments do not close Partial, unresolved, Deferred or Consistency items or their named gates. No underlying open product decision is resolved, no gate is waived, and no implementation or operational action is authorized. Separate named T001 authorization remains outstanding; BE-8 remains T001's unproduced output. (BE-7's separate G01 independent review, outstanding at this record, closed 2026-11-16 (PD-048 item 6).)

**Unapproved amendment present.** This file contains a "Proposed amendment (PD-046), not approved at Gate 2" block (2026-11-13). It is outside every approval recorded above.

- **Scope.** The existing owner approval covers this technical planning package and its design artifacts; the separate authorization permits `/speckit-tasks`. It authorizes no application code, migrations, fork patches, `/speckit-implement`, staging, commit, push or deployment.
- **Decision boundaries.** The approved planning baseline does not resolve the owner-visible choices listed as OD-01 to OD-18 in [research.md](research.md) §5. Their recommendations remain Proposed and are not assumed.

**Approval reconciliation (2026-11-12 approval; recorded during continuation).** The owner explicitly confirmed: "the project owner has ALREADY explicitly approved the P0 Planning Gate and separately authorized `/speckit-tasks`." The artifact headers had retained their pre-approval text. The checked-in/local artifact record did not contain the original approval message; this reconciliation records the owner's confirmation, not a reconstructed transcript or a new authorization. The earlier governance-audit handoff's missing-planning-approval conclusion is superseded by this record. At that reconciliation, Fable's review of the separate governance changes was recorded as pending; the later review and follow-up are preserved in analysis-report.md. Future reviews follow AGENTS §5/rule 04 under G01. Task drafting closes no review or Gate 2/implementation gate.

**Artifacts**:
- [research.md](research.md): decisions R-01 to R-26 (plus R-16a), the open decisions OD-01 to OD-18, and §6 review residuals and the final verdict.
- [data-model.md](data-model.md).
- [contracts/](contracts/README.md): customer, staff, owner and operator APIs, plus the LIP integration contract.
- [quickstart.md](quickstart.md): validation scenarios and gates.

## Summary

[Product] P0 is built as **our own product layer around an unchanged LIP core**:

- **`apps/bff`.** A long-running Node 22 / TypeScript service on Hono. It owns:
  - every product permission, session, OTP, device and QR credential;
  - the operation journal and per-member serialization;
  - void, claim, redemption and migration workflows;
  - the subscription stage engine, analytics and SLO measurement;
  - the personal-data directory, in its own schema and DB role.
- **`apps/web`.** One Next.js app serving the customer, staff and owner surfaces by subdomain, in Arabic RTL first.
- **LIP runtime.** The existing `apps/cloud` managed data plane, one instance, with **one environment (tenant + program) per café**. Merchant keys live only in the BFF.
- **Database.** PostgreSQL 17 (Render, Frankfurt), with FORCE RLS on `lip.tenant_id` for every tenant table, both LIP's and ours.

**Main technical approach (research.md):**

1. **Durable member admission and write-ahead journal.** Every balance-changing operation is admitted through a durable per-member slot (one unresolved operation per member, accruals included); every LIP write is journaled with a fenced lease before it is sent, and its outcome and domain effect are recorded in one transaction (R-07). LIP provides no server-side fencing, so releasing a member after an unanswered call needs either a small dispatch-deadline fork patch or fail-closed freezing — owner decision **OD-15**. Voids, redemptions, adjustments and migrations recover forward only with the same key and body. **An uncertain accrual is never re-sent**, interactively or in the background (PD-038 P8, FR-069, R-14).
2. **Stamp voids.** PD-008 A1 is implemented exactly, with C1–C8 and checks (a)–(f) tested on Linux + PostgreSQL 17.
3. **Points voids.** The workflow is built **fail-closed and disabled** (`points_void_execution` off) until every FP-003 gate passes (§6). No candidate reversal formula is ever executed.
4. **Stages.** Subscription stages are computed on read from the period end in Cairo calendar days. One policy table mirrors PD-005 A2.
5. **Analytics.** Visits and cohorts are derived views, never stored accounting records. SLO availability is measured by a synthetic prober in an isolated test café.
6. **Measure persistence first.** The engine rewrites a café's whole program state on every write (R-08). A persistence-cost spike runs **before** Phase 3 work builds on it.

## Technical Context

**Language/Version**: TypeScript ^6.0.3 (strict, no `any`, `.js` ESM import suffixes), Node.js 22.22.0, npm 10.9.4 workspaces

**Primary Dependencies**:
- Existing: `pg` 8.22 (driver), `@sinclair/typebox` + `ajv` (validation), `jose` via `packages/identity` (OIDC), `packages/sdk` `LipClient` (LIP calls).
- New, behind the FP-002 audit discipline: `hono` 4.13.17 + `@hono/node-server` 2.1.6 (already pinned transitively), Next.js App Router for `apps/web`, an i18n catalog library (task 2.8), Playwright (dev), a QR generation library.

**Storage**: PostgreSQL 17. The existing LIP engine and Cloud schemas are unchanged. New schemas `bff` (product, FORCE RLS) and `directory` (personal data, own login role). Direct or session-mode connections only.

**Testing**: Vitest (root config) with Postgres suites gated by `LIP_TEST_POSTGRES_URL`. CI already fails on skipped tests. Two-instance concurrency tests, Playwright E2E, a k6 load test (task 5.2) and LIP characterization tests.

**Target Platform**: Linux containers (`node:22-alpine`, digest-pinned) on Render Frankfurt behind Cloudflare. Staging and production each have their own database (PD-006).

**Project Type**: Web service (BFF) + web application (Next.js PWA surfaces) + an existing loyalty runtime.

**Performance Goals**:
- Award p95 < 500 ms at peak across 100 cafés, never awarded twice (SC-005).
- Customer sees the new balance ≤ 2 s after confirm (SC-004).
- Median cashier flow ≤ 10 s (SC-003).

**Constraints**:
- Budget ≤ $100/month for staging plus production (PD-006).
- Arabic RTL default; integer piasters; `Africa/Cairo`.
- No PII in LIP, logs, URLs or idempotency keys.
- LIP runtime at one instance.
- `/lip/v1` and `spec/` unchanged.

**Scale/Scope**: Pilot is 1–3 cafés (≥ 150 customers by week 4). Design target is 100 cafés at peak (task 5.2). 14 user stories, about 100 FRs, 17 SCs.

## Entry gates (before any implementation task starts)

Implementation starts only after **all common backend-entry conditions** and the individual task's own gates:

1. The owner approves this planning gate.
2. `/speckit-tasks` and `/speckit-analyze` run under a later authorization.
3. **Gate 2** (plan and tasks) is approved (AGENTS.md §5).
4. **M1-B/backend-entry before T001:** BE-1 PRD v1.0 Gate 1; BE-2 Phase 2 gate 0.7/0.8; BE-3 accepted conditional journey drafts 1.2/1.3(a)/1.4(a); BE-4 approved scoped Gate 2; BE-5 checklist run plus explicit owner disposition of CHK001–CHK082; BE-6 PD-047 and this revised Gate 2 recorded approved; BE-7 independent PD-047 review findings resolved and separate G01 independent review complete. T001 produces BE-8 dated evidence; it never requires its own output.
5. `/speckit-checklist` is run as part of Tier 3 (Constitution Art. IX); the run is not a substitute for the BE-5 owner disposition.
6. Every task keeps its own named prerequisites, Gate 2 content/field 13 review, and separate implementation authorization. T001 does not authorize T002; T002's backend manifest is separate from T084's UI manifest.

**Later UI entry (M1-UI):** UI implementation requires verified W1–W5 backend exit, T084 complete and reviewed, final Arabic/Latin name, owner-approved D1–D4/T084 implementation direction, A11Y-01 decision, and per-card Gate 2 content/field 13 and AA criteria review. These are UI-entry conditions, not prerequisites to T084 or backend work. T085 measures final implemented UX on real staging only after its UI/live-service/test-data permissions close.

**Full Phase 1 completion (M1-done):** Retain roadmap 1.2 and journey (a), T085 evidence for 1.3(b)/1.4(b), owner acceptance of final 1.5 implemented staging UI, approved 1.6 plan values and final name. M1-done does not gate work needed to produce its evidence. Existing acceptance thresholds and all per-task/legal/cost/deployment/pilot gates remain unchanged.

Task 0.10 (legal) and task 0.11 (company registration) gate only their tagged items and the pilot.

**Deployment entry gate (PD-006 mandatory cost verification).** Before any staging or production service is created (task 2.2), the owner receives and approves a confirmed, service-by-service monthly total from the Render billing pages: the three services per environment at the sizes S-1 shows are needed, required workspace seats, Postgres instance, storage and PITR charges, billing of suspended services, the OIDC provider, the SLO prober (OD-03) and any OTP channel fixed fees, against the $100 cap, with the approved fallback if it is exceeded (PD-006). The original estimate (~$98) leaves little headroom, so this is a gate, not a formality.

## Constitution Check

*GATE: checked before Phase 0 research and re-checked after Phase 1 design. Result: **PASS**, no violations.*

| Article | Requirement | How the plan complies |
| --- | --- | --- |
| I — Context supremacy | Follow the authority order; preserve context files | Product rules are cited, never restated differently. No `docs/context/*` file changes in this plan; owner-visible gaps go to OD-01–OD-18. |
| II — Upstream preservation and fork patches | `/lip/v1` and `spec/` unchanged; log every upstream change | Product code lives in `apps/bff` and `apps/web` (extensions, not fork patches). No upstream code changes are planned except gated tracks, each needing its own owner authorization and `07-fork-patches.md` entry: FP-003 (gated, §6), the roadmap 2.7 scheduler leases (OD-04), candidate FP-004 persistence (OD-09). |
| III — Decision states | Only Approved decisions bind; Proposed never becomes a requirement | Every plan-introduced value is labelled Proposed or OD. The FP-003 candidate formula is never treated as a requirement. |
| IV — Tenant isolation and security | RLS on every tenant table; no client-trusted tenant; keys never in browsers; no PII across `/lip/v1` | FORCE RLS on every `bff`/`directory` tenant table, plus a startup probe (data-model §1). Scope comes from the session or device only. Merchant keys are BFF-only and encrypted. LIP sees only member ids. |
| V — Money, phone, locale | Integer piasters; no universal `Math.floor`; E.164 regex; Arabic default; `Africa/Cairo` | Integer `bigint` everywhere; earn amounts only from LIP; the regex is a DB CHECK; digit normalization; Cairo-date views with DST tests. |
| VI — PostgreSQL and migration safety | FP-001 lock pattern; concurrency-safe migrations; no transaction pooler | New migrators use the FP-001 pattern with their own keys (R-23). `assertSessionLeaseCompatibleUrl` is reused. Existing FP-001 code is untouched. |
| VII — Verification transparency | Honest counts and environments; Linux + PG17 for storage, auth and isolation | quickstart.md defines spikes, suites and reporting. Zero-skip CI is retained. |
| VIII — PDPL, OTP, sessions, webhooks | HMAC OTP with constant-time compare; hashed ≥ 256-bit sessions; cookie flags; CSRF; webhook HMAC | R-09, R-10. No inbound webhooks in P0 (Kashier deferred). PDPL items are engineering requirements pending task 0.10; no compliance claim. |
| IX — Tiers and gates | Tier 3 Spec Kit flow with Gate 1 and Gate 2 | Planning Gate and task generation approved (2026-11-12); revised Gate 2 content/structure approved (2026-11-15). BE-5 run/disposition met by separate owner approval (2026-11-15; assessment §G), preserving item-level statuses and gates. G01 independent review closed 2026-11-16 (PD-048 item 6), so BE-7 is met. Separate named T001 authorization remains outstanding; prior scoped T010/T035/T048 authorizations are unchanged and blocked. |
| X — Git safety | No commit or push without authorization | Planning wrote only files under `specs/002-p0-prd/` and staged or committed nothing. The staged `.gitattributes` and the untracked tooling directories predate this planning run (session-start git status) and were preserved untouched. |

**Post-design re-check (after data-model and contracts): PASS.**
- Every tenant table in data-model.md is FORCE RLS.
- No contract carries a tenant or branch from the client for scoping.
- No contract posts a points reversal while `points_void_execution` is off.

## Project Structure

### Documentation (this feature)

```text
specs/002-p0-prd/
├── spec.md              # Approved PRD v1.0 (Gate 1)
├── plan.md              # This file
├── research.md          # Phase 0: decisions R-01..R-26 (+R-16a), open decisions OD-01..OD-18, review residuals
├── data-model.md        # Phase 1: schemas, roles, RLS, state machines, transactions
├── quickstart.md        # Phase 1: spikes, verification, E2E scenarios, pilot gates
├── contracts/           # Phase 1: README (conventions, errors), customer/staff/owner/operator APIs, LIP integration
├── checklists/requirements.md
└── tasks.md             # Authorized task-generation output; requires Gate 2 before implementation
```

### Source Code (repository root) — planned additions

```text
apps/bff/                      # NEW product BFF (SaaS extension, not a fork patch)
├── migrations/
│   ├── bff/NNN_*.sql          # schema bff (FORCE RLS), FP-001-style migrator
│   └── directory/NNN_*.sql    # schema directory (personal data, own role)
├── src/
│   ├── server.ts              # Hono app: middleware (request id, CSRF, session, stage, idempotency)
│   ├── config.ts              # env + secret loading; refuses transaction-pooler URLs
│   ├── db/                    # pools, tenant/customer/auth/operator scoped transactions, isolation probe
│   ├── money/                 # authoritative server-side amount parser/formatter, digit normalization (PD-039; T010 vectors)
│   ├── directory/             # DirectoryService: phones, customers, consents, OTP, sessions, devices (own pool)
│   ├── auth/                  # owner/staff/operator sessions, step-up grants, invites, PIN, device enrollment
│   ├── lip/                   # LipClient per café, call journal, recovery, characterization helpers
│   ├── locks/                 # per-member advisory lock + durable member blocks
│   ├── capture/               # member-code verification, capture sessions, order builder, claims
│   ├── rewards/               # catalogue mirror, texts, holds, captures, 120 s reversal
│   ├── voids/                 # stamp void (PD-008 A1); points void shell (disabled, R-18)
│   ├── adjustments/, migrations-paper/, branches/, staff/, program/
│   ├── billing/               # plans, subscriptions, payments, stage policy (PD-005 A2, A3)
│   ├── analytics/             # visit views, KPIs, cohorts, plan-usage counts
│   ├── fraud/                 # PD-027 rule sweeper
│   ├── slo/                   # probe import, minute ledger, SC-012 calculator, outages
│   ├── sweepers/              # SKIP LOCKED job runners
│   ├── observability/         # JSON logs with redaction, /metrics, /health, /ready
│   └── operator-cli.ts        # OIDC device-flow operator tooling
└── test/                      # two-instance harness, fixtures (no real PII)

apps/web/                      # NEW Next.js app (PD-006): (customer) app., (staff) staff., (owner) dashboard.
├── src/app/(customer)/ (staff)/ (owner)/
├── src/lib/{api,i18n,money,digits,qr}/   # i18n catalog AR/EN, piaster formatting, digit normalization, WebCrypto QR
├── public/ + service worker (customer and staff PWAs)
└── e2e/                       # Playwright scenarios E1–E19

tests/characterization/        # NEW: executed facts about the pinned LIP engine (lip-integration.md)
render.yaml, compose.yaml      # extended with bff + web services (task 2.2)
packages/*, apps/cloud         # UNCHANGED, except separately authorized fork-patch tracks
```

**Structure Decision**: Two new apps, `apps/bff` and `apps/web`, named by PD-006. The upstream packages are consumed, not modified. Directory code sits inside `apps/bff` behind an interface with its own database role, so it can later move to an Egyptian host (PD-006 consequence 10).

**File-level task refinement (2026-11-13; Gate 2 scoped approval 2026-11-13).** The mechanical pure seams already specified in this plan are decomposed into these *new* files beneath the existing planned module boundaries: `apps/web/src/lib/digits/normalize.ts` and `normalize.test.ts`; `apps/web/src/lib/money/piasters.ts` and `piasters.test.ts`; `apps/bff/src/voids/stamp-plan.ts` and `stamp-plan.test.ts`; `apps/bff/src/slo/availability.ts` and `availability.test.ts`; and, per PD-039, `apps/bff/src/money/normalize.ts`, `normalize.test.ts`, `piasters.ts` and `piasters.test.ts` (T079, the authoritative BFF copy). Their exact scope, inputs, outputs, vectors and commands are in [execution-briefs.md](execution-briefs.md). This is file-level task detail only, with no new dependency or architecture, no source file creation, and no application authorization. Live Cairo/PG probes, real-data access, journal execution and full browser surfaces remain separate reasoning work. Other internal source/test filenames and new dependency versions remain unpinned and blocked; do not infer them from these pure-file names.

**Project Structure — proposed amendment (PD-046).** **Proposed amendment (PD-046), not approved at Gate 2.** Drafted 2026-11-13 in the autonomous session under owner delegation. It authorizes nothing, closes no gate (`branding-contracts` stays open) and follows MB-01–MB-05, PD-005 A5, U-1–U-6 and corrections A–C (owner-approved 2026-11-14; decisions only, this draft itself stays UNAPPROVED; design in [gate2-branding-revision.md](gate2-branding-revision.md)). No Sol review has run.

```text
apps/bff/src/branding/         # NEW (T081): palette read, update, reset; customer palette resolution; audit
apps/bff/migrations/bff/NNN_brand_palettes.sql   # NEW (T081): additive table, FORCE RLS (data-model §4, Merchant branding);
                                                 #   also bff.owner_mutation_limits + bff.consume_owner_attempt (U-2; design proposed, package §3.1; D-6 may split it to its own card)
apps/web/src/lib/theme/        # NEW (T080 derive.ts; T082 apply.ts): pure derivation and CSSOM application
```

These follow the existing module boundaries. No upstream package, `/lip/v1` route or existing table changes. The success cap reuses `bff.audit_log`. The owner-approved attempt limit (U-2, 2026-11-14) adds one small platform table and one `SECURITY DEFINER` function; their design is proposed in [gate2-branding-revision.md](gate2-branding-revision.md) §3.1 and is not approved.

## Architecture

```text
 Browser (app. / staff. / dashboard.)  ── HTTPS ──►  Cloudflare
        │ same-origin /api/* (host-only __Host- cookies, CSRF token)
        ▼
 apps/web (Next.js, 1 service) ── rewrite /api/* over private network ──►  apps/bff (Hono, 1+ instances)
                                                                              │   ├─ DirectoryService ──► schema directory (role lip_directory_app)
                                                                              │   ├─ product modules ───► schema bff (FORCE RLS, roles *_runtime)
                                                                              │   └─ LipClient (merchant key per café, journaled writes)
                                                                              ▼
                                                LIP runtime: apps/cloud managed data plane (1 instance)
                                                /runtime/v1/environments/{café env}/lip/v1/*
                                                              ▼
                                         PostgreSQL 17 (Render): LIP engine tables (FORCE RLS), Cloud tables,
                                                                  schema bff, schema directory
 SLO prober (OD-03: Cloudflare Worker cron) ── public path ──► test café only
```

**Service boundaries.**
- The BFF is the only caller of LIP.
- The directory is the only holder of PII.
- The web app holds no secrets and evaluates no business rules.
- LIP keeps loyalty truth: balances, ledger, lots, rewards, reservations, idempotency.
- The BFF keeps product truth: who, where, which device, display text, stage, workflow state, analytics.

**Tenant isolation, in layers.**
1. Per-café LIP environment with its own merchant key and FORCE-RLS engine rows.
2. FORCE RLS on every `bff` and `directory` tenant table, under NOBYPASSRLS runtime roles, with the scope GUC set only from the authenticated credential.
3. A startup isolation probe.
4. Live isolation suites (SC-007).

**Branch-level authorization.**
- Staff sessions are bound to a device, and the device to a branch. The owner staff profile may act at any active branch of its café.
- Every staff route derives `branch_id` from the device.
- Cross-branch claim, capture and redemption actions are refused, and `/lip/v1` location scope is not relied on (PD-014).
- Branch deactivation revokes devices, sessions and QR atomically (FR-081).

**Transaction boundaries.** See data-model.md §6. No database transaction is held across a LIP call. Each LIP write is preceded by a committed intent and followed by a recorded outcome.

## Workflows (where each is specified)

| Area | Design | Contract |
| --- | --- | --- |
| Identity, owner/staff roles, PIN, customer accounts, OTP, QR | R-06, R-09–R-13 | customer-api, staff-api, owner-api, operator-api |
| Stamp and points loyalty, idempotency, concurrency, recovery | R-07, R-14–R-18, R-16a | staff-api, lip-integration |
| Billing, subscription lifecycle, monitoring-only plan limits | R-19, R-20 | operator-api, owner-api `/settings` |
| Domain model, migrations, constraints, indexes, transactions | R-23, data-model.md | — |
| API validation, authorization, errors, audit | contracts/README.md | all |
| Notifications, background jobs, scheduling, retries, recovery | R-09 (OTP only; P0 sends nothing else, PD-016), R-15 | — |
| Reporting, visit attribution, cohorts, SLO | R-22 | owner-api reports, operator-api `/slo` |
| Observability, backup/restore, deployment, security, readiness | R-25, quickstart §5 | — |
| Testing | R-24, quickstart | — |

## FP-003 restriction (binding on this plan)

FP-003 is **not implementation-ready and not authorized**. The point-lot attribution algorithm is **unresolved**. The candidate formula `−max(0, E + A − X)` is **not proven safe**: source-derived counterexamples show over-debit when another void or a redemption consumes the purchase's lot before expiry. The plan therefore:

1. **No upstream change.** It writes no FP-003 code and plans no change to `adjustOrder`.
2. **Disabled execution.** It builds the BFF points-void workflow only as a fail-closed shell: authorization, member admission slot and block, journal, evidence model, reconciliation and escalation. The step that would post a reversal is disabled by `points_void_execution = off` in every environment. While off, a points void returns `points_void_unavailable` and posts nothing (R-18).
3. **Gates kept open.** It keeps every gate mandatory and open, **in this order**:
   - (a) owner-approved point-lot attribution algorithm;
   - (b) source-level validation of that algorithm;
   - (c) V1 executable regression tests, including the **void** and the **redemption** over-debit cases;
   - (d) V2–V4 and V7 verified;
   - (e) separate FP-003 implementation authorization.

   Then, before **any points café joins the pilot**: V5 and V6 verified, and **SC-017** passing in the official verification environment.
4. **Missing accruals stay uncertain.** It treats every missing or unconfirmed accrual result as **uncertain** until V4 proves a complete, authoritative ledger read is possible (FR-069). It never assumes zero and never re-sends an accrual.
5. **Production guard.** It asks the owner (OD-02) whether to refuse publishing a points program for a non-test production café while these gates are open.

Independent work never waits on FP-003. Points accrual, redemption, expiry display and the whole stamp product proceed (milestones below).

## Milestones and sequencing

Plan milestones are named **PM-x** to avoid confusion with the roadmap's own milestones M0–M5. A milestone *completes* a roadmap task only when that task's roadmap dependencies are complete; early backend implementation/verification is not completion. Each full milestone exit retains its original acceptance evidence. The PD-047 approved entry/completion split below controls sequencing; it does not waive any roadmap completion dependency.

| Milestone | Content (roadmap tasks) | Depends on | Exit evidence |
| --- | --- | --- | --- |
| **PM-S Spikes** | S-1 full-workload engine persistence (R-08), S-2 LIP characterization (lip-integration.md), S-3 lease, member admission and journal behaviour on Render staging (PD-006 condition 1), S-4 tzdata | entry gates; S-1 needs only a local Linux PG17; S-3 needs the staging DB from PM-1 | quickstart §2; OD-09 raised if S-1 fails |
| **PM-1 Foundation** | 2.2 CI + staging for bff/web (after the deployment entry gate); BFF skeleton (middleware, errors, idempotency, audit-log *framework*), migrators, roles, policy matrix and RLS probe, observability; 2.1 rebrand (after roadmap M1); 2.8 i18n/RTL/money/digits (0.5) | entry gates | isolation suites green, zero skips |
| **PM-2 Identity and staff** | 2.3 directory; 2.4 OTP (fake channel; *done* only after 0.3, 0.11 and live delivery); sessions and CSRF; owner invite and step-up; Super Admin OIDC + allowlist; 2.5 cashier role; 2.6 devices, PIN lifecycle, owner staff profile; **2.9** audit coverage of every staff/owner write (after 2.5) | PM-1 | E1 (sign-in parts), E2, E5 (identity parts), SC-007 suites |
| **PM-2u Upstream 2.7 track** | Roadmap 2.7 in the scope chosen by OD-04, as a separately authorized fork-patch track | PM-1 (2.2), OD-04, its own authorization | its own fork-patch tests; required before 4.5 is *done* |
| **PM-3 Counter loop (stamps first)** | 3.1 member QR; 3.2 order builder (0.6); 3.3 scan → award; 3.4 redemption; 3.5 Branch QR claims (OD-12); 3.7 wizard (2.8) | PM-2; PM-S (S-1 pass or OD-09 decided; S-2) | E3, E4, E6, E9 |
| **PM-4 Stamp voids and corrections** | 3.6 stamp void (PD-008 A1, C1–C8, checks (a)–(f)), owner adjustments, re-capture linkage, needs-owner and escalation | PM-3 (3.3, 3.4); PM-2 (2.9) | E7, E18; SC-006 stamp cases |
| **PM-5 Points (no voids)** | Points wizard, accrual, redemption, expiry display, points void shell disabled (R-18), FR-069 evidence reader as V4 harness | PM-3 | E3/E6 on points; E8 |
| **PM-6 Surfaces** | 4.1 customer app (2.4, 3.1); 4.2 join + consent; 4.3 deletion; 4.4 owner dashboard (2.5, 3.7); 4.6 staff PWA (3.3); 4.7 paper migration (3.6, 4.1, 4.6) | PM-3; PM-4 for 4.7 | E1, E1b, E2, E11, E15; SC-001/002/009 |
| **PM-7 Billing and limits** | 5.5 payments, plan and period, stage policy, plan-usage monitoring, Overview/Settings plan panel | 1.6, 2.2, **4.4** (PM-6); schema and stage policy may be scaffolded from PM-1 | E10, E17; SC-008 |
| **PM-8 Insight and integrity** | 3.8 fraud alerts (3.3, OD-14); 4.5 KPIs, visits, cohorts; FR-155 prober (OD-03) and SC-012 reports | PM-3; **4.5 done only after PM-2u (2.7)**; PM-6 for display | E12, E13, E14 |
| **PM-9 Readiness** | BFF two-instance proof (SC-016); 5.1 security review and 5.2 load (both after roadmap M4, i.e. PM-6 done); 5.3 restore drill (2.2); 5.4 legal texts (0.10); SC-015 scans | PM-6, PM-7, PM-8 | E16; SC-005, SC-013–SC-016 |
| **FP-003 track (gated)** | Only after gates (a)–(e): FP-003 implementation, V1–V7, SC-017; then enable `points_void_execution` | owner decisions, not schedule | SC-017; required before any points café pilots |
| **PM-10 Pilot (5.6)** | 1–3 stamp cafés (points cafés only after the FP-003 track and V5/V6) | 5.1–5.5, 0.10, 0.11, 0.12 | PD-028 gates, weekly SLO and KPI reviews |

**PD-047 adopted backend-entry versus full-completion split (owner-approved 2026-11-15):** The original table above continues to describe full milestone completion and exit evidence. Backend task entry follows the named task graph and card gates; it does not wait on a mixed milestone's later UI/staging outcome. No PM milestone is reported complete until all original completion evidence exists.

| Milestone | Backend implementation/verification entry | UI or full-completion condition retained |
|---|---|---|
| PM-S | Named spike prerequisites; M1-B/T001 and each spike's own task gates | S-3 requires explicit staging permissions; no UI condition is added |
| PM-1 | Foundation, persistence/RLS and framework tasks after M1-B/T001 and named prerequisites | T058 and T011 require M1-UI; PM-2 backend does not wait for those late portions |
| PM-2 | Directory, fake-OTP, session, staff and device backend tasks by named prerequisites | Live delivery remains T057; PM-3 backend need not await full live/UI evidence |
| PM-3–PM-5 | Counter, void, points and API work by named prerequisites/gates | Original staging/UI/timing evidence remains for full roadmap/milestone completion |
| PM-6 | T040/T041/T043 backend work at `PM-6-backend-entry` | UI work requires `PM-6-UI-entry`/`ui-entry`; full PM-6 retains original surfaces and T085 evidence |
| PM-7 | T046 backend after its plan-values/accounting/security prerequisites | T045 plan-panel display remains required for full billing-row completion; it does not gate T046 backend |
| PM-8 | T044/T047 backend projections/alerts by named prerequisites | T045 display and T049 prober remain later completion work; 4.5 done still requires PM-2u as originally specified |
| PM-9 | T054 two-instance/lease backend proof at `PM-9-backend-entry` | T055 security/load remains after M4 and full PM-6/7/8 completion, T057 and its legal/restore permissions |

T085 precedes M4 acceptance and is not gated by M4, T055, PM-9-final-entry or pilot authorization. T056 remains gated by T085, M1-done, M-01-M5 and all existing pilot gates.

The implementation-entry and full-completion graph is validated in `specs/002-p0-prd/evidence/backend-first-20261115-revision3/graph_v3.py`; its entry/completion split preserves PM-1 → PM-2 → PM-3 → {PM-4, PM-5} → PM-6 → PM-7 → PM-9 → PM-10; PM-S feeds PM-3; PM-1 → PM-2u → PM-8 → PM-9 without making late UI/staging evidence a prerequisite of the backend that produces it.

**Parallel work.**
- PM-S (S-1, S-2, S-4) and PM-1 start together.
- PM-2u runs alongside PM-2 and PM-3 once authorized.
- PM-4 and PM-5 run in parallel after PM-3.
- PM-8's analytics views can be built against PM-3 data while PM-6 proceeds; 4.5 is marked done only after 2.7.

## Test strategy (summary)

- **Unit.** Pure policies, each with exhaustive tables:
  - stage policy (all PD-005 A2 cells);
  - money and digit parsing;
  - QR MAC and counter windows;
  - OTP HMAC and limits;
  - the stamp k-plan (the PD-008 A1 examples and C-cases);
  - the visit, attribution and cohort calculators;
  - the SC-012 calculator, including DST days;
  - fraud rule windows.
- **Integration (Linux + PG17).**
  - Every route against a real managed data plane and database.
  - RLS isolation for every new table and role.
  - Characterization of the pinned LIP behaviours.
- **Concurrency.** Two BFF instances covering:
  - simultaneous captures and redemptions;
  - void vs purchase vs adjustment on one member;
  - sweepers running exactly once;
  - crash injection between journal intent, LIP commit and outcome record.
- **Security.**
  - CSRF and Origin.
  - Session fixation and revocation.
  - OTP brute force and limits.
  - QR replay and cross-café use.
  - Self-dealing.
  - Cross-tenant and cross-branch denial (SC-007).
  - Redaction tests: no PII in logs or URLs.
  - Dependency and image scans.
- **End-to-end.** Playwright E1–E19 in Arabic RTL and English.
- **Load.** 100-café peak (SC-005).
- **Reporting.** Exact environment and pass, fail and skip counts; zero mandatory skips (Art. VII).

## Risks

| ID | Risk | Kind | Mitigation |
| --- | --- | --- | --- |
| K-1 | Engine rewrites full café state per write; latency grows with café size; the SLO test café grows fastest | Architecture / performance | S-1 before Phase 3; OD-09 (incremental persistence fork patch as its own decision) |
| K-2 | Points void over-debit (FP-003 candidate unsafe) | Accounting | Execution disabled (R-18); gates (a)–(e); V5/V6 and SC-017 before any points pilot; OD-02 production guard |
| K-3 | Uncertain accrual becomes a silent retroactive award or a silent loss | Accounting | An uncertain accrual is never re-sent, interactively or in the background; `unconfirmed` state surfaced to owner and operator; cashier/owner handling is OD-10 (R-14) |
| K-4 | Cross-tenant or cross-branch leak through new tables, roles or customer cross-café reads | Security | FORCE RLS on all tables; separate customer role (SELECT only); startup probe; live suites |
| K-5 | Lock loss, abandoned intents, or a delayed (zombie) request committing after a refused re-send | Concurrency / accounting | Durable admission slot for every balance-changing operation; leased, generation-guarded journal; `abandoned` only when provably unsent; refused re-sends do not end uncertainty; fencing via OD-15 (A: dispatch-deadline fork patch; B: fail closed) (R-07); E18 |
| K-5b | Under OD-15 option B, a member is frozen after a rare unanswered call — notably an uncertain accrual before V4, or a crash after `dispatched` and before the send — while redemption-step freezes are bounded by reservation expiry once S-2 verifies the conditional `expired` outcome (R-07 step 4) | Operations / product | B is a temporary fail-closed baseline, **not** accepted production behaviour. Recovery and escalation path in R-07 step 6: forward-only sweeper, immediate *needs attention* and operator-report visibility, operator escalation (timing and release procedure need owner approval under OD-15). OD-15 must be decided before PM-3 exit; option A (or OD-17 for the capture window) reduces it |
| K-6 | OTP abuse or cost spike | Security / cost | Turnstile, limits, circuit breaker (OD-05 values) |
| K-7 | Device secret theft (QR forgery) | Security | Non-extractable WebCrypto key; ≤ 60 s single-use codes; 3-device cap; revocation; rotation when online |
| K-8 | Egypt DST and tzdata drift break visits, stages and SLO windows | Correctness | S-4; DST boundary tests; zone name only |
| K-9 | PII leakage into logs, LIP or analytics | Privacy | Directory module and role separation; redaction tests; member attributes verified PII-free |
| K-10 | Budget overrun (extra services, prober) | Cost | OD-03 Cloudflare Worker prober; no new paid service without owner approval (PD-006 condition 3) |
| K-11 | LIP behaviours assumed but unverified (hold cost, zero-value orders, inactive location, reservation status, Cloud stage mapping) | Integration | S-2 characterization; a surprise raises a decision, never a workaround |
| K-12 | Legal opinion (0.10) changes data shown or residency | Compliance | Directory isolation hedge; PD-013 features behind clear seams |
| K-13 | Next.js and new dependency trees add vulnerabilities | Supply chain | FP-002 audit discipline per new dependency; SC-015 scans |
| K-14 | Facts needed to void a stamp purchase lost in a crash | Accounting | Pre-accrual snapshot read after slot admission and committed with the accrual intent (R-14) |
| K-15 | A completed redemption reversed by the hold timer after a lost capture response | Accounting | Capture and release serialized in one workflow; timer never releases after a capture intent; uncertain capture resolved forward (R-16) |
| K-16 | Operations racing branch deactivation, or customer erasure racing a join or void | Security / privacy | Branch row lock at the intent commit, with system cleanup exempt (R-16a); directory join fence and `bff.members` row-lock erasure fence (data-model §2) |
| K-17 | Operator privileges granted to any MFA-authenticated account at the IdP | Security | Explicit `bff.operators` allowlist with revocation and negative tests (R-13) |
| K-18 | Privileged lookups, sweepers or views bypass RLS | Security | Resolver and `due_work` `SECURITY DEFINER` functions only; `security_invoker` views; per-table policy matrix tested (data-model §1) |

## Traceability (PRD → plan)

| PRD requirement | Plan coverage |
| --- | --- |
| FR-001–FR-009 (tenancy, privacy) | R-06, data-model §1–§2, customer-api, E2, E15 |
| FR-010–FR-019 (sign-in, sessions) | R-09, R-10, R-12, R-13, customer/owner/staff APIs, E1, E2 |
| FR-020–FR-032 (capture, QR, claims) | R-11, R-14, staff-api, customer-api, E3–E5, E9 |
| FR-040–FR-049 (programs, rewards) | owner-api program, lip-integration publish, data-model program tables, E1 |
| FR-050–FR-056 (redemption) | R-16, staff-api, E6 |
| FR-060–FR-067 (voids, adjustments) | R-07, R-17, data-model §5–§6, E7 |
| FR-068–FR-069 (points void) | R-18, FP-003 restriction section, E8 |
| FR-070–FR-074 (paper migration) | staff/customer APIs, data-model `paper_migrations`, E11 |
| FR-080–FR-086 (branches, staff, devices) | R-12, owner-api, data-model, E9 |
| FR-090–FR-095 (billing, limits) | R-19, R-20, operator-api, E10, E17 |
| FR-100–FR-103 (dashboard) | owner-api reports, R-22 |
| FR-110–FR-113 (fraud) | R-21, E12 |
| FR-120–FR-122 (customer app) | customer-api, R-11, R-04 |
| FR-130–FR-133 (localization, money) | R-04, contracts conventions, data-model §1, `program_texts` / `branch_names` / `reward_text_versions` (FR-131) |
| FR-140–FR-142 (messaging, support) | R-09 (OTP only), operator-api owner recovery; customer recovery contract waits on task 1.2 (FR-142) |
| FR-150–FR-152 (audit) | contracts README *Audit*, data-model `audit_log`, `operator_access_log` |
| FR-155–FR-156 (SLO) | R-22, operator-api `/slo`, E14 |
| FR-159–FR-163 (visits, cohorts) | R-22, owner-api reports, E13 |
| FR-170–FR-174 (refunds, corrections) | staff-api re-capture, owner-api adjustments, R-17 |
| SC-001 | E1 timed end-to-end run (< 15 min) |
| SC-002 | E1b separately timed wizard run (< 3 min) |
| SC-003 | Median of `capture_sessions` scan → confirmed durations over real pilot transactions, reported weekly (PM-10) |
| SC-004 | E3 customer-visible latency measurement |
| SC-005 | S-1, task 5.2, K-1 |
| SC-006 | E7, E8; FP-003 restriction |
| SC-007 | isolation suites, K-4 |
| SC-008 | R-19 stage policy, E10 |
| SC-009 | PM-6 unaided usability runs |
| SC-010 | Pilot reporting through the FR-160/FR-161 reports (PM-8, PM-10) |
| SC-011 | Week-2 and week-4 owner interviews recorded in the pilot log (operational, PM-10; not software) |
| SC-012 | R-22, E14 |
| SC-013–SC-016 | PM-9, quickstart §5, E16 |
| SC-017 | FP-003 track; required before any points café pilots |

## Open decisions and verification items (summary)

- **Owner decisions.** OD-01 to OD-18 (research.md §5). OD-15 (fencing) blocks PM-3 exit. None is assumed; the recommendations there are proposals, not approved defaults. Each blocks only the tasks listed there and is a deferred task-level decision, not a planning-gate blocker.
- **[VERIFY] items** carried from the spec and resolved by executed tests in this plan's milestones:
  - FP-003 V1–V7 (gated);
  - PD-008 A1 checks (a)–(f) (PM-4);
  - hold cost at hold time and zero-value redemption orders (S-2/PM-3);
  - inactive-location refusal (S-2);
  - the Cloud stage mapping (S-2/PM-7);
  - that a usage-event failure never blocks join, award or redeem (the plan posts no usage events, R-19);
  - the SDK path prefix through the managed data plane (R-02);
  - an OIDC provider with device flow and an MFA claim (2.2).

## Complexity Tracking

No constitution violations to justify. Two new apps (`apps/bff`, `apps/web`) are the ones PD-006 names.
