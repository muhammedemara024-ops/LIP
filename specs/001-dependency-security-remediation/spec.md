# Feature Specification: Dependency Security Remediation (Task 0.12)

**Feature Branch**: `001-dependency-security-remediation`  
**Created**: 2026-11-09  
**Status**: Revised Draft — Gate 1 Clarifications Integrated (Awaiting Gate 1 User Approval)  
**Input**: User description: "Remediate production and development dependency vulnerabilities for Task 0.12, distinguishing Core SaaS production exposure from auxiliary MCP tooling and dev dependencies."  

---

## Clarifications

### Session 2026-11-09
- Q: Should modifying dependency versions in upstream packages (specifically `packages/mcp/package.json` for Zod 4 and MCP SDK 1.32.2) be recorded as a formal fork patch (`FP-002`) in `docs/context/07-fork-patches.md`? → A: Option A: Yes, log an entry `FP-002: Dependency Security Remediation (Task 0.12)` in `docs/context/07-fork-patches.md` to track `packages/mcp` manifest changes and root overrides against upstream `0.2.0`.
- Q: Should transitive development-tooling vulnerabilities (`js-yaml`, `source-map-js`, `browserslist`, and `postcss-selector-parser`) also be resolved via root `package.json` `overrides` alongside the production overrides? → A: Option C: Attempt parent bump first, fallback to overrides: Test whether upgrading `@apidevtools/swagger-parser`, `@vitejs/plugin-react`, and related parent devDependencies resolves them; apply root `overrides` only if parent bumps fail.
- Q: For lockfile generation and dependency resolution during implementation, should `package-lock.json` updates be executed directly on the Windows host using `nvm use 22.22.0` or inside the Linux Docker container (`node:22.22.0`)? → A: Option C: Hybrid (Windows Host + Docker Linux Verification): Run updates locally via `nvm use 22.22.0` on Windows, followed by mandatory `npm ci` clean install and test verification inside the Linux container.

---

## 1. Problem Statement, Security Objectives, & Exposure Classification

### 1.1 Problem Statement
A comprehensive security scan of the Loyalty Interchange Protocol (`LIP`) monorepo identifies **19 active vulnerabilities** (1 critical, 8 high, 10 moderate). In initial scans, 9 of these were reported under `npm audit --omit=dev`. However, evaluating vulnerability risk purely by an aggregate monorepo `npm audit` count fails to reflect the actual runtime boundaries and attack surfaces of the system.

Per Roadmap Task `0.12` and Task `5.6` (Pilot Readiness), dependency remediation and documented risk acceptance are mandatory gates before pilot cafés in Egypt go live. To establish sound security engineering, the vulnerability inventory must be analyzed against the actual deployable runtime artifacts and their supported execution paths.

### 1.2 Multi-Layered Threat & Exposure Classification

