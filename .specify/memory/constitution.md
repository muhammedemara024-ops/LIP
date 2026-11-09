# Loyalty Interchange Protocol (LIP) & Egypt Loyalty SaaS — Engineering Constitution

## Core Principles

### Article I — Existing Architecture & Context Supremacy
1. This repository is a fork of the open-source **Loyalty Interchange Protocol (`LIP`)** (`craveup-oss/loyalty-interchange-protocol`, pinned to `8ad93c81a414f5f7521061ddd88009083f4857aa`, package version `0.2.0` per `PD-002`), used as the loyalty core for a multi-tenant SaaS loyalty and customer retention platform for cafés and restaurants in Egypt.
2. Every specification, technical plan, task breakdown, and implementation MUST align with the authoritative context pack in `docs/context/` (`docs/context/README.md`):
   - Order of authority when files disagree:
     1. `docs/context/01-decisions.md` (Approved decisions `PD-001` through `PD-009`+)
     2. `spec/` (LIP normative `/lip/v1` protocol specification)
     3. `docs/context/04-business-rules.md` (Binding `MUST` domain invariants)
     4. All other context and reference files (`00-product-brief.md`, `02-lip-architecture-map.md`, `03-gap-analysis.md`, `05-glossary.md`, `06-roadmap.md`, `07-fork-patches.md`)
3. Existing project context (`docs/context/*`), upstream consumer skills (`skills/lip*`), and historical Claude Code skills (`.claude/skills/*`) MUST be preserved intact. Agents MUST NOT rewrite historical decisions or remove historical handoff documents (`docs/context/handoff-phase0.md`, `docs/context/claude-project-instructions.md`).

### Article II — Upstream Protocol Preservation, Verified Licensing, & Fork-Patch Governance
1. **Verified License Metadata**: The repository root [`LICENSE`](../../LICENSE) and `@loyalty-interchange/*` package manifests specify **Apache License, Version 2.0 (`Apache-2.0`)** (`Copyright 2026 Loyalty Interchange Protocol contributors`). Documentation and specifications MUST record only verified licensing metadata from `LICENSE` and `package.json`.
2. **Protocol Wire Semantics (`PD-002`)**: Normative `/lip/v1` wire semantics and `spec/` MUST NOT be broken. Turnkey Egypt SaaS product features (customer phone OTP, QR flows, staff cashier surface, owner dashboard, WhatsApp automation, Arabic UI, localized content) live outside `/lip/v1` in our own BFF and web layers (`apps/bff`, `apps/web`) or platform extensions (`PD-002`, `PD-006`).
3. **Fork-Patch Governance**: Code inside upstream LIP packages (`packages/*`, `apps/cloud`, `conformance/`) may be modified when required, and every modification to upstream LIP code/behavior MUST be logged in `docs/context/07-fork-patches.md` (recording affected files, reason, `PD-0XX` / task reference, test coverage, and upstream upgrade impact).
4. **SaaS Extensions vs. Upstream Patches**: New product modules and extensions (such as `apps/bff`, `apps/web`, or dedicated SaaS modules) are product extensions, NOT upstream fork patches. Do not classify every SaaS extension inside `apps/cloud` or new apps as an upstream patch unless it modifies existing upstream LIP code or behavior.

### Article III — Decision Governance & Lifecycle States
1. Every architectural or product decision MUST be classified into one of four explicit lifecycle states:
   - **Approved**: Ratified by the project owner in `docs/context/01-decisions.md`. Binding on all specifications, plans, and code.
   - **Proposed**: Candidate design, default starting value, or open recommendation. MUST NOT silently become an implementation requirement until explicitly approved by the user.
   - **Rejected**: Explicitly ruled out (e.g., Stripe at launch, Twilio SMS, static customer barcodes, offline value grants in MVP). MUST NOT be implemented or re-proposed without a new owner request.
   - **Superseded**: Previously approved decision or clause replaced by a newer Approved decision or amendment (e.g., `PD-003 A1`, `PD-005 A1`).
2. Only **Approved** decisions are binding. Changing or overriding an Approved decision requires explicit user approval and a synchronous update to `docs/context/01-decisions.md`.

### Article IV — Multi-Tenant Isolation & Security by Default
1. Every business-owned row MUST be isolated at the database level via PostgreSQL Row-Level Security (`RLS` using the transaction-local GUC `lip.tenant_id`, see `packages/storage-postgres/migrations/002_tenant_isolation.sql`), not only filtered in the UI or application layer.
2. Never add a tenant-owned table without an RLS policy, and never trust a tenant identifier supplied directly by an untrusted client.
3. Merchant API keys MUST never reach a browser or customer device; client surfaces (`apps/web`) communicate exclusively through the BFF (`apps/bff`).
4. Raw customer phone numbers or email addresses MUST never cross `/lip/v1` (which uses opaque `member_id` values) and MUST never appear in logs, URLs, or idempotency keys (`PD-001`, `PD-006`, `04-business-rules.md`).

