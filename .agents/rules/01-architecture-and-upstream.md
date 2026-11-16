---
trigger: always_on
description: Upstream LIP protocol preservation, fork-patch governance, decision states, and TypeScript/PostgreSQL conventions
---

# Architecture, Upstream Preservation, & Decision Governance

1. **Authoritative Context & Order of Authority**:
   - Before planning or modifying code, consult `AGENTS.md`, `.specify/memory/constitution.md`, and `docs/context/00-product-brief.md` through `docs/context/07-fork-patches.md`.
   - When files disagree, follow `docs/context/README.md`: (1) `docs/context/01-decisions.md` (`PD-001`..`PD-009`+), (2) `spec/` (`/lip/v1` normative protocol), (3) `docs/context/04-business-rules.md`, (4) everything else.
   - Preserve `docs/context/*`, `skills/lip*` (upstream consumer skills), and `.claude/skills/*` (historical Claude skills).

2. **Decision States (`docs/context/01-decisions.md`)**:
   - Strictly distinguish **Approved**, **Proposed**, **Rejected**, and **Superseded** decisions.
   - Only **Approved** decisions are binding. Never treat a **Proposed** decision or default starting value as an approved requirement.
   - Modifying or overriding an Approved decision requires explicit user approval and an update to `docs/context/01-decisions.md`.

3. **Upstream Protocol vs. Product Extensions (`PD-002`, `PD-006`)**:
   - Repository license is **Apache License, Version 2.0 (`Apache-2.0`)** per `LICENSE` and `@loyalty-interchange/*` package manifests. Record only verified licensing metadata.
   - Do not break `/lip/v1` wire semantics or `spec/`.
   - Code inside upstream packages may be modified when needed. Put turnkey product capabilities in our own layer (`apps/bff`, `apps/web`, or dedicated SaaS extensions).
   - Record every modification to upstream LIP behavior/code in `docs/context/07-fork-patches.md`. Do not classify new SaaS product extensions (such as `apps/bff`, `apps/web`, or dedicated SaaS modules) as upstream fork patches unless they modify existing upstream LIP behavior or code.

4. **TypeScript & PostgreSQL Migration Safety (`FP-001`)**:
   - Use strict TypeScript (`strict: true`, no `any`, explicit `.js` extensions on relative ESM imports).
   - Preserve `FP-001` advisory lock ordering in `packages/storage-postgres/src/index.ts`, `apps/cloud/src/postgres-repository.ts`, and `apps/cloud/src/customer-postgres-repository.ts`. Require concurrency-safe migration initialization and appropriate locking across all migrations, without imposing an unsupported universal SQL implementation on every migration.
   - Connect to PostgreSQL directly or via session-mode poolers only (never transaction-mode poolers).

5. **Evolvability & Backward Compatibility** (owner-approved 2026-11-13; constitution Article XI). LIP must stay scalable, extensible, maintainable and backward-compatible as features, tenants, branches and integrations are added. Every implementation (a Tier 2 fix or a Tier 3 task or ticket), and every plan, task or ticket that authorizes one, MUST:
   1. **Inventory the impact.** Name the affected modules, APIs (`/lip/v1`, BFF, Admin, platform, operator), database schemas and migrations, contracts, configuration and existing behaviour, each by verified path or contract section.
   2. **Design for change.** Use cohesive modules, explicit boundaries and stable interfaces; apply SOLID where it reduces coupling. Add no speculative abstraction, extension point or premature microservice: a new abstraction or deployable service needs a present, cited requirement. Prefer extending through our own layer (`apps/bff`, `apps/web`, SaaS modules) over changing upstream packages (item 3).
   3. **Stay backward-compatible by default.** Existing API responses and wire semantics, persisted data, configuration and approved behaviour keep working; prefer additive changes. A breaking change is allowed only with explicit owner approval (an Approved decision or an approved feature artifact that names the break) **and** a migration plan covering affected consumers and data, transition or deprecation, verification and rollback.
   4. **Evolve data safely.** Migrations are concurrency-safe and idempotent (item 4, constitution Article VI). Renames, retypes and moves use expand–contract. Never drop, truncate or rewrite existing data without an approved migration that preserves or migrates it. Every new tenant table has RLS (rule 02).
   5. **Protect the invariants** of rule 02: tenant isolation, accounting and ledger immutability, authorization, concurrency and idempotency.
   6. **Test what it touches.** Add regression tests for every affected existing behaviour, integration tests across every changed boundary, and contract tests for every changed or added API, schema or event contract, including proof that existing consumers still work (rule 03).
   7. **Assess performance and operations** where they apply (hot paths, per-tenant and per-branch growth, queries and indexes, locks, background jobs, external calls, migration duration). State the realistic bottleneck, the load assumption and its source, and the operational impact; otherwise write "n/a" with the reason.
   8. **Document** compatibility assumptions, failure modes, and rollback and recovery (code revert, migration reversibility, data recovery).
   9. **Stop and escalate** to the orchestrator, and through it to the owner, when a change risks breaking approved behaviour, a published contract or existing data without an authorized mitigation. Never ship the break, weaken or delete a test, or relabel the break as a fix to get past this rule.

   **Enforcement.**
   - Rule 05 field 13 and its readiness check make items 1–9 a precondition of `ready`.
   - The `code-review` Standards axis and the independent reviewer (`AGENTS.md` §5) check them.
   - A missing item on a change that touches an API, schema, migration, contract or existing behaviour is a hard finding.
