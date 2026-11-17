# AGENTS.md — Canonical Agent Operating Manual

> **Canonical entry point for every agent** (Claude Code, Codex, Antigravity and delegated implementers). It defines the permanent workflow, roles, disagreement-based review escalation and owner-approval boundaries. The [constitution](.specify/memory/constitution.md) remains the highest governing authority (§2).

## 1. Project Identity & Purpose

This repository is a fork of the open-source **Loyalty Interchange Protocol (`LIP`)** (`@loyalty-interchange/*`, licensed under **Apache License, Version 2.0** per [`LICENSE`](LICENSE) and package manifests; pinned to upstream `8ad93c81a414f5f7521061ddd88009083f4857aa`, package version `0.2.0` per `PD-002`).

We are building a **multi-tenant SaaS loyalty and customer retention platform for cafés and restaurants in Egypt** (Arabic RTL first + English LTR second, `EGP` integer piasters, WhatsApp-first OTP & notifications, QR counter capture) using LIP as the loyalty core (`PD-001` through `PD-009`).

- **Agents and workflows**:
  - The orchestrator plans, coordinates, reviews and lands work (§5).
  - Implementation and independent reviews are dispatched through delegate lanes (§5).
  - Default day-to-day workflow: curated **Matt Pocock Skills**.
  - Optional workflow for large, complex features: **GitHub Spec Kit** (`specify`).
- **Binding Engineering Charter**: [`.specify/memory/constitution.md`](.specify/memory/constitution.md).
- **Always-On Engineering Rules**: [`.agents/rules/`](.agents/rules/).
- **Skill Configuration Docs**: [`docs/agents/domain.md`](docs/agents/domain.md) and [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md).
- **Claude Code Entry Point**: [`CLAUDE.md`](CLAUDE.md), which only imports this file, the constitution and the rules.
- **Model Routing**: `.delegate/config.json` (local, untracked).

---

## 2. Authoritative Context & Order of Authority

**Instruction architecture (one owner per concern):**

| Layer | Owns |
|---|---|
| [`.specify/memory/constitution.md`](.specify/memory/constitution.md) | Highest governing authority for engineering and process. It is amended only with owner approval. |
| `AGENTS.md` (this file) | Permanent workflow, agent roles, disagreement-based review escalation, owner-approval boundaries, and the session protocol for short prompts (§5). |
| [`.agents/rules/*.md`](.agents/rules/) | Detailed always-on engineering rules: architecture, security, testing, Git hard stops, and implementation-task quality (rule 05). |
| [`docs/agents/`](docs/agents/) | Skill configuration: domain vocabulary and tracker locations. |
| Skills (§3) | Step procedures only. They never set gates, approvals, roles or model routing. |
| `.delegate/config.json` | Model routing per delegate lane (local, untracked). |
| [`docs/context/`](docs/context/) | Product authority, in the order below. |

- **Conflicts.** If two repository instructions conflict, the constitution prevails. Between `AGENTS.md` and a rule, follow the more restrictive one and report the conflict so it can be fixed.
- **Rules restating hard stops.** Rules may restate a hard stop (approval gates, Git safety) as an always-on safety net. `AGENTS.md` holds the full procedure.
- **Discovery.** Codex and Antigravity load this file automatically; Claude Code loads it through [`CLAUDE.md`](CLAUDE.md) imports. Before any task, every agent must have read the constitution and every file in `.agents/rules/`. Claude Code imports them; every other agent opens them.

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
| [`.agents/skills/speckit-*`](.agents/skills/) (10 Spec Kit skills) | **Optional Spec Kit Workflow Skills** (`/speckit-specify`, `/speckit-clarify`, `/speckit-plan`, `/speckit-checklist`, `/speckit-tasks`, `/speckit-analyze`, `/speckit-implement`, `/speckit-constitution`, `/speckit-converge`, `/speckit-taskstoissues`) for large, complex features. | Managed by `specify` CLI (`agy.manifest.json`). Do not hand-edit. Project customization goes through Spec Kit's template override layer: [`.specify/templates/overrides/`](.specify/templates/overrides/) (for example `tasks-template.md`, which applies rule 05). |
| `.claude/skills/speckit-*` | **Spec Kit Claude Code integration copies** of the same commands (`.specify/integrations/claude.manifest.json`). | Managed by `specify` CLI. Do not hand-edit. Currently untracked: preserve them, and track them only with owner approval. |
| [`docs/agents/`](docs/agents/) | **LIP Skill Configuration** ([`domain.md`](docs/agents/domain.md) and [`issue-tracker.md`](docs/agents/issue-tracker.md)). | Binds skills to `docs/context/` and `.scratch/<feature-slug>/`. |
| [`skills/lip*`](skills/) | **Published Upstream Consumer Skills** (`lip`, `lip-bff`, `lip-checkout`, `lip-cli`, `lip-conformance`, `lip-sdk`, `lip-webhooks`) for external developers integrating with LIP. | Part of the public release surface verified by `npm run docs:check`. Only update when LIP public API/CLI contracts change. |
| [`.agents/skills/wanees-phase/`](.agents/skills/wanees-phase/) and its pointer `.claude/skills/wanees-phase/` | **Project continuous execution workflow** (`/wanees-phase`): the persistent orchestrator around `/speckit-implement` that loops select → implement → verify → independent review → fast-forward delivery to `main` (`PD-050`) → next task across the whole dependency graph, parks blocked tasks, keeps a durable run record (`run-state.mjs`), and ends with one consolidated owner request or a run-scoped success flag (`PD-052`). | Project-owned procedure only. It never sets gates, approvals or routing, and this file, the constitution and the rules prevail over it. Change it only through the review policy in §5. |
| [`.claude/skills/`](.claude/skills/) (all other entries) | **Legacy Claude Code Workflow Skills** preserved from Phase 0. | Preserve intact as historical snapshots; do not modify or delete. |
| User-level `codex-delegate`, `claude-delegate`, `agy-delegate` (outside the repo) | **Delegate relays** that dispatch the lanes in `.delegate/config.json` (§5). | Not part of the repository. |

