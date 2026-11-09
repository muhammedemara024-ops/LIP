# AGENTS.md — Canonical Agent Operating Manual

## 1. Project Identity & Purpose

This repository is a fork of the open-source **Loyalty Interchange Protocol (`LIP`)** (`@loyalty-interchange/*`, licensed under **Apache License, Version 2.0** per [`LICENSE`](LICENSE) and package manifests; pinned to upstream `8ad93c81a414f5f7521061ddd88009083f4857aa`, package version `0.2.0` per `PD-002`).

We are building a **multi-tenant SaaS loyalty and customer retention platform for cafés and restaurants in Egypt** (Arabic RTL first + English LTR second, `EGP` integer piasters, WhatsApp-first OTP & notifications, QR counter capture) using LIP as the loyalty core (`PD-001` through `PD-009`).

- **Primary Coding Agent**: Google Antigravity (`agy`) with curated **Matt Pocock Skills** (default day-to-day workflow) and **GitHub Spec Kit** (`specify`, optional workflow for large, complex features).
- **Binding Engineering Charter**: [`.specify/memory/constitution.md`](.specify/memory/constitution.md).
- **Antigravity Workspace Rules**: [`.agents/rules/`](.agents/rules/).
- **Skill Configuration Docs**: [`docs/agents/domain.md`](docs/agents/domain.md) and [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md).
- **Claude Code Compatibility Bridge**: [`CLAUDE.md`](CLAUDE.md).

---

## 2. Authoritative Context & Order of Authority

Before proposing plans, writing specifications, or modifying code, read [`docs/context/README.md`](docs/context/README.md) and the context pack in this order:

1. [`docs/context/00-product-brief.md`](docs/context/00-product-brief.md) — Product vision, target market, user roles, and P0/P1/P2 module scope.
2. [`docs/context/01-decisions.md`](docs/context/01-decisions.md) — Decision log (`PD-001` through `PD-009`+).
3. [`docs/context/02-lip-architecture-map.md`](docs/context/02-lip-architecture-map.md) — Mapping between product modules and LIP packages, tables, and endpoints.
4. [`docs/context/03-gap-analysis.md`](docs/context/03-gap-analysis.md) — Tracked gaps (`G-01` through `G-14`) between upstream LIP and our turnkey product.
5. [`docs/context/04-business-rules.md`](docs/context/04-business-rules.md) — Binding `MUST` invariants for tenancy, privacy, money/points/stamps, QR flows, staff controls, locale, OTP, messaging, and subscriptions.
6. [`docs/context/05-glossary.md`](docs/context/05-glossary.md) — Canonical Arabic/English domain and protocol terminology.
7. [`docs/context/06-roadmap.md`](docs/context/06-roadmap.md) — Phased execution roadmap, dependencies, and acceptance criteria.
8. [`docs/context/07-fork-patches.md`](docs/context/07-fork-patches.md) — Log of every modification to upstream LIP code (`FP-001`+).

**Order of Authority When Files Disagree (`docs/context/README.md`)**:
1. [`docs/context/01-decisions.md`](docs/context/01-decisions.md) (Approved decisions)
2. [`spec/`](spec/) (LIP normative `/lip/v1` protocol specification)
3. [`docs/context/04-business-rules.md`](docs/context/04-business-rules.md)
4. All other documentation

**Repository Governance Precedence Over Generic Skill Instructions**:
Repository instructions in [`AGENTS.md`](AGENTS.md), [`.specify/memory/constitution.md`](.specify/memory/constitution.md), [`.agents/rules/`](.agents/rules/), [`docs/agents/`](docs/agents/), and [`docs/context/`](docs/context/) **always override generic skill instructions**. In particular:
- Never create a duplicate root `GLOSSARY.md` or `docs/adr/` directory; use [`docs/context/05-glossary.md`](docs/context/05-glossary.md) and [`docs/context/01-decisions.md`](docs/context/01-decisions.md) per [`docs/agents/domain.md`](docs/agents/domain.md).
- Never commit, push, or deploy automatically (even if a skill mentions committing).
- Always pause at mandatory Tier 2 and Tier 3 user approval gates before modifying production code.

> **Historical Artifacts**: [`docs/context/handoff-phase0.md`](docs/context/handoff-phase0.md) and [`docs/context/claude-project-instructions.md`](docs/context/claude-project-instructions.md) are preserved historical documents. Do not delete or rewrite them.

---

## 3. Skill & Customization Directory Boundaries

