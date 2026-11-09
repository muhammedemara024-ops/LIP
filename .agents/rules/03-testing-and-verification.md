---
trigger: always_on
description: Honest verification reporting, test requirements, and Linux + PostgreSQL 17 test discipline
---

# Testing & Verification Discipline

1. **Honest Verification Reporting**:
   - Distinguish mandatory tests from intentionally skipped or environment-unsupported tests.
   - Never hide skipped tests, environment limitations, or test failures.
   - Never claim the full test suite passed unless it was actually executed in that verification run.
   - Always report:
     1. The exact execution environment (e.g., Windows host vs. Linux `node:22.22.0` + `postgres:17-alpine`).
     2. Exact counts of passed, failed, and skipped tests.
     3. The specific reason for any skipped test.

2. **Mandatory Test Coverage**:
   - **Bug Fixes (Tier 2)**: Require a regression test that reproduces the bug and verifies the fix.
   - **Features / Schema / API Changes (Tier 3)**: Require both unit and integration tests covering happy paths, edge cases, and tenant isolation boundaries.
   - **PostgreSQL / Storage / Auth / Tenant Isolation Changes**: Must be verified in the target Linux + PostgreSQL 17 environment (`node:22.22.0` + `postgres:17-alpine`) with `tenant-isolation-live`, PostgreSQL storage tenant isolation, and `postgres-lease-conformance` executing and passing with zero skipped mandatory tests.

3. **Standard Verification Commands**:
   - `npm run typecheck`
   - `npm run docs:check`
   - `npm run launch:check`
   - `npm run public-safety:check`
   - `npm test`