**Skill discovery.** Antigravity and Codex load skills from `.agents/skills/`; Claude Code loads `.claude/skills/`. Whichever copy runs, governance in §2 applies. Where a legacy or generic skill differs from this file, the constitution or the rules, those prevail.

---

## 4. Decision Governance

Agents MUST distinguish between four explicit decision states:

- **Approved** (in [`docs/context/01-decisions.md`](docs/context/01-decisions.md)): Binding requirement. Must be respected by all specs, plans, and code.
- **Proposed**: Candidate recommendation or default starting value. Must **never** silently become an implementation requirement without explicit user approval.
- **Rejected**: Explicitly ruled out. Do not re-propose or implement.
- **Superseded**: Replaced by a newer Approved decision or amendment (e.g., `PD-003 A1`, `PD-005 A1`).

Any change to an **Approved** decision requires explicit user approval and a corresponding update in [`docs/context/01-decisions.md`](docs/context/01-decisions.md). Do not work on tasks whose phase gate is closed or that depend on an unapproved Proposed decision.

- **Open decisions raised by plans** (for example `OD-xx` in a feature's `research.md`) are Proposed until the owner decides them.
  - A recommendation is never a default.
  - Their tasks stay blocked, except where the plan states a fail-closed baseline that applies only until the decision.
- **Fork patches recorded as not authorized** (for example `FP-003` in [`docs/context/07-fork-patches.md`](docs/context/07-fork-patches.md)) must not be implemented, scheduled or treated as solved until both hold:
  - their recorded verification gates have passed;
  - the owner has authorized them separately.

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
  2. Produce a root-cause analysis, proposed correction, and regression test plan (plus an entry plan for [`docs/context/07-fork-patches.md`](docs/context/07-fork-patches.md) if upstream LIP code/behavior is modified). Include the compatibility and evolution analysis of [rule 01](.agents/rules/01-architecture-and-upstream.md) §5.
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
  4. **Slice into Tickets** (`to-tickets`): Break the approved spec into vertical tracer-bullet tickets with blocking edges and agreed test seams under `.scratch/<feature-slug>/issues/<NN>-<slug>.md`. Each ticket meets the Implementation Task Quality Standard ([rule 05](.agents/rules/05-implementation-task-quality.md)).
  5. **GATE 2 — Tickets & Test Seams Approval**: Stop and obtain explicit user approval of the tickets and test seams.
  6. **Implement & Review** (`implement` → `tdd` → `code-review`): Execute the approved tickets test-first at agreed seams, run the two-axis `code-review` (Standards + Spec, including the rule 01 §5 compatibility checklist), and **stop without committing**.
  7. **Verify**: Run all required verification suites and report exact metrics.
- **Optional Workflow for Large / Complex Features (GitHub Spec Kit)**:
  1. **Specify & Clarify** (`/speckit-specify` → `/speckit-clarify`): Author and refine `specs/<NNN-feature>/spec.md`.
  2. **GATE 1 — Specification Approval**: Stop and obtain explicit user approval of `spec.md`.
  3. **Plan, Checklist, Tasks, & Analyze** (`/speckit-plan` → `/speckit-checklist` → `/speckit-tasks` → `/speckit-analyze`): Produce `plan.md`, quality checklists, ordered `tasks.md`, and cross-artifact consistency analysis against [`.specify/memory/constitution.md`](.specify/memory/constitution.md).
     - Every task in `tasks.md` meets the Implementation Task Quality Standard ([rule 05](.agents/rules/05-implementation-task-quality.md)) through the project template override.
     - An owner-requested separate planning gate (recorded in `plan.md`'s Status line) must be approved before `/speckit-tasks` runs.
  4. **GATE 2 — Plan & Tasks Approval**: Stop and obtain explicit user approval of `plan.md` and `tasks.md`.
  5. **Implement & Verify** (`/speckit-implement` + `code-review`): Execute the approved tasks incrementally with tests, run all verification suites, and report exact metrics without committing automatically.

### Approval Boundaries & Short-Prompt Session Protocol

- **Separate approvals.** Approvals are explicit, limited to their stated scope, and never implied. Each of these is a separate owner approval:
  - a gate (spec, plan, tasks or tickets, or an extra gate the owner requests for a feature);
  - authorization to implement;
  - authorization to commit;
  - authorization to push;
  - authorization to deploy.

  None of the following is approval:
  - invoking a skill (for example `/speckit-tasks`), which is only a request to run that step;
  - a reviewer verdict;
  - silence;
  - a failed relay.
- **Gate record.** The **Status** line at the top of each feature artifact (`spec.md`, `plan.md`, `tasks.md`, each ticket) records which owner approvals that artifact has. When the owner approves, the agent updates that line with the date and scope.
- **Running a step from a short prompt** (for example `/speckit-tasks` or `/to-tickets` with no further context):
  1. Governance is loaded (§2).
  2. Resolve the active feature. For Spec Kit, use `.specify/feature.json` → `specs/<NNN-feature>/`. For tickets, use `.scratch/<feature-slug>/`. If it is ambiguous, ask.
  3. Read the Status lines of that feature's artifacts. Run the step only if every preceding gate, including any extra gate the owner requested, is recorded there as approved. Otherwise stop and report the missing approval.
  4. Carry forward the standing restrictions recorded in the artifacts and in §4: open decisions, fork-patch gates, and items not authorized.
  5. Apply the step's quality standard. For any task or ticket generation, that is [rule 05](.agents/rules/05-implementation-task-quality.md).
  6. Classify the risk and apply the review policy below.
  7. Stop at the end of the step and report. Never continue into the next gated step.

### Multi-Agent Review & Disagreement-Based Escalation (owner-approved policy)

This policy adds independent review on top of the tier workflow above. It never replaces, shortens or weakens any Tier 2 / Tier 3 approval gate, the decision-governance rules in §4, or the Git rules in §8.

> **G02 — temporary Claude-led governance (owner-authorized 2026-11-16, `PD-048`).** While Codex Sol is unavailable, the roles below are Claude-led and the separate `final-verdict` gate is retired. Codex Sol must not be invoked, retried or treated as a blocking dependency. G02 is reversible: restoring the G01 text and the pre-G02 `.delegate/config.json` from the recorded backup (`PD-048`) reinstates Sol orchestration, Sol `plan-review` and `final-verdict`, but only on the owner's explicit instruction.

- **Roles.**
  - **Orchestrator and primary architect:** Claude Opus 5.5 High (Claude Code). Prepares proposals, plans and changes, dispatches lanes, and reviews and lands delegated work.
  - **Independent adversarial reviewer:** the `plan-review` delegate lane (Claude Sonnet 5.5 XHigh), in a separate session with enforced read-only permissions. Debate uses evidence and is limited to at most two follow-up rounds.
    - **No self-review, even across sessions.** A reviewer must not approve work that its own model authored, co-authored or produced as a delegate. Route each review by the author→reviewer table:

      | Work authored by | Independent reviewer |
      |---|---|
      | Opus 5.5: the orchestrator, `planning`, `migration-review`, `debate-sol`, `security-review-sol`, `critical-architecture-sol` | `plan-review` (Sonnet 5.5 XHigh) |
      | Sonnet 5.5: `ui`, `review`, `docs-review`, `plan-review`, or a Sonnet fallback | `migration-review` (Opus 5.5 High), in a fresh read-only session that is not the orchestrator's session |
      | `agy` lanes (Hydrogen, Flash) with no Claude-authored change | `plan-review` (Sonnet 5.5 XHigh) |
      | Any combination of authors (for example, the orchestrator fixes a Sonnet lane's output, or a Claude model edits `agy` output) | Split the review by change set and route each part by the rows above. If the parts cannot be separated, the work stays **blocked** for the owner. |

      A re-review after fixes follows the same table for the fixed content. An Opus lane never reviews Opus-authored work, and a Sonnet lane never reviews Sonnet-authored work.
    - **Read-only evidence.** On native Windows, the Claude relay's read-only mode is a tool restriction plus a Git tripwire, not OS isolation. The recorded isolation evidence is in `PD-048`. A review counts as **no review** if any of the following holds:
      - its init event lists any write-capable tool;
      - `readOnlyViolation` is not `false`;
      - its init-event model differs from its lane's model;
      - its `result.json` model or effort differs from its lane's.

      Effective effort inside a relay run is not captured directly. It is inferred from the CLI flags, whose non-downgrade for Sonnet 5.5 `xhigh` is recorded in `PD-048`.
  - **Implementers:** the implementer lanes. Each task's executor class (rule 05 §3) decides whether a lower-cost lane may take it.
  - **Model routing:** `.delegate/config.json` owns the approved fleet: 20 active lanes, with `final-verdict` retired under G02. No active lane routes to Codex. Fable has no prospective execution, review or publication role. Argon must never be used without explicit owner approval.
    - **Historical approval record:** when this policy was adopted, the owner approved `plan-review` = Codex Sol 6.1 High and `final-verdict` = Fable 5.1 High. G01 supersedes that prospective routing only; historical reviews and their findings, conditions and approval scopes remain intact. Future routing changes still need owner approval.
    - **G02 record:** G02 (`PD-048`, 2026-11-16) in turn supersedes the G01 prospective routing (orchestrator, `plan-review` and `final-verdict` on GPT-6.1 Sol High) only. Historical reviews, including the G01 Sol reviews and their findings, conditions and approval scopes, remain intact.
    - If the configuration or a lane is missing, that review cannot run and counts as no review.
    - The Hydrogen XHigh `security-review` and `critical-architecture-hydrogen` lanes remain blocked until their isolation requirements are satisfied with recorded evidence of enforced read-only access. A `readOnly` configuration flag or prompt alone is not proof. Do not reassign a blocked lane or treat a Claude review as completion of a required Hydrogen review.
- **Risk classification.** Classify every task by its **potential impact**, never by its title or apparent code size:
  - **CRITICAL:** could cause cross-tenant data exposure, loss or corruption of balances, ledger or money, a security breach, or irreversible production data damage.
  - **HIGH:** changes or can affect a security, accounting, data-integrity or cross-tenant invariant; authentication or authorization; loyalty-engine, billing or ledger behaviour; database schema or migrations; API contracts; architectural decisions; or the plan or spec that governs any of these.
  - **MEDIUM:** behavioural change that is contained and touches none of the HIGH areas.
  - **LOW:** no behavioural effect (for example, wording or formatting).
  - When uncertain between MEDIUM and HIGH, classify as **HIGH**. State the classification and its reason before reviews start.
  - Risk level sets the review and evidence requirements below.
- **Independent review.** The independent read-only review (`plan-review`, or the cross-model review defined under *Roles*) is mandatory for HIGH and CRITICAL work and optional for LOW and MEDIUM. Every implementation review, by any reviewer, checks the rule 01 §5 compatibility evidence.
- **Resolution requires evidence.**
  - The orchestrator and the independent reviewer resolve findings with evidence (file and line references, sources, executed results), within at most two follow-up rounds.
  - A HIGH or CRITICAL finding is resolved only by verifiable evidence and, where applicable, passing tests. Agreement between the agents alone never resolves it.
  - If evidence is insufficient or mandatory verification fails, the task stays **blocked**. Neither agreement nor a review verdict substitutes for verification.
- **Unresolved disagreement and publication (G02).**
  - **Unresolved disagreement:** if a material technical disagreement between the orchestrator and the independent reviewer remains after the two follow-up rounds, the task stays **blocked** and is escalated to the owner with both positions and their evidence. No agent adjudicates it.
  - **Before publishing:** there is no separate publication review. A push still needs the owner's explicit push authorization (§8), and every HIGH or CRITICAL change in the pushed commits must already carry a passing independent review under this section. That review must cover the final content being pushed; any later edit to reviewed material needs re-review.
  - The owner may request an additional independent review at any time.
- **Limits of any review verdict.**
  - A review verdict cannot override an explicit owner-approved business rule or Approved decision, and cannot change an approved requirement.
  - A verdict never authorizes implementation, a commit or a push. Those still need the owner's explicit approval (§5, §8).
  - Any new product decision needs owner approval (§4). A reviewer may only recommend one.
  - A review that did not actually run, failed, or ran without read-only enforcement counts as **no review**. Silence or a failed relay is never approval.

---

## 6. Golden Engineering, Domain, & Security Invariants

The full, binding text of these invariants lives in the always-on rules (and constitution Articles II, IV–VIII and XI). This index only names them so no agent misses one:

| Invariant | Rule |
|---|---|
| Upstream `/lip/v1` and `spec/` never broken; fork patches logged; product features in our own layer | [rule 01](.agents/rules/01-architecture-and-upstream.md) §3 |
| Strict TypeScript; `FP-001` migration locking; session-mode PostgreSQL connections only | [rule 01](.agents/rules/01-architecture-and-upstream.md) §4 |
| Tenant isolation by PostgreSQL RLS; no client-trusted tenant IDs; merchant keys never on clients | [rule 02](.agents/rules/02-security-and-tenant-isolation.md) §1 |
| Integer minor-unit money; no universal `Math.floor()` rounding | [rule 02](.agents/rules/02-security-and-tenant-isolation.md) §2 |
| Egyptian E.164 mobile normalization | [rule 02](.agents/rules/02-security-and-tenant-isolation.md) §3 |
| PDPL engineering controls; no unproven legal claims | [rule 02](.agents/rules/02-security-and-tenant-isolation.md) §4 |
| OTP, session and webhook security | [rule 02](.agents/rules/02-security-and-tenant-isolation.md) §5 |
| Idempotency keys, stable business IDs, immutable ledger | [rule 02](.agents/rules/02-security-and-tenant-isolation.md) §6 |
| Manual billing at launch; no Stripe paths | [rule 02](.agents/rules/02-security-and-tenant-isolation.md) §7 |
| Honest verification and test discipline | [rule 03](.agents/rules/03-testing-and-verification.md) |
| Implementation Task Quality Standard | [rule 05](.agents/rules/05-implementation-task-quality.md) |
| Scalable, extensible, maintainable, backward-compatible change: impact inventory, stable interfaces, no speculative abstraction, breaking changes only with owner approval and a migration plan, safe data evolution, regression and contract tests, performance and operations, rollback; stop on an unmitigated break | [rule 01](.agents/rules/01-architecture-and-upstream.md) §5; [rule 05](.agents/rules/05-implementation-task-quality.md) field 13; constitution Article XI |

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
Follow [rule 03](.agents/rules/03-testing-and-verification.md). In particular, **never claim the full test suite passed unless it was actually executed**, and report exact passed, failed and skipped counts with the execution environment.

---

## 8. Git & Deployment Restrictions

- **Remotes**: `origin` (`https://github.com/muhammedemara024-ops/LIP.git`); `upstream` (`https://github.com/craveup-oss/loyalty-interchange-protocol.git`, fetch-only, `pushurl = DISABLED`).
- **Direct delivery to `main` (`PD-050`, owner-authorized 2026-11-16).** Normal commits and fast-forward pushes to `main` are authorized for completed, reviewed, authorized tasks, and no PR is opened for routine Phase delivery. Before each push, all of these must hold: task authorization and closed gates; relevant tests and the standard verification (rule 03); an independent review that passes and covers the exact content pushed (§5); a green `verify` on that exact SHA on `deliver/<slug>` (GitHub accepts a push to `main` only after its required check passed on another ref); the branch contains the latest `origin/main`. The `main` ruleset still prohibits force pushes and deletion, still requires `verify`, and has no bypass actor. This changes no approval gate and authorizes no deployment, secrets change or unauthorized task.
- **Strict Rules**:
  - Never push to `upstream`.
  - Never force-push `main`.
  - Never commit secrets, `.env` files, credentials, or runtime state (`.lip/`).
  - Never commit or push without explicit user authorization (`PD-050` is the standing authorization described above and nothing wider).
  - Never deploy or modify production data without explicit user authorization.
  - Always preserve unrelated working-tree changes.

---

## Agent skills

- For domain modeling, glossary lookups, and decision records, see [`docs/agents/domain.md`](docs/agents/domain.md).
- For specs, tickets, and issue tracker operations, see [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md).