| Directory | Purpose | Modification Policy |
|---|---|---|
| [`.agents/skills/<name>`](.agents/skills/) (18 Matt Pocock skills) | **Default Day-to-Day Engineering Workflow Skills**: `ask-matt`, `grilling`, `grill-with-docs`, `domain-modeling`, `diagnosing-bugs`, `tdd`, `codebase-design`, `code-review`, `improve-codebase-architecture`, `implement`, `to-spec`, `to-tickets`, `research`, `prototype`, `pr`, `retro`, `wait-what`, `handoff`. | Adapted to LIP governance (`docs/agents/domain.md`, `docs/agents/issue-tracker.md`, approval gates, and no auto-commit). Do not install `grill-me` (native Antigravity command) or `setup-matt-pocock-skills`. |
| [`.agents/skills/speckit-*`](.agents/skills/) (10 Spec Kit skills) | **Optional Spec Kit Workflow Skills** (`/speckit-specify`, `/speckit-clarify`, `/speckit-plan`, `/speckit-checklist`, `/speckit-tasks`, `/speckit-analyze`, `/speckit-implement`, `/speckit-constitution`, `/speckit-converge`, `/speckit-taskstoissues`) for large, complex features. | Managed by `specify` CLI (`agy.manifest.json`). Do not hand-edit. |
| [`docs/agents/`](docs/agents/) | **LIP Skill Configuration** ([`domain.md`](docs/agents/domain.md) and [`issue-tracker.md`](docs/agents/issue-tracker.md)). | Binds skills to `docs/context/` and `.scratch/<feature-slug>/`. |
| [`skills/lip*`](skills/) | **Published Upstream Consumer Skills** (`lip`, `lip-bff`, `lip-checkout`, `lip-cli`, `lip-conformance`, `lip-sdk`, `lip-webhooks`) for external developers integrating with LIP. | Part of the public release surface verified by `npm run docs:check`. Only update when LIP public API/CLI contracts change. |
| [`.claude/skills/`](.claude/skills/) | **Legacy Claude Code Workflow Skills** preserved from Phase 0. | Preserve intact as historical snapshots; do not modify or delete. |

---

## 4. Decision Governance

Agents MUST distinguish between four explicit decision states:

- **Approved** (in [`docs/context/01-decisions.md`](docs/context/01-decisions.md)): Binding requirement. Must be respected by all specs, plans, and code.
- **Proposed**: Candidate recommendation or default starting value. Must **never** silently become an implementation requirement without explicit user approval.
- **Rejected**: Explicitly ruled out. Do not re-propose or implement.
- **Superseded**: Replaced by a newer Approved decision or amendment (e.g., `PD-003 A1`, `PD-005 A1`).

Any change to an **Approved** decision requires explicit user approval and a corresponding update in [`docs/context/01-decisions.md`](docs/context/01-decisions.md). Do not work on tasks whose phase gate is closed or that depend on an unapproved Proposed decision.

---

## 5. Task Classification & Mandatory Workflow

Classify every incoming task into one of three tiers before acting:

### Tier 1 — Trivial
- **Scope**: Typos, formatting, and isolated non-behavioral documentation fixes.
- **Workflow**: Read relevant context → make the minimal change → run verification checks (`npm run typecheck`, `npm run docs:check`, `npm run launch:check`, `npm run public-safety:check`).

### Tier 2 — Bug Fix
- **Scope**: Behavioral defects, race conditions, calculation bugs, migration bugs, or test failures.
- **Default Skill**: `diagnosing-bugs` ([`.agents/skills/diagnosing-bugs/SKILL.md`](.agents/skills/diagnosing-bugs/SKILL.md)).
- **Workflow**:
  1. Read relevant `docs/context/` files and build a tight, deterministic reproduction loop (`diagnosing-bugs` Phases 1–4).
  2. Produce a root-cause analysis, proposed correction, and regression test plan (plus an entry plan for [`docs/context/07-fork-patches.md`](docs/context/07-fork-patches.md) if upstream LIP code/behavior is modified).
  3. **GATE — Tier 2 User Approval**: Stop and wait for explicit user approval of the root-cause analysis and proposed fix/test plan before applying any production fix.
  4. Implement the regression test and fix (`diagnosing-bugs` Phase 5 + `tdd`), then run `code-review`.
  5. Run required verification checks and report exact results without committing automatically.

### Tier 3 — Feature / Architecture (Spec-Driven Lifecycle)
- **Mandatory Scope**: A Tier 3 Spec-Driven workflow with explicit user approval gates is **mandatory** for all:
  - New features
  - Database schema changes
  - API contract changes
  - Authentication and authorization
  - Tenant isolation
  - Payment and loyalty engine behavior
  - Architectural decisions
