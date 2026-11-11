# Specification Quality Checklist: Dependency Security Remediation (Task 0.12)

**Purpose**: Validate specification completeness, threat model accuracy, and quality before proceeding to planning  
**Created**: 2026-11-09  
**Feature**: [spec.md](../spec.md)  

## Content Quality & Threat Modeling

- [x] Multi-tiered classification separating Monorepo graph, Core SaaS runtime, MCP developer tool, and Dev tooling
- [x] `packages/mcp` investigated against deployment manifests (`render.yaml`, `compose.yaml`) and proven excluded from Core SaaS execution
- [x] `packages/mcp` verified to operate strictly over `StdioServerTransport` with zero active HTTP listeners
- [x] Core SaaS production dependency tree analyzed: proven that `fast-uri` is the sole production vulnerability blocker
- [x] All 19 vulnerabilities preserved and traced in the evidence matrix without suppression or hiding
- [x] Fork-patch tracking established: manifest changes to upstream packages recorded as `FP-002` in `docs/context/07-fork-patches.md` per Constitution Article II.3
- [x] Transitive development tooling strategy defined: parent upgrade first, root overrides as fallback

## fast-uri Advisory Evidence

- [x] All 10 affected advisories (`GHSA-5jgf-p345-68v8` through `GHSA-333x-w4r6-6crp`) documented with distinct affected ranges (`3.1.6`, `3.1.7`, `3.1.8`, `3.1.9`)
- [x] Avoids false claims that all advisories require 3.1.9 individually; documents that 3.1.9 is the minimum version that resolves all 10 advisories cumulatively
- [x] Compatibility verified with `ajv@8.20.0`'s dependency range (`fast-uri: ^3.0.1`)
- [x] Explicit test seams identified for JSON Schema compilation, URI validation, and protocol checks

## Zod 4 Migration Quality

- [x] Zero-risk-acceptance stance implemented for Zod at Gate 1; preferred Zod 4 migration path fully documented
- [x] Codebase audited: verified Zod is imported in only 1 file (`packages/mcp/src/server.ts`) for 4 basic tool schemas
- [x] Verified `@modelcontextprotocol/sdk@1.32.2` and `zod-to-json-schema@3.25.2` natively support Zod 4 peerDependencies
- [x] Type-level and schema generation test seams defined for MCP tools

## SDK & Transitive Dependency Quality

- [x] All 6 `@modelcontextprotocol/sdk` advisories mapped and verified resolved in `1.32.2`
- [x] Transitive Express/Hono vulnerabilities (`proxy-addr`, `body-parser`, `qs`, `ip-address`) addressed via targeted root overrides
- [x] Stdio execution model documented: Express/Hono transports are dormant but cleanly remediated for supply-chain integrity

## Toolchain Reproducibility Quality

- [x] Discrepancy between host Node 24.19.0 / npm 11.17.0 and repository Node 22.22.0 / npm 10.9.4 documented
- [x] Execution mandate established requiring lockfile generation and verification under pinned Node 22.22.0 / npm 10.9.4 via Hybrid workflow (Windows host + Linux Docker validation)

## Pilot & Testing Gate Quality

- [x] Pilot acceptance gate restructured: separates Core SaaS production blockers from MCP developer tooling and dev tooling
- [x] Conditions documented under which MCP tool classification would change
- [x] Dynamic test acceptance criteria adopted: based on passing all registered mandatory suites, zero unexpected failures, zero skipped mandatory security tests, and transparent reporting of environment skips
- [x] PostgreSQL 17 tenant-isolation and lease conformance tests established as mandatory for Core SaaS remediation

## Notes

- Both specification and checklist updated to fully address all Gate 1 review findings.
- Specification files remain untracked; zero tracked files, manifests, or application code modified.
- Ready for Gate 1 User Approval.
