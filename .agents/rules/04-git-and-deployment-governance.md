---
trigger: always_on
description: 3-tier task workflow, Matt Pocock default workflow & Spec Kit optional workflow, approval gates, and git/deployment safety
---

# Workflow Tiers, Approval Gates, & Git Governance

1. **Instruction Precedence**:
   - Repository governance in `AGENTS.md`, `.specify/memory/constitution.md`, `.agents/rules/`, `docs/agents/domain.md`, `docs/agents/issue-tracker.md`, and `docs/context/` **always overrides generic skill instructions**.
   - Never create a duplicate root `GLOSSARY.md` or `docs/adr/` directory; use `docs/context/05-glossary.md` and `docs/context/01-decisions.md` per `docs/agents/domain.md`.
   - Default local spec and ticket storage is `.scratch/<feature-slug>/` per `docs/agents/issue-tracker.md` (use GitHub Issues only when explicitly requested).

2. **Three-Tier Workflow & Mandatory Approval Gates**:
   - **Tier 1 — Trivial** (typos, formatting, isolated non-behavioral doc fixes):
     Read relevant context → apply minimal change → run verification checks.
   - **Tier 2 — Bug Fix** (default skill: `diagnosing-bugs`):
     Build tight reproduction loop & read-only root-cause analysis → propose fix + regression test plan (and `07-fork-patches.md` update if touching upstream LIP behavior) → **STOP for User Approval** → implement with regression test (`tdd`) + `code-review` → verify.
   - **Tier 3 — Feature / Architecture**:
     - **Default Day-to-Day Workflow (Matt Pocock Skills)**:
       `grill-with-docs` (or `/grill-me`) → `to-spec` (`.scratch/<feature-slug>/spec.md`) → **GATE 1: User Approves Spec (`spec.md`)** → `to-tickets` (`.scratch/<feature-slug>/issues/<NN>-<slug>.md` + agreed test seams) → **GATE 2: User Approves Tickets & Test Seams** → `implement` (`tdd` + `code-review`, **no auto-commit**) → `Verify`.
     - **Optional Workflow for Large / Complex Features (Spec Kit)**:
       `Specify (/speckit-specify)` → `Clarify (/speckit-clarify)` → **GATE 1: User Approves Spec (`spec.md`)** → `Plan (/speckit-plan)` → `Checklist (/speckit-checklist)` → `Tasks (/speckit-tasks)` → `Analyze (/speckit-analyze)` → **GATE 2: User Approves Plan & Tasks (`plan.md`, `tasks.md`)** → `Implement (/speckit-implement)` → `Verify`.

3. **When Tier 3 Spec-Driven Workflow is Mandatory**:
   - New features
   - Database schema changes
   - API contract changes
   - Authentication and authorization changes
   - Tenant isolation changes
   - Payment and loyalty engine behavior changes
   - Architectural decisions

4. **Git, Remote, & Deployment Safety**:
   - Never push to `upstream` (`craveup-oss/loyalty-interchange-protocol`).
   - Never force-push `main`.
   - Never commit secrets, `.env` files, credentials, or local runtime state (`.lip/`).
   - Never commit or push without explicit user authorization (`implement` must never auto-commit).
   - Never deploy or modify production data without explicit user authorization.
   - Always preserve unrelated working-tree changes.