- **Default Day-to-Day Workflow (Matt Pocock Skills)**:
  1. **Design & Clarify** (`grill-with-docs` / `grilling` / `domain-modeling`, or Antigravity native `/grill-me`): Interview the user to resolve ambiguities, edge cases, and domain terms against [`docs/agents/domain.md`](docs/agents/domain.md).
  2. **Specify** (`to-spec`): Synthesize the agreed design and test seams into `.scratch/<feature-slug>/spec.md` per [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md).
  3. **GATE 1 — Specification Approval**: Stop and obtain explicit user approval of `.scratch/<feature-slug>/spec.md`.
  4. **Slice into Tickets** (`to-tickets`): Break the approved spec into vertical tracer-bullet tickets with blocking edges and agreed test seams under `.scratch/<feature-slug>/issues/<NN>-<slug>.md`.
  5. **GATE 2 — Tickets & Test Seams Approval**: Stop and obtain explicit user approval of the tickets and test seams.
  6. **Implement & Review** (`implement` → `tdd` → `code-review`): Execute the approved tickets test-first at agreed seams, run the two-axis `code-review` (Standards + Spec), and **stop without committing**.
  7. **Verify**: Run all required verification suites and report exact metrics.
- **Optional Workflow for Large / Complex Features (GitHub Spec Kit)**:
  1. **Specify & Clarify** (`/speckit-specify` → `/speckit-clarify`): Author and refine `specs/<NNN-feature>/spec.md`.
  2. **GATE 1 — Specification Approval**: Stop and obtain explicit user approval of `spec.md`.
  3. **Plan, Checklist, Tasks, & Analyze** (`/speckit-plan` → `/speckit-checklist` → `/speckit-tasks` → `/speckit-analyze`): Produce `plan.md`, quality checklists, ordered `tasks.md`, and cross-artifact consistency analysis against [`.specify/memory/constitution.md`](.specify/memory/constitution.md).
  4. **GATE 2 — Plan & Tasks Approval**: Stop and obtain explicit user approval of `plan.md` and `tasks.md`.
  5. **Implement & Verify** (`/speckit-implement` + `code-review`): Execute the approved tasks incrementally with tests, run all verification suites, and report exact metrics without committing automatically.

---

## 6. Golden Engineering, Domain, & Security Invariants

1. **Upstream Protocol vs. Product Layer (`PD-002`, `PD-006`)**:
   - Code inside upstream packages may be modified when needed, but `/lip/v1` wire semantics and [`spec/`](spec/) may **not** be broken.
   - Log every modification to upstream LIP code/behavior in [`docs/context/07-fork-patches.md`](docs/context/07-fork-patches.md).
   - Put turnkey product capabilities in our own layer (`apps/bff`, `apps/web`, or dedicated SaaS extensions). Do not classify routine SaaS extensions in `apps/cloud` or new apps as upstream fork patches unless they modify existing upstream LIP code/behavior.
2. **Multi-Tenant Isolation (`04-business-rules.md`)**:
   - Every business-owned row MUST be isolated at the database level via PostgreSQL Row-Level Security (`RLS` using transaction-local GUC `lip.tenant_id`, see [`packages/storage-postgres/migrations/002_tenant_isolation.sql`](packages/storage-postgres/migrations/002_tenant_isolation.sql)).
   - Never add a tenant table without an RLS policy; never trust tenant IDs from a client.
   - Merchant API keys never reach a browser or phone; clients talk exclusively to the BFF.
3. **Monetary Values & Rounding (`04-business-rules.md`, `PD-008`)**:
   - Money is integer minor units (`EGP 45.50` = `{ "amount": 4550, "currency": "EGP" }`). Never use floats for money or points.
   - Follow the explicit business rules and rounding requirements in [`docs/context/04-business-rules.md`](docs/context/04-business-rules.md) and `spec/` (do not prescribe `Math.floor()` as a universal monetary rounding policy).
4. **Egyptian Mobile Phone Format (`PD-004`, `04-business-rules.md`)**:
   - Normalize and validate Egyptian mobile numbers to E.164 format across the four valid mobile prefixes:
     - `+2010XXXXXXXX`
     - `+2011XXXXXXXX`
     - `+2012XXXXXXXX`
     - `+2015XXXXXXXX`
5. **Idempotency & Immutable Ledger (`04-business-rules.md`)**:
   - Every write carries an idempotency key and a stable business ID (`order_id`, `redemption_id`, `adjustment_id`).
   - The ledger is immutable: corrections and voids are new entries, never `UPDATE` or `DELETE`.
6. **PostgreSQL & Migration Safety (`FP-001`, `PD-002`, `PD-006`)**:
   - Preserve `FP-001` (`pg_advisory_xact_lock` acquired inside `BEGIN ... COMMIT` before migration-table `CREATE TABLE IF NOT EXISTS` DDL) in all three PostgreSQL migrators.
   - Require concurrency-safe migration initialization and appropriate locking across all migrations. Connect to PostgreSQL directly or via session-mode poolers only (never transaction-mode poolers).
