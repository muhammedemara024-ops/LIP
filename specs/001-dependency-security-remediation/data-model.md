# Data Model: Dependency Security Remediation (Task 0.12)

**Feature**: `001-dependency-security-remediation` | **Date**: 2026-11-09

## Overview

This task introduces no new application data entities, database tables, or business state transitions. The "data model" represents the structured dependency graphs across the four operational tiers and the relationships between workspace manifests, root overrides, and lockfiles.

---

## Entity 1: Core SaaS Production Runtime Graph

Deployable Pilot services (per `render.yaml`): `apps/cloud` (`dockerCommand` in all 3 Render services). The Dockerfile default CMD is `packages/server` (standalone reference mode). Wallet (`apps/wallet`) is present in `compose.yaml` for local development but is **not deployed to Render for the pilot** and is excluded from the Core SaaS Pilot gate.

```
apps/cloud ──→ @loyalty-interchange/server ──→ @loyalty-interchange/protocol ──→ ajv@8.20.0 ──→ fast-uri@3.1.5 ❌
           ──→ @loyalty-interchange/storage-postgres ──→ pg@8.22.0 ✅
           ──→ @loyalty-interchange/identity ──→ jose@6.2.3 ✅
           ──→ @loyalty-interchange/sdk ✅
           ──→ @loyalty-interchange/reference ──→ @loyalty-interchange/protocol (same ajv path)
           ──→ pg@8.22.0 ✅
           ──→ stripe@22.3.2 ✅

packages/server ──→ @loyalty-interchange/storage-sqlite ──→ better-sqlite3@12.11.1 ✅

apps/wallet ──→ jose@6.2.3 ✅  (NOT deployed for pilot; zero vulnerabilities)
```

- **Vulnerabilities in runtime graph**: Exactly **1** (`fast-uri@3.1.5` via `ajv@8.20.0`).
- **Absence of MCP**: `@loyalty-interchange/mcp` is completely absent from this tree.
- **Wallet Pilot Scope**: `apps/wallet` has zero vulnerabilities (`jose@6.2.3`) but is not deployed to Render for the pilot. Excluded from the Core SaaS Pilot gate.
- **Remediation**: Root override `"fast-uri": "^3.1.9"` in `package.json`.
- **Independent Core SaaS Pilot Audit Command**:
  ```bash
  npm ls --omit=dev --workspace=@loyalty-interchange/server --workspace=@loyalty-interchange/cloud --all
  ```

---

## Entity 2: MCP Developer Tooling Graph

Local developer auxiliary tool: `packages/mcp` (`lip-mcp` CLI, stdio transport only).

```
packages/mcp ──→ @modelcontextprotocol/sdk@1.29.0 ❌ ──→ express@5.2.1 ──→ proxy-addr@2.0.7 ❌
                                                                        ──→ body-parser@2.3.0 ❌ ──→ qs@6.15.3 ❌
                                                    ──→ hono@4.13.2 ❌
                                                    ──→ @hono/node-server@1.19.17 ❌
                                                    ──→ express-rate-limit ──→ ip-address@10.5.0 ❌
             ──→ zod@3.25.76 ❌
             ──→ @loyalty-interchange/protocol ──→ ajv ──→ fast-uri (shared)
             ──→ yaml@2.9.0 ✅
```

- **Vulnerabilities**: 8 (1 Critical, 3 High, 4 Moderate).
- **Runtime Execution**: Stdio transport only; Express/Hono transports are dormant.
- **Remediation**:
  - Direct upgrades in `packages/mcp/package.json`: `@modelcontextprotocol/sdk@^1.32.2`, `zod@^4.6.7`.
  - Root overrides in `package.json`: `"proxy-addr": "^2.0.8"`, `"body-parser": "^2.4.0"`, `"qs": "^6.17.1"`, `"ip-address": "^10.7.6"`.

---

## Entity 3: Development / Build Tooling Graph

