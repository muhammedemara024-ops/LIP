# Fork patches

Every modification to upstream LIP code is logged here (PD-002, golden rule 1).
Upstream remote: `upstream` → `craveup-oss/loyalty-interchange-protocol`.
Changes to `/lip/v1` wire semantics or `spec/` are never allowed and never appear here.

| File | Reason | PD reference | Upgrade impact |
| --- | --- | --- | --- |
| `.gitignore` | Workspace hygiene; ignores `.claude/settings.local.json` (per-machine Claude Code settings) | PD-002 | Trivial merge |
| `packages/storage-postgres/src/index.ts`, `apps/cloud/src/postgres-repository.ts`, `apps/cloud/src/customer-postgres-repository.ts` | Acquire `pg_advisory_xact_lock` before `CREATE TABLE IF NOT EXISTS lip_schema_migrations` / `lip_cloud_schema_migrations` to prevent `23505` (`pg_type_typname_nsp_index`) catalog race on concurrent cold-start migrations | PD-002 | Safe to drop if upstream merges equivalent lock ordering |
| `tests/unit/postgres-storage.test.ts`, `apps/cloud/src/migrate.test.ts` | Regression tests proving 8-way concurrent cold-start migration safety on a fresh PostgreSQL schema | PD-002 | Keep alongside migration lock fix |
| `skills/lip/SKILL.md`, `skills/lip-cli/SKILL.md`, `skills/lip-webhooks/SKILL.md`, `skills/lip-bff/SKILL.md`, `docs/api-docs-gap-analysis.md`, `docs/postgres.md`, `docs-site/guides/postgres.mdx` | Task 0.9 documentation drift fixes (v0.2.0 `/platform/v1` and `/admin/api/v1/program/*` scope, webhook loopback env var + 16-char secret + `balance.changed.v1`, PD-004 BFF OTP note, July 2026 historical banner, 3-service diskless Render blueprint) | PD-002, PD-004, PD-006 | Docs-only merge |
