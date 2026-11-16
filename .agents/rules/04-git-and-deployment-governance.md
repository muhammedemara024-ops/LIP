---
trigger: always_on
description: 3-tier task workflow, Matt Pocock default workflow & Spec Kit optional workflow, approval gates, and git/deployment safety
---

# Workflow Tiers, Approval Gates, & Git Governance

1. **Instruction Precedence**:
   - Repository governance in `AGENTS.md`, `.specify/memory/constitution.md`, `.agents/rules/`, `docs/agents/domain.md`, `docs/agents/issue-tracker.md`, and `docs/context/` **always overrides generic skill instructions**.
   - Never create a duplicate root `GLOSSARY.md` or `docs/adr/` directory; use `docs/context/05-glossary.md` and `docs/context/01-decisions.md` per `docs/agents/domain.md`.
   - Default local spec and ticket storage is `.scratch/<feature-slug>/` per `docs/agents/issue-tracker.md` (use GitHub Issues only when explicitly requested).

2. **Workflow Tiers & Approval Gates (always-on hard stops)**:
   - The full procedure is canonical in `AGENTS.md` §5 and constitution Article IX. Classify every task as Tier 1, 2 or 3 first.
   - Tier 3 (with Gate 1 and Gate 2) is mandatory for:
     - new features;
     - schema changes;
     - API contract changes;
     - authentication and authorization;
     - tenant isolation;
     - payment and loyalty-engine behaviour;
     - architectural decisions.
   - **STOP** at every Tier 2 and Tier 3 approval gate, and at any extra gate the owner requests.
   - Never start a step whose preceding gate is not recorded as approved in the feature artifact's Status line (`AGENTS.md` §5, *Short-Prompt Session Protocol*).
   - Invoking a skill is not approval. Gate approval, implementation, commit, push and deploy are separate owner approvals.

3. **Task Quality**: Every implementation task or ticket meets the Implementation Task Quality Standard (rule 05) before it is marked ready or delegated.

4. **Multi-Agent Review & Disagreement-Based Escalation** (always-on hard stops; the full policy is in `AGENTS.md` §5):
   - Classify risk by potential impact (LOW / MEDIUM / HIGH / CRITICAL), never by title or code size. When uncertain between MEDIUM and HIGH, classify as HIGH.
   - **G02 (temporary, `PD-048`).** Claude Opus 5.5 High is the primary orchestrator. Codex Sol is not invoked and is not a blocking dependency.
   - The independent read-only review is mandatory for HIGH and CRITICAL work, in a separate session with enforced read-only permissions. Route it by the AGENTS §5 author→reviewer table:
     - Opus-authored work (the orchestrator or Opus lanes), and `agy`-authored work with no Claude-authored change, go to `plan-review` (Sonnet 5.5 XHigh);
     - Sonnet-authored work goes to `migration-review` (Opus 5.5 High) in a fresh read-only session that is not the orchestrator's session;
     - work by any combination of authors is split by change set and each part routed as above; if the parts cannot be separated, it stays blocked for the owner.
   - No reviewer approves work its own model authored, even across sessions.
   - A HIGH or CRITICAL finding is resolved only by verifiable evidence and applicable passing tests, never by agent agreement alone. Without that evidence, or if mandatory verification fails, the task stays blocked; no verdict substitutes for verification.
   - The `final-verdict` gate is retired under G02:
     - a material technical disagreement still unresolved after two follow-up debate rounds keeps the task blocked and goes to the owner;
     - publishing needs the owner's explicit push authorization, and every HIGH or CRITICAL change in the pushed commits must already carry a passing independent review that covers the final pushed content; later edits need re-review.
   - Preserve the approved fleet assignments: 20 active lanes, `final-verdict` retired, no active lane on Codex. Fable has no prospective routing. The Hydrogen XHigh `security-review` and `critical-architecture-hydrogen` lanes remain blocked until their isolation requirements are satisfied with recorded enforcement evidence; flags or prompts alone do not suffice. Do not reassign blocked lanes. Argon requires explicit owner approval. Preserve historical review evidence (AGENTS §5).
   - A missing, failed or non-read-only review counts as no review.
   - No verdict overrides owner-approved rules, authorizes implementation, commits or pushes, or decides a product question.

5. **Git, Remote, & Deployment Safety**:
   - Never push to `upstream` (`craveup-oss/loyalty-interchange-protocol`).
   - Never force-push `main`.
   - Never commit secrets, `.env` files, credentials, or local runtime state (`.lip/`).
   - Never commit or push without explicit user authorization (`implement` must never auto-commit).
   - Never deploy or modify production data without explicit user authorization.
   - Always preserve unrelated working-tree changes.