Developer workstation and CI pipeline tooling:

```
root devDeps ──→ vitest@4.1.10 ❌ ──→ @vitest/mocker ❌
             ──→ @vitest/coverage-v8@4.1.10 ──→ source-map-js@1.2.1 ❌
             ──→ @apidevtools/swagger-parser@12.1.0 ──→ js-yaml@4.3.1 ❌

apps/admin devDeps ──→ vite@8.1.4 ❌
                   ──→ @vitejs/plugin-react@5.2.0 ──→ browserslist@4.28.6 ❌ ──→ baseline-browser-mapping ❌
                   ──→ @tailwindcss/typography@0.5.20 ──→ postcss-selector-parser ❌
```

- **Vulnerabilities**: 10 (4 High, 6 Moderate).
- **Remediation**: Direct devDependency upgrades (`vite@^8.3.6`, `vitest@^4.1.12`, `@vitest/coverage-v8@^4.1.12`) with parent bumps and fallback root overrides for transitive findings.

---

## Multi-Tier Manifest Structure

```
                    ┌────────────────────────────────────────────────────────┐
                    │                   Root package.json                    │
                    │   ┌─ overrides ─────────────────────────────────────┐  │
                    │   │ fast-uri: ^3.1.9       (Core SaaS Pilot Blocker)│  │
                    │   │ proxy-addr: ^2.0.8     (MCP Tooling Gate)       │  │
                    │   │ body-parser: ^2.4.0    (MCP Tooling Gate)       │  │
                    │   │ qs: ^6.17.1            (MCP Tooling Gate)       │  │
                    │   │ ip-address: ^10.7.6    (MCP Tooling Gate)       │  │
                    │   │ [dev fallbacks if parent bumps fail]            │  │
                    │   └─────────────────────────────────────────────────┘  │
                    │   devDependencies:                                     │
                    │     vitest: ^4.1.12                                    │
                    │     @vitest/coverage-v8: ^4.1.12                       │
                    └────────────────────────────────────────────────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                  ▼
    packages/mcp        apps/admin         packages/protocol
    package.json        package.json       package.json
    ┌──────────┐        ┌──────────┐       ┌──────────┐
    │ sdk:^1.32.2│      │ vite:^8.3.6│     │ (unchanged)│
    │ zod:^4.6.7 │      │ [parent   │      │ ajv:^8.20.0│
    └──────────┘        │  bumps]   │      └──────────┘
                        └──────────┘
```

---

## Validation & Invariant Rules

1. **Override Semver Compatibility**: Every override version must satisfy the declaring package's semver range (e.g., `fast-uri@^3.1.9` satisfies `ajv`'s `"fast-uri": "^3.0.1"`).
2. **Zero Protocol Schema Drift**: `npm run spec:check` must exit 0 after `fast-uri` override, proving TypeBox schemas and OpenAPI outputs are unaffected.
3. **Zero Type Regression**: `npm run typecheck` must pass across all monorepo workspaces and `apps/admin`.
4. **Zero Audit Findings**: Both `npm audit` and `npm audit --omit=dev` must report 0 vulnerabilities monorepo-wide.
5. **Core SaaS Runtime Tree Composition**: `npm ls --omit=dev --workspace=@loyalty-interchange/server --workspace=@loyalty-interchange/cloud --all` must confirm: (a) `fast-uri` resolves to version `≥ 3.1.9` within the tree, and (b) no `@loyalty-interchange/mcp` or MCP transitive packages appear in the tree. This is a tree-composition check only — zero-vulnerability proof is provided by `npm audit` and `npm audit --omit=dev` (Rule 4).
6. **Cross-Platform Lockfile Determinism**: `package-lock.json` generated on Windows under Node 22.22.0 must install cleanly via `npm ci` on Linux Docker.
7. **Zero Skipped Tests**: `numPendingTests === 0` in Linux + PostgreSQL 17 test execution.