### Article V — Monetary, Phone, & Localization Invariants
1. **Monetary Representation**: All monetary amounts MUST be stored and processed as integer minor units; for Egyptian Pounds (`EGP`), integer piasters (`4550` = `45.50 EGP`). Floating-point numbers for money or points are strictly prohibited.
2. **Rounding & Calculation Rules**: Do NOT prescribe `Math.floor()` as a universal monetary rounding policy. Follow the explicit business rules and rounding requirements in `docs/context/04-business-rules.md` and `spec/` (e.g., eligible spend = line subtotal minus line discount; rounding applies once on total eligible spend, never per line; earn previews come from LIP `orders/evaluate`, never client-side math per `PD-008`).
3. **Egyptian Phone Normalization (`PD-004`, `04-business-rules.md`)**: Normalize and validate Egyptian mobile numbers in E.164 format across the four valid Egyptian mobile operator prefixes:
   - `+2010XXXXXXXX`
   - `+2011XXXXXXXX`
   - `+2012XXXXXXXX`
   - `+2015XXXXXXXX`
   (Pattern: `^\+20(10|11|12|15)\d{8}$`).
4. **Localization & Time Zone (`PD-007`)**: Arabic (`RTL`) is the default language of every customer, staff, and owner surface, with English (`LTR`) second. Display Western digits (`0–9`) while normalizing Western, Arabic-Indic, and Persian input digits. Store timestamps in UTC and evaluate all display and day-based business rules in IANA time zone `Africa/Cairo` (never a fixed offset).

### Article VI — PostgreSQL & Migration Safety
1. **Verified Cold-Start Lock Invariant (`FP-001`)**: Preserve `FP-001` (`docs/context/07-fork-patches.md`) as a verified project-specific requirement across `packages/storage-postgres/src/index.ts`, `apps/cloud/src/postgres-repository.ts`, and `apps/cloud/src/customer-postgres-repository.ts`, where the transaction-scoped advisory lock (`pg_advisory_xact_lock`) is acquired inside `BEGIN ... COMMIT` before migration-table `CREATE TABLE IF NOT EXISTS` DDL.
2. **Migration Safety Standards**: Require concurrency-safe migration initialization, appropriate locking, and idempotent execution across all schema migrations, without imposing an unsupported universal SQL implementation pattern on every migration body.
3. **Direct / Session-Mode PostgreSQL Connectivity (`PD-002`, `PD-006`)**: Services MUST connect to PostgreSQL directly or via a session-mode pooler, never a transaction-mode pooler, so session advisory leases (`withLease()`) remain sound.

### Article VII — Verification Transparency & Test Discipline
1. **Honest Reporting**: Distinguish mandatory tests from intentionally skipped or environment-unsupported tests. Never hide skipped tests or failures, and **never claim the full test suite passed unless it was actually executed**.
2. **Exact Metrics**: Every verification report MUST state the execution environment (e.g., Windows host vs. Linux `node:22.22.0` + `postgres:17-alpine`), exact counts of passed, failed, and skipped tests, and the specific reason for any skip.
3. **Test Coverage Requirements**:
   - Every bug fix (Tier 2) requires a regression test that reproduces the defect and verifies the fix.
   - Every feature or schema/API change (Tier 3) requires unit and integration test coverage.
   - Changes to PostgreSQL storage, migrations, leases, or tenant isolation MUST be verified in the official Linux + PostgreSQL 17 environment (`tenant-isolation-live`, PostgreSQL storage tenant isolation, and `postgres-lease-conformance`).

### Article VIII — Privacy, PDPL Engineering Controls, & Webhook / OTP Integrity
1. **PDPL Engineering Posture (`Law 151/2020`, `PD-006`)**: Treat all privacy and data-residency requirements in `docs/context/04-business-rules.md` and `PD-006` (isolating personal data in the platform customer directory schema/role, per-brand marketing consent with audit metadata, account deletion erasing profile PII while preserving the pseudonymous immutable ledger, and zero raw PII in logs) as **engineering requirements subject to legal validation** (Task `0.10`). Do NOT claim legal approval, regulatory sign-off, or compliance certification without documented external evidence.
2. **OTP, Session, & Webhook Security (`PD-004`, `PD-005`)**:
   - Store OTP codes as HMAC digests with a server-side secret and compare in constant time (`crypto.timingSafeEqual`).
   - Store session IDs hashed (`>= 256` bits random entropy) with `httpOnly`, `Secure`, `SameSite` cookies and CSRF protection on state-changing requests.
   - Verify all webhooks on the raw body using HMAC-SHA256 + constant-time comparison and deduplicate by transaction/event ID.