The monorepo dependency graph spans four distinct operational and deployment tiers:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       1. MONOREPO INSTALLATION GRAPH                        │
│   (All 19 advisories across packages/*, apps/*, root devDependencies)       │
├──────────────────────────────────────┬──────────────────────────────────────┤
│ 2. CORE SAAS PRODUCTION ARTIFACT     │ 3. MCP DEVELOPER TOOL                │
│    (apps/cloud, packages/server,     │    (packages/mcp)                    │
│     packages/protocol, storage-pg)   │    - Marked "Reference Only" (PD-002)│
│    - Deployed in Render/Docker       │    - StdioServerTransport ONLY       │
│    - Handles EGP money, members, RLS │    - Zero HTTP listeners in code     │
│    - EXPOSURE: 1 High (fast-uri)     │    - EXPOSURE: 1 Crit, 3 High, 4 Mod │
├──────────────────────────────────────┴──────────────────────────────────────┤
│ 4. DEVELOPMENT / BUILD / TEST TOOLCHAIN                                     │
│    (apps/admin devDeps, root devDeps: vite, vitest, js-yaml, source-map-js) │
│    - Executed only during local development, CI checks, or static builds    │
│    - EXPOSURE: 4 High, 6 Moderate                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

1. **Monorepo Installation Exposure (`npm audit` scope)**:
   - Evaluates all `dependencies` declared across every workspace in the monorepo.
   - Aggregate count: **9 production-tier vulnerabilities** (1 critical, 4 high, 4 moderate) and **10 development-tier vulnerabilities** (4 high, 6 moderate).
2. **Core SaaS Production Artifact Exposure (`apps/cloud`, `packages/server`, `packages/protocol`, `packages/storage-postgres`, `packages/identity`)**:
   - The deployable runtime services defined in `render.yaml` (`node apps/cloud/dist/cli.js`) and `compose.yaml` (`node packages/server/dist/cli.js`, `node apps/cloud/dist/cli.js`).
   - Responsible for multi-tenant café loyalty ledgers, customer sessions, EGP integer piasters, and PostgreSQL Row-Level Security (`lip.tenant_id`).
   - **Crucial Architectural Reality**: Only **1 vulnerability** exists in this deployable runtime tree: **`fast-uri`** (High, transitive via `ajv@8.20.0` in `@loyalty-interchange/protocol`). All other 8 "production" vulnerabilities do not exist in the Core SaaS runtime.
3. **MCP Developer Tool Exposure (`packages/mcp`)**:
   - Contains 8 vulnerabilities: `proxy-addr` (Critical), `@modelcontextprotocol/sdk` (High), `body-parser` (High), `zod` (High), `@hono/node-server` (Moderate), `hono` (Moderate), `ip-address` (Moderate), `qs` (Moderate).
   - **Runtime Model**: `packages/mcp` is an auxiliary Model Context Protocol server (`lip-mcp` CLI) intended for AI agent pair programming.
   - Per `PD-002`, `packages/mcp` is explicitly classified as **"Reference only (not shipped in core SaaS)"**.
   - **Execution Seam**: Evaluated code in `packages/mcp/src/server.ts` connects exclusively via `StdioServerTransport` over standard input/output. It does **not** expose any HTTP listener or bind to any TCP port.
   - **Exposure Mechanism**: The Express and Hono dependencies are pulled transitively by `@modelcontextprotocol/sdk@1.29.0` for its optional HTTP server transports (SSE/streaming), which LIP never invokes.
   - **Threat Context**: While dormant in stdio mode, vulnerabilities in `@modelcontextprotocol/sdk` and `zod` could theoretically be triggered if a local developer runs `lip-mcp` against untrusted inputs. They must not be labeled "zero threat", but must be classified as developer-tool exposure rather than Core SaaS production exposure.
4. **Development / Build / Test Tooling Exposure (Root & `apps/admin` devDependencies)**:
   - Contains 10 vulnerabilities: `browserslist` (High), `js-yaml` (High), `source-map-js` (High), `vite` (High), `baseline-browser-mapping` (Moderate), `postcss-selector-parser` (Moderate), `vitest` / `@vitest/coverage-v8` / `@vitest/mocker` (Moderate).
   - Executed strictly during developer test runs (`vitest`), documentation checks, and Admin UI asset builds (`vite build`).

### 1.3 Security Objectives
1. **Core SaaS Hardening (Pilot Blocker)**: Remediate `fast-uri` to version `3.1.9` in the core protocol stack without compromising Ajv JSON Schema compilation or `/lip/v1` wire semantics.
2. **MCP Tooling Hardening (Tooling Gate)**: Update `packages/mcp` to `@modelcontextprotocol/sdk@^1.32.2` and migrate to `zod@^4.6.7`, resolving transitive Express/Hono vulnerabilities via targeted root overrides before distributing or using MCP in untrusted environments.
3. **Toolchain Hardening**: Upgrade development tooling (`vite@^8.3.6`, `vitest@^4.1.12`, `js-yaml@^4.3.2`, `source-map-js@^1.2.2`, `postcss-selector-parser@^6.1.6`) to protect local developer machines and CI pipelines.
4. **Deterministic Toolchain Reproducibility**: Enforce lockfile generation and verification under the repository's pinned environment: Node.js `22.22.0` and npm `10.9.4`.

---

## 2. Comprehensive Vulnerability Evidence Matrix

The following evidence table maps every reported CVE/GHSA advisory to its affected version, patched version, dependency path, operational exposure tier, and LIP usage:

| Advisory ID & CVE | Package & Severity | Affected Range | Patched Version | Exact Dependency Path | Operational Exposure Tier | Feature Used in LIP? |
|---|---|---|---|---|---|---|
| **`GHSA-jqcg-44mw-7w3h`** (CVE-2024-52798) | `proxy-addr`<br>**Critical** (9.1) | `>= 1.1.0, <= 2.0.7` | `2.0.8` | `@loyalty-interchange/mcp` &rarr; SDK &rarr; `express@5.2.1` &rarr; `proxy-addr@2.0.7` | **MCP Developer Tool** (Auxiliary) | **NO**. Express is never booted. |
| **`GHSA-6qxp-vccf-f47h`** | `@modelcontextprotocol/sdk`<br>**High** (8.8) | `< 1.30.0` | `1.30.0` (use `1.32.2`) | `packages/mcp/package.json` | **MCP Developer Tool** (Direct) | **NO**. No MCP OAuth client. |
| **`GHSA-22jm-h49p-29qw`** | `@modelcontextprotocol/sdk`<br>**High** (7.5) | `< 1.30.1` | `1.30.1` (use `1.32.2`) | `packages/mcp/package.json` | **MCP Developer Tool** (Direct) | **NO**. No experimental task APIs. |
| **`GHSA-46jr-4wx8-v453`** | `@modelcontextprotocol/sdk`<br>**High** (7.5) | `< 1.31.0` | `1.31.0` (use `1.32.2`) | `packages/mcp/package.json` | **MCP Developer Tool** (Direct) | **NO**. No HTTP server transport. |
| **`GHSA-f897-62hf-6gxq`** | `@modelcontextprotocol/sdk`<br>**High** (7.5) | `< 1.31.0` | `1.31.0` (use `1.32.2`) | `packages/mcp/package.json` | **MCP Developer Tool** (Direct) | **NO**. No HTTP request body handling. |
| **`GHSA-rvq5-wwqv-78pq`** | `@modelcontextprotocol/sdk`<br>**Moderate** | `< 1.30.0` | `1.30.0` (use `1.32.2`) | `packages/mcp/package.json` | **MCP Developer Tool** (Direct) | **NO**. No HTTP bearer auth. |
| **`GHSA-6prh-2h8m-c8cw`** | `@modelcontextprotocol/sdk`<br>**Moderate** | `< 1.30.1` | `1.30.1` (use `1.32.2`) | `packages/mcp/package.json` | **MCP Developer Tool** (Direct) | **NO**. LIP MCP does not make HTTP requests. |
| **`GHSA-27r3-jxmh-p828`** | `body-parser`<br>**High** (7.5) | `>= 2.0.0, <= 2.3.0` | `2.4.0` | `@loyalty-interchange/mcp` &rarr; SDK &rarr; `express@5.2.1` &rarr; `body-parser@2.3.0` | **MCP Developer Tool** (Auxiliary) | **NO**. Express request body parsing is not invoked. |
| **`fast-uri` (10 advisories)** | `fast-uri`<br>**High** (7.5) | See Section 3.1 | `3.1.9` | Root, `@loyalty-interchange/protocol`, `@loyalty-interchange/mcp` &rarr; `ajv@8.20.0` &rarr; `fast-uri@3.1.5` | **CORE SAAS PRODUCTION** (Transitive via Ajv) | **YES**. Ajv formats & URI validation in protocol schemas. |
| **`GHSA-mrhx-c7xc-m3w5`** (CVE-2025-32440) | `zod`<br>**High** (7.5) | `< 4.6.6` | `4.6.6` (use `4.6.7`) | `packages/mcp/package.json` (`^3.25.76`) &rarr; `zod@3.25.76` | **MCP Developer Tool** (Direct in `packages/mcp`) | **YES** in `packages/mcp/src/server.ts` for tool input schemas (`z.object`, `z.string`, `z.enum`). |
| **`GHSA-rmxm-3fg6-px4f`** | `@hono/node-server`<br>**Moderate** | `>= 1.19.10, <= 2.1.2` | `2.1.6` (or `1.19.18`) | `@loyalty-interchange/mcp` &rarr; SDK &rarr; `@hono/node-server@1.19.17` | **MCP Developer Tool** (Auxiliary) | **NO**. Hono server is never started. |
| **`GHSA-gqvv-2mrq-wpjv`** (+4 advisories) | `hono`<br>**Moderate** | `<= 4.13.10` | `4.13.17` | `@loyalty-interchange/mcp` &rarr; SDK &rarr; `hono@4.13.2` | **MCP Developer Tool** (Auxiliary) | **NO**. Hono is never started. |
| **`GHSA-rpw4-54j3-4h4q`** (+4 advisories) | `ip-address`<br>**Moderate** | `<= 10.7.3` | `10.7.6` | `@loyalty-interchange/mcp` &rarr; SDK &rarr; `express-rate-limit` &rarr; `ip-address@10.5.0` | **MCP Developer Tool** (Auxiliary) | **NO**. IP rate limiting is not used over stdio. |
| **`GHSA-x5fp-wj9c-mxmx`** (+2 advisories) | `qs`<br>**Moderate** | `>= 2.2.5, <= 6.16.0` | `6.17.1` | `@loyalty-interchange/mcp` &rarr; SDK &rarr; `express` / `body-parser` &rarr; `qs@6.15.3` | **MCP Developer Tool** (Auxiliary) | **NO**. Query string parsing is not used over stdio. |
| **`GHSA-c83g-rgw3-j3cx`**, `73wf` | `browserslist`<br>**High** | `<= 4.28.6` | `4.29.5` | `apps/admin` &rarr; `@vitejs/plugin-react` &rarr; `browserslist@4.28.6` | **Development Tooling** | Browser target compilation. |
| **`GHSA-2883-xcg3-v3hh`** | `js-yaml`<br>**High** | `>= 4.0.0, <= 4.3.1` | `4.3.2` | Root &rarr; `@apidevtools/swagger-parser` &rarr; `js-yaml@4.3.1` | **Development Tooling** | OpenAPI validation in spec scripts. |
| **`GHSA-68fv-2mgg-jv7q`** | `source-map-js`<br>**High** | `>= 1.0.0, <= 1.2.1` | `1.2.2` | Root &rarr; `@vitest/coverage-v8`, `apps/admin` &rarr; `vite` | **Development Tooling** | Source map translation during test coverage. |
| **`GHSA-698v-4r3x-3vcv`** (+4 advisories) | `vite`<br>**High** | `>= 8.0.0, <= 8.1.5` | `8.3.6` | `apps/admin` devDependencies, root `vitest` | **Development Tooling** | Admin UI dev server & Vitest runner. |
| **`GHSA-w5vr-8v7q-w6rv`** | `baseline-browser-mapping`<br>**Moderate** | `>= 2.0.0, < 2.11.0` | `2.11.35` | `apps/admin` &rarr; `browserslist` &rarr; `baseline-browser-mapping` | **Development Tooling** | Browser feature mapping data. |
| **`GHSA-rj75-hqrm-r3gf`** | `postcss-selector-parser`<br>**Moderate** | `< 6.1.5` | `6.1.6` | `apps/admin` &rarr; `@tailwindcss/typography@0.5.20` | **Development Tooling** | CSS typography selector parsing. |
| **`GHSA-82fw-gwwq-j7x9`**, `qxg6` | `vitest` / `@vitest/mocker`<br>**Moderate** | `<= 4.1.11` | `4.1.12` | Root devDependencies | **Development Tooling** | Test runner mock isolation. |

---

## 3. Deep Technical Analysis of High-Risk Remediation Paths

### 3.1 `fast-uri` Detailed Advisory Evidence (Core SaaS Production Seam)

The following table provides the exhaustive advisory evidence for each of the 10 reported `fast-uri` advisories:

| Advisory ID | Title & Vulnerability | Affected Range | Patched Version | Resolved by 3.1.9? | Evidence URL |
|---|---|---|---|---|---|
| **`GHSA-5jgf-p345-68v8`** | Host confusion via skipped IDN canonicalization on scheme-relative references | `>= 3.1.3, < 3.1.6` | **`3.1.6`** | **YES** (fixed in 3.1.6, included in 3.1.9) | [GHSA-5jgf-p345-68v8](https://github.com/advisories/GHSA-5jgf-p345-68v8) |
| **`GHSA-f65p-4m7j-42xc`** | Server-side request forgery via malformed IPv6 normalization | `>= 3.0.0, < 3.1.6` | **`3.1.6`** | **YES** (fixed in 3.1.6, included in 3.1.9) | [GHSA-f65p-4m7j-42xc](https://github.com/advisories/GHSA-f65p-4m7j-42xc) |
| **`GHSA-fph4-wmhf-6fwf`** | Server-side request forgery via repeated hostname percent-decoding | `>= 3.1.2, < 3.1.6` | **`3.1.6`** | **YES** (fixed in 3.1.6, included in 3.1.9) | [GHSA-fph4-wmhf-6fwf](https://github.com/advisories/GHSA-fph4-wmhf-6fwf) |
| **`GHSA-jqff-g426-hqxp`** | Host confusion via percent-encoded scheme normalization | `>= 3.0.0, < 3.1.6` | **`3.1.6`** | **YES** (fixed in 3.1.6, included in 3.1.9) | [GHSA-jqff-g426-hqxp](https://github.com/advisories/GHSA-jqff-g426-hqxp) |
| **`GHSA-qw65-cvwx-89v3`** | Authority injection via an unvalidated port in serialize | `>= 3.0.0, < 3.1.7` | **`3.1.7`** | **YES** (fixed in 3.1.7, included in 3.1.9) | [GHSA-qw65-cvwx-89v3](https://github.com/advisories/GHSA-qw65-cvwx-89v3) |
| **`GHSA-hrr3-gc8f-f4qj`** | Inconsistent host case normalization via percent-encoded octets | `>= 3.0.0, < 3.1.8` | **`3.1.8`** | **YES** (fixed in 3.1.8, included in 3.1.9) | [GHSA-hrr3-gc8f-f4qj](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj) |
| **`GHSA-w74x-v6f9-j3xg`** | URI scheme spoofing via percent-encoded scheme decoding | `>= 3.0.0, < 3.1.9` | **`3.1.9`** | **YES** (fixed in 3.1.9) | [GHSA-w74x-v6f9-j3xg](https://github.com/advisories/GHSA-w74x-v6f9-j3xg) |
| **`GHSA-xhq7-xmqj-769h`** | Improper path equivalence in relative reference normalization | `>= 3.0.0, < 3.1.9` | **`3.1.9`** | **YES** (fixed in 3.1.9) | [GHSA-xhq7-xmqj-769h](https://github.com/advisories/GHSA-xhq7-xmqj-769h) |
| **`GHSA-wjr9-j795-jxcr`** | Host confusion via unchecked WHATWG host canonicalization | `>= 3.1.3, < 3.1.9` | **`3.1.9`** | **YES** (fixed in 3.1.9) | [GHSA-wjr9-j795-jxcr](https://github.com/advisories/GHSA-wjr9-j795-jxcr) |
| **`GHSA-333x-w4r6-6crp`** | Scheme injection via an unescaped first-segment colon in suffix references | `>= 3.0.0, < 3.1.9` | **`3.1.9`** | **YES** (fixed in 3.1.9) | [GHSA-333x-w4r6-6crp](https://github.com/advisories/GHSA-333x-w4r6-6crp) |

#### Analysis & Compatibility Rationale:
- **Cumulative Remediation**: Notice that individual advisories were addressed incrementally across patch releases (`3.1.6`, `3.1.7`, `3.1.8`, and `3.1.9`). Version `3.1.9` is the earliest version that resolves **all 10 advisories cumulatively**.
- **Ajv Compatibility Rationale**:
  - `ajv@8.20.0` declares dependency: `"fast-uri": "^3.0.1"`.
  - Upgrading via root override `"fast-uri": "^3.1.9"` satisfies Ajv's semver contract natively within the 3.x major version.
  - In contrast, upgrading to `fast-uri@4.x` represents a breaking major change that has not been certified with `ajv@8.20.0`. Overriding to `4.x` risks breaking schema validation in `@loyalty-interchange/protocol`.
  - Overriding to `^3.1.9` delivers 100% vulnerability remediation while ensuring zero breaking changes to Ajv or protocol validation.
- **Required Regression Test Seams**:
  1. `packages/protocol/src/validation.test.ts`: Verify JSON Schema compilation, URI format validation, and `$ref` resolution.
  2. `npm run spec:check`: Re-run schema generation and verify zero diff against `spec/schemas/*.json` and `spec/openapi.yaml`.
  3. `tests/unit/protocol.test.ts`: Validate complex `FoodserviceOrder` instances with multi-tender currencies and line item discounts.

---

### 3.2 Zod 4 Migration (MCP Developer Tool Seam)
- **Advisory Details**: `GHSA-mrhx-c7xc-m3w5` (CVE-2025-32440, CVSS 7.5). ReDoS / memory exhaustion during validation of oversized constrained collections. Fixed only in `zod >= 4.6.6`.
- **Code Inspection of `packages/mcp`**:
  An exhaustive audit of the monorepo proves that Zod is **only** imported in one file: `packages/mcp/src/server.ts` (`import { z } from "zod"`). It is NOT used in `@loyalty-interchange/protocol`, `@loyalty-interchange/server`, `@loyalty-interchange/reference`, or `@loyalty-interchange/storage-postgres` (which rely exclusively on TypeBox and Ajv).
  Within `packages/mcp/src/server.ts`, Zod is used strictly for 4 simple parameter schemas:
  - `lip_index`: `z.object({})`
  - `lip_read_doc`: `z.object({ path: z.string().describe(...) })`
  - `lip_validate_json`: `z.object({ schema: z.string().describe(...), json: z.string().describe(...) })`
  - `lip_sdk_snippet`: `z.object({ operation: z.enum([...]) })`
- **Compatibility Analysis**:
  1. **`zod-to-json-schema`**: The installed version `3.25.2` declares peer dependency `"zod": "^3.25.28 || ^4"`. It explicitly supports Zod 4.
  2. **`@modelcontextprotocol/sdk`**: Version `1.32.2` declares:
     ```json
     "dependencies": { "zod": "^3.25 || ^4.0", "zod-to-json-schema": "^3.25.1" },
     "peerDependencies": { "zod": "^3.25 || ^4.0" }
     ```
     The MCP SDK has native first-class support for Zod 4.
- **Migration & Type-Level Risks**:
  - Zod 4 is a major release. However, because `packages/mcp` does not use complex Zod features (`z.infer`, custom refinements, transforms, or recursive types) and only uses `z.object`, `z.string().describe()`, and `z.enum()`, the migration surface is minimal.
- **Migration Action Plan**:
  - Update `packages/mcp/package.json` to `"zod": "^4.6.7"`.
  - Execute `npm run typecheck` across all workspaces.
  - Run MCP server unit tests verifying tool schema registration and argument validation.

---

### 3.3 `@modelcontextprotocol/sdk@1.32.2` & Transitive HTTP Overrides
- **Advisory Resolution**: Upgrading `@modelcontextprotocol/sdk` from `1.29.0` to `1.32.2` resolves all 6 reported SDK advisories (`GHSA-6qxp-vccf-f47h`, `GHSA-22jm-h49p-29qw`, `GHSA-46jr-4wx8-v453`, `GHSA-f897-62hf-6gxq`, `GHSA-rvq5-wwqv-78pq`, `GHSA-6prh-2h8m-c8cw`).
- **Stdio Transport Compatibility**:
  - `McpServer` and `StdioServerTransport` APIs are 100% stable between `1.29.0` and `1.32.2`.
- **Transitive Dependencies**:
  - The SDK pulls in `express`, `body-parser`, `proxy-addr`, `qs`, `hono`, `@hono/node-server`, and `ip-address`.
  - While dormant in stdio mode, resolving them via root `overrides` ensures clean supply-chain auditability:
    - `"proxy-addr": "^2.0.8"` (resolves Critical `GHSA-jqcg-44mw-7w3h`)
    - `"body-parser": "^2.4.0"` (resolves High `GHSA-27r3-jxmh-p828`)
    - `"qs": "^6.17.1"` (resolves Moderate `GHSA-x5fp-wj9c-mxmx`)
    - `"ip-address": "^10.7.6"` (resolves Moderate `GHSA-rpw4-54j3-4h4q`)
    - `@hono/node-server` and `hono` resolve to non-vulnerable versions (`^2.1.6` and `^4.13.17`) directly via SDK 1.32.2.

---

### 3.4 Toolchain Reproducibility Decision
- **Discrepancy Documented**:
  - Pinned Toolchain: Node.js `22.22.0` (`.nvmrc`), npm `10.9.4` (`package.json` `packageManager`).
  - Host Audit Environment: Windows host running Node.js `24.19.0` and npm `11.17.0`.
- **Resolution Strategy**:
  - `nvm list` confirms `22.22.0` is already installed on the Windows host.
  - In addition, Docker Desktop is active with verified Linux image `node:22.22.0` (used for official baseline Task 0.7/0.8 runs).
  - **Mandate**: When Phase 2 (Implementation) updates `package-lock.json` and runs verification, execution MUST follow a Hybrid workflow: dependency installations and lockfile generation are performed locally under Node.js `22.22.0` and npm `10.9.4` (via `nvm use 22.22.0`), followed by a mandatory `npm ci` clean install and full verification suite execution inside the Linux `node:22.22.0` container to guarantee 100% CI and production parity.

---

## 4. User Scenarios & Dynamic Test Seams

### User Story 1 — Core SaaS Production Pilot Security (Priority: P1)
As a platform security officer preparing for Task 5.6 (Pilot in Egypt cafés), I want the Core SaaS production artifact (`apps/cloud`, `packages/server`, `packages/protocol`, `packages/storage-postgres`) completely free of critical and high vulnerabilities, so that café transactions and customer data cannot be compromised via supply-chain vectors.

- **Why this priority**: Absolute prerequisite for live pilot deployment.
- **Independent Test**: Two complementary checks verify this:
  1. `npm audit --omit=dev` scans the full monorepo production dependency graph (all 14 workspaces, including MCP production dependencies) and must report zero vulnerabilities. This is **not** a Core SaaS-only audit — it is the authoritative monorepo-wide production advisory scan.
  2. `npm ls --omit=dev --workspace=@loyalty-interchange/server --workspace=@loyalty-interchange/cloud --all` separately confirms Core SaaS runtime tree composition: `fast-uri` resolves to `≥ 3.1.9` and MCP dependencies are absent from the tree. `npm ls` does not query the advisory database; zero-vulnerability proof comes from the `npm audit` checks.

**Acceptance Scenarios**:
1. **Given** the Core SaaS dependency graph, **When** `fast-uri` is overridden to `^3.1.9`, **Then** Ajv compiles all TypeBox schemas without warnings or errors.
2. **Given** updated dependencies, **When** all registered tenant-isolation tests (`tests/unit/tenant-isolation-live.test.ts`) run against PostgreSQL 17, **Then** all tests pass with zero isolation leaks.

---

### User Story 2 — MCP Developer Tool Modernization (Priority: P1)
As an AI-assisted engineer using `packages/mcp`, I want `@modelcontextprotocol/sdk` upgraded to `1.32.2` and migrated to `zod@^4.6.7` with transitive HTTP overrides, so that local developer tools are secure against memory exhaustion and credential leakage.

- **Why this priority**: Eliminates all critical and high findings from `@loyalty-interchange/mcp` and ensures tool longevity.
- **Independent Test**: `npm test -- packages/mcp` passes and `lip-mcp` CLI starts cleanly over stdio.

**Acceptance Scenarios**:
1. **Given** `packages/mcp` upgraded to `zod@^4.6.7` and SDK `1.32.2`, **When** `createLipMcpServer()` is called, **Then** all 7 MCP tools register successfully with valid JSON Schemas.
2. **Given** the upgraded MCP server, **When** `lip_validate_json` is invoked with valid and invalid payloads, **Then** validation results match expected protocol verdicts.

---

### User Story 3 — Development Toolchain Protection (Priority: P2)
As a core monorepo contributor, I want `vite`, `vitest`, `js-yaml`, and `source-map-js` patched, so that local development and CI runs are immune to Windows command injection and event-loop DoS.

- **Why this priority**: Developer workstation hygiene and CI build reliability.
- **Independent Test**: `npm run build` and `npm test` execute cleanly across all packages.

**Acceptance Scenarios**:
1. **Given** `vite@^8.3.6` in `apps/admin`, **When** `npm run build:admin` runs, **Then** the Admin bundle builds without errors.
2. **Given** `vitest@^4.1.12`, **When** `npm test` runs, **Then** all registered test files pass.

---

## 5. Requirements

### 5.1 Functional Requirements
- **FR-001 (Core SaaS)**: System MUST resolve `fast-uri` to version `3.1.9` in the production graph via root `overrides`, eliminating all 10 GHSA advisories (`GHSA-5jgf-p345-68v8` through `GHSA-333x-w4r6-6crp`).
- **FR-002 (Core SaaS)**: System MUST preserve identical TypeBox JSON Schema compilation and validation behavior across all `/lip/v1` normative protocol contracts in `packages/protocol`.
- **FR-003 (MCP Tool)**: System MUST upgrade `packages/mcp/package.json` to `@modelcontextprotocol/sdk@^1.32.2`, eliminating 6 SDK advisories (`GHSA-6qxp-vccf-f47h`, etc.).
- **FR-004 (MCP Tool)**: System MUST migrate `packages/mcp/package.json` to `zod@^4.6.7`, eliminating High vulnerability `GHSA-mrhx-c7xc-m3w5`.
- **FR-005 (MCP Tool)**: System MUST override transitive Express/Hono dependencies in root `package.json` (`proxy-addr@^2.0.8`, `body-parser@^2.4.0`, `qs@^6.17.1`, `ip-address@^10.7.6`), eliminating the Critical finding and remaining High/Moderate findings.
- **FR-006 (Dev Tooling)**: System MUST remediate development tooling vulnerabilities (`vite@^8.3.6`, `vitest@^4.1.12`, `@vitest/coverage-v8@^4.1.12`, `js-yaml@^4.3.2`, `source-map-js@^1.2.2`, `browserslist@^4.29.5`, `postcss-selector-parser@^6.1.6`). For transitive dev dependencies (`js-yaml`, `source-map-js`, `browserslist`, `postcss-selector-parser`), the system MUST first attempt upgrading their direct parent devDependencies (`@apidevtools/swagger-parser`, `@vitejs/plugin-react`, `@tailwindcss/typography`); if parent upgrades do not resolve the vulnerable subdependencies, root `overrides` MUST be applied as a fallback to achieve zero residual dev vulnerabilities monorepo-wide.
- **FR-007 (Lockfile)**: System MUST generate `package-lock.json` using Node.js `22.22.0` and npm `10.9.4` without `--force` or `--legacy-peer-deps` via a Hybrid workflow (Windows `nvm use 22.22.0` generation followed by mandatory Docker Linux `npm ci` validation).
- **FR-008 (Governance)**: System MUST NOT modify `/lip/v1` wire semantics, OpenAPI definitions, PostgreSQL migrations, or RLS policies.
- **FR-009 (Governance & Fork Tracking)**: System MUST record a formal fork patch entry (`FP-002: Dependency Security Remediation (Task 0.12)`) in `docs/context/07-fork-patches.md`, documenting all manifest and override modifications affecting upstream packages against upstream `0.2.0` (commit `8ad93c81a414f5f7521061ddd88009083f4857aa`).

---

## 6. Success Criteria & Separated Pilot vs. Tooling Gates

### 6.1 Core SaaS Production Pilot Gate (Hard Blocker for Task 5.6)
To satisfy the Task 0.12 prerequisite for deploying the pilot in 1–3 Egypt cafés:
1. **Zero Runtime Vulnerabilities**: Zero unresolved Critical or High vulnerabilities exist in the deployable Core SaaS runtime dependency graph (`apps/cloud`, `packages/server`, `packages/protocol`, `packages/storage-postgres`, `packages/identity`).
2. **`fast-uri` & Protocol Verification**: `fast-uri` resolved to `3.1.9` with `npm run spec:check` confirming zero protocol schema drift.
3. **Mandatory Security Verification**: All registered PostgreSQL 17 tenant-isolation and lease conformance suites (`tests/unit/tenant-isolation-live.test.ts`, `packages/storage-postgres/src/tenant-isolation.test.ts`, `tests/conformance/postgres-lease-conformance.test.ts`) must execute and pass with zero failures and zero skipped tests.
4. **Reproducibility**: Core SaaS build and runtime dependency audit must be 100% reproducible under the pinned Node.js `22.22.0` and npm `10.9.4` environment.

### 6.2 MCP Developer Tooling Gate (Distribution / Untrusted Use Gate)
- **Tooling Gate Scope**: `@modelcontextprotocol/sdk`, `zod@^4.6.7`, and transitive Express/Hono overrides must be remediated before `packages/mcp` is published, distributed, or executed in an untrusted environment.
- **Independence from Core SaaS**: Because `packages/mcp` is marked Reference Only under `PD-002` and verified excluded from Core SaaS deployment manifests, MCP remediation is **NOT** an independent blocker for Core SaaS pilot deployment.
- **Reclassification Trigger**: If `packages/mcp` is ever packaged into the cloud container, deployed with an active HTTP listener, or exposed to untrusted external callers, its vulnerabilities automatically become Core SaaS production blockers.

### 6.3 Development Tooling Hardening
- Development tooling vulnerabilities (`vite`, `vitest`, `js-yaml`, `source-map-js`, `postcss-selector-parser`) are remediated to protect local developer machines and CI pipelines.
- Development-only findings are documented and tracked according to their local exposure, and are not equated with Core SaaS runtime vulnerabilities.

### 6.4 Dynamic Test Acceptance Criteria
Rather than prescribing rigid historical test counts:
- **Mandatory Suites**: All currently registered mandatory test suites in the repository MUST pass.
- **Zero Unexpected Failures**: Zero unexpected test failures allowed across all packages.
- **Zero Skipped Security Tests**: Zero skipped mandatory security, tenant-isolation, or lease tests.
- **Honest Test Reporting**: Any skipped tests (e.g., Windows-specific NTFS file permission checks or SQLite EBUSY cleanup on Windows host vs Linux Docker) must be explicitly identified, documented, and justified.

---

## 7. Assumptions, Out-of-Scope Boundaries, & Rollback Strategy

### 7.1 Assumptions
1. `npm@10.9.4` natively supports npm `overrides` in root `package.json`.
2. Zod 4 is compatible with simple object/string/enum schemas in `packages/mcp/src/server.ts`.
3. Pinned Node.js `22.22.0` via `nvm use 22.22.0` or Docker container is available for execution.

### 7.2 Out-of-Scope Boundaries
- No changes to authentication architecture (OTP, HMAC hashing, session cookies).
- No changes to PostgreSQL RLS policies or database migration files.
- No changes to manual billing or subscription management workflows.
- No changes to upstream protocol wire schemas.

### 7.3 Rollback Strategy
If any dependency upgrade causes regressions during Phase 2 planning/testing:
1. Revert `package.json`, workspace manifests, and `package-lock.json` via `git restore`.
2. Run `npm ci` under Node.js `22.22.0` to restore commit `cf1a0df528891bb439a82c44426b6a20b5e3f692`.
3. Re-verify clean baseline state with `npm run typecheck` and `npm test`.