7. **Privacy, PDPL Controls, OTP, & Billing (`Law 151/2020`, `PD-004`, `PD-005 A1`, `PD-006`)**:
   - Treat PDPL requirements (isolating personal data in the platform customer directory schema/role, per-brand consent, right-to-erasure scrubbing profile PII while keeping the pseudonymous ledger, zero raw phone/email across `/lip/v1` or in logs) as engineering requirements subject to legal validation (Task `0.10`). Do not claim legal certification or approval without evidence.
   - Store OTP codes as HMAC digests with a server-side secret and compare in constant time (`PD-004`).
   - Billing at launch is manual (`billing_provider: "manual"`, `PD-005 A1`); Kashier is deferred, not removed. Do not add Stripe code paths.

---

## 7. Codebase Map & Standard Commands

| Area | Path |
|---|---|
| Normative protocol prose | [`spec/core.md`](spec/core.md), [`spec/lifecycle.md`](spec/lifecycle.md), [`spec/account-experience.md`](spec/account-experience.md), [`spec/profiles/foodservice.md`](spec/profiles/foodservice.md) |
| Protocol types & JSON schemas | [`packages/protocol/src/`](packages/protocol/src/) (TypeBox → `spec/schemas/*.json`) |
| Loyalty engine (points, stamps, tiers, lots, expiry) | [`packages/reference/src/engine.ts`](packages/reference/src/engine.ts), [`packages/reference/src/config.ts`](packages/reference/src/config.ts) |
| HTTP server + Admin API | [`packages/server/src/server.ts`](packages/server/src/server.ts) |
| Roles, API keys, location scope, audit | [`packages/server/src/access-control.ts`](packages/server/src/access-control.ts) |
| Branches (locations) | [`packages/server/src/locations.ts`](packages/server/src/locations.ts) |
| Program draft / publish / rollback | [`packages/server/src/program-management.ts`](packages/server/src/program-management.ts) |
| Customer profiles, consent, events, CSV import | [`packages/server/src/customer-data.ts`](packages/server/src/customer-data.ts) |
| Segments, reward campaigns, holdouts | [`packages/server/src/campaigns.ts`](packages/server/src/campaigns.ts) |
| Messaging jobs (webhook connector) | [`packages/server/src/engagement.ts`](packages/server/src/engagement.ts) |
| PostgreSQL storage, migrations, & RLS | [`packages/storage-postgres/`](packages/storage-postgres/) |
| Customer identity & cloud control plane | [`packages/identity/`](packages/identity/), [`apps/cloud/src/`](apps/cloud/src/) |
| Tests | [`tests/unit/`](tests/unit/), [`tests/conformance/`](tests/conformance/), `packages/*/src/*.test.ts`, `apps/*/src/*.test.ts` |

### Verification Commands (Node.js `22.22.0`)
```bash
npm ci                        # Install dependencies (npm workspaces; pnpm is not supported)
npm run typecheck             # Workspace + Admin TypeScript check
npm run docs:check            # Verify docs mirror pairs
npm run launch:check          # Verify launch surface, namespaces, and versions
npm run public-safety:check   # Scan tracked files for secrets/safety
npm test                      # Run Vitest suite
specify integration status    # Verify Spec Kit & Antigravity integration health
```

### Verification Honesty
- Distinguish mandatory tests from intentionally skipped or environment-unsupported tests.
- Never hide skipped tests or failures, and **never claim the full test suite passed unless it was actually executed**.
- Report exact passed, failed, and skipped counts, the execution environment (Windows host vs. Linux `node:22.22.0` + `postgres:17-alpine`), and the reason for any skip.

---

## 8. Git & Deployment Restrictions

- **Remotes**: `origin` (`https://github.com/muhammedemara024-ops/LIP.git`); `upstream` (`https://github.com/craveup-oss/loyalty-interchange-protocol.git`, fetch-only, `pushurl = DISABLED`).
- **Strict Rules**:
  - Never push to `upstream`.
  - Never force-push `main`.
  - Never commit secrets, `.env` files, credentials, or runtime state (`.lip/`).
  - Never commit or push without explicit user authorization.
  - Never deploy or modify production data without explicit user authorization.
  - Always preserve unrelated working-tree changes.

---

## Agent skills

- For domain modeling, glossary lookups, and decision records, see [`docs/agents/domain.md`](docs/agents/domain.md).
- For specs, tickets, and issue tracker operations, see [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md).