### Article IX — Task Classification & Spec-Driven Approval Gates
1. All engineering work MUST follow the three-tier workflow:
   - **Tier 1 — Trivial**: Typos, formatting, and isolated non-behavioral documentation fixes. Read relevant context → apply minimal change → verify.
   - **Tier 2 — Bug Fix**: Build a tight reproduction loop and read-only root-cause analysis (`diagnosing-bugs`) → proposed correction + regression test plan (and `07-fork-patches.md` update if touching upstream LIP code) → **STOP for User Approval** → implement regression test & fix (`tdd`) + `code-review` → verify.
   - **Tier 3 — Feature / Architecture**: Spec-Driven lifecycle using either:
     - **Default Day-to-Day Workflow (Matt Pocock Skills)**:
       `Design & Clarify (grill-with-docs / grilling / domain-modeling or /grill-me)` → `Specify (to-spec → .scratch/<feature-slug>/spec.md)` → **Gate 1: User Approves Specification (`spec.md`)** → `Slice into Tickets (to-tickets → .scratch/<feature-slug>/issues/<NN>-<slug>.md & agreed test seams)` → **Gate 2: User Approves Tickets & Test Seams** → `Implement & Review (implement → tdd → code-review, no auto-commit)` → `Verify`.
     - **Optional Workflow for Large / Complex Features (Spec Kit)**:
       `Specify (/speckit-specify)` → `Clarify (/speckit-clarify)` → **Gate 1: User Approves Specification (`spec.md`)** → `Plan (/speckit-plan)` → `Checklist (/speckit-checklist)` → `Tasks (/speckit-tasks)` → `Analyze (/speckit-analyze)` → **Gate 2: User Approves Technical Plan & Tasks (`plan.md`, `tasks.md`)** → `Implement (/speckit-implement)` → `Verify`.
2. **Mandatory Tier 3 Scope**: A Tier 3 Spec-Driven workflow (with Gate 1 and Gate 2 user approvals) is mandatory for all:
   - New features
   - Database schema changes
   - API contract changes
   - Authentication and authorization
   - Tenant isolation
   - Payment and loyalty engine behavior
   - Architectural decisions
3. **Repository Governance Supremacy**: Repository instructions (`AGENTS.md`, this Constitution, `.agents/rules/`, `docs/agents/domain.md`, and `docs/agents/issue-tracker.md`) always override generic skill instructions. No skill may create a duplicate root `GLOSSARY.md` or `docs/adr/`, bypass an approval gate, or commit/push automatically.

### Article X — Git, Remote, & Deployment Safety
1. Never push to `upstream` (`craveup-oss/loyalty-interchange-protocol`).
2. Never force-push `main`.
3. Never commit secrets, `.env` files, credentials, or local runtime state (`.lip/`).
4. Never commit or push without explicit user authorization.
5. Never deploy or modify production data without explicit user authorization.
6. Preserve all unrelated working-tree changes.

## Governance
This Constitution is the binding engineering charter for this repository. Operational agent instructions live in [`AGENTS.md`](../../AGENTS.md) and [`.agents/rules/`](../../.agents/rules/). When any generated template or generic skill instruction conflicts with this Constitution or Approved decisions in [`docs/context/01-decisions.md`](../../docs/context/01-decisions.md), this Constitution and `01-decisions.md` prevail.

## Amendment History
- **v1.1.0 (2026-11-08)**: Amended Article IX and Governance to establish the curated Matt Pocock Skills suite under `.agents/skills/` (`grill-with-docs`, `to-spec`, `to-tickets`, `implement`, `tdd`, `code-review`, `diagnosing-bugs`, configured via `docs/agents/domain.md` and `docs/agents/issue-tracker.md`) as the default day-to-day Spec-Driven workflow and GitHub Spec Kit (`/speckit-*`) as an optional workflow for large, complex features, while preserving all mandatory Tier 2 and Tier 3 approval gates, no-auto-commit rules, and Articles I–VIII & X unchanged.
- **v1.0.0 (2026-11-08)**: Initial ratification of the 10-article LIP & Egypt Loyalty SaaS Engineering Constitution.

**Version**: 1.1.0 | **Ratified**: 2026-11-08 | **Last Amended**: 2026-11-08
