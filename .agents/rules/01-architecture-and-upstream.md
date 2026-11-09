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
   - Record every modification to upstream LIP behavior/code in `docs/context/07-fork-patches.md`. Do not classify new SaaS product extensions (such as `apps/bff`, `apps/web`, or dedicated SaaS modules) as upstream fork patches unless they modify existing upstream LIP behavior or code.

4. **TypeScript & PostgreSQL Migration Safety (`FP-001`)**:
   - Use strict TypeScript (`strict: true`, no `any`, explicit `.js` extensions on relative ESM imports).
   - Preserve `FP-001` advisory lock ordering in `packages/storage-postgres/src/index.ts`, `apps/cloud/src/postgres-repository.ts`, and `apps/cloud/src/customer-postgres-repository.ts`. Require concurrency-safe migration initialization and appropriate locking across all migrations, without imposing an unsupported universal SQL implementation on every migration.
