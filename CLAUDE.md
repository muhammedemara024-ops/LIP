# CLAUDE.md

Context for Claude (Claude Code and Claude Projects) working in this repository.
Read this file first, then `docs/context/README.md`.

## What this repository is

This is a downloaded copy of the open-source **Loyalty Interchange Protocol (LIP)**
v0.2.0 (Apache-2.0, upstream `craveup-oss/loyalty-interchange-protocol`).
It is a TypeScript/Node 22 monorepo containing:

- `/lip/v1` — a normative, vendor-neutral loyalty **transaction protocol**
  (evaluate → reserve → capture → accrue → adjust), spec in `spec/`.
- A reference engine, HTTP server, Admin UI, guest wallet, SDK, CLI, MCP server.
- `/platform/v1` — non-normative customer data, segments, campaigns, analytics.
- `/cloud/v1` — non-normative managed control plane (orgs, plans, Stripe billing).

## What WE are building on top of it

A multi-tenant **SaaS loyalty & retention platform for cafés and restaurants in
Egypt** (Arabic + English, EGP, WhatsApp-first). Full brief:
`docs/context/00-product-brief.md`. LIP is the candidate **loyalty core**, not the
whole product. Approved decisions live in `docs/context/01-decisions.md`.

**The single most important framing:** upstream LIP targets restaurant tech teams
with POS integrations and says it is *not* a turnkey no-code product. Our product
*is* turnkey for small cafés with no POS integration. Everything we add (staff
cashier app, QR flows, OTP sign-in, WhatsApp automation, Arabic UI, local billing)
lives **outside** `/lip/v1`. See `docs/context/03-gap-analysis.md`.

## Golden rules (do not break)

1. **Never change `/lip/v1` semantics or `spec/`** to fit our product. Put product
   behavior in our own layer (BFF / `/platform/v1` extensions / new apps).
   If the spec seems wrong, write it up in `docs/context/01-decisions.md` as a
   *proposed* decision and stop.
2. **Money is integer minor units.** EGP 45.50 = `{ "amount": 4550, "currency": "EGP" }`.
   Never use floats for money or points.
3. **Every write carries an idempotency key and a stable business id**
   (`order_id`, `redemption_id`, `adjustment_id`). Retries must not double-award.
4. **Tenant isolation is enforced in the database** (Postgres RLS via the
   transaction-local GUC `lip.tenant_id`, see
   `packages/storage-postgres/migrations/002_tenant_isolation.sql`).
   Never add a tenant table without the RLS policy; never trust tenant id from a client.
5. **Ledger is immutable.** Corrections are new entries, never UPDATE/DELETE.
6. **Merchant API keys never reach a browser or phone.** Clients talk to a BFF.
7. **No raw phone/email across `/lip/v1`.** Use opaque `member_id`.
8. **Points are not money** and never appear as a tender (unless stored-value credit,
   which needs a separate legal decision).
9. A new feature not in the MVP list goes to the backlog, not into the code.
11. Billing is **Kashier**, not Stripe (PD-005). Do not add Stripe code paths.
10. Do not claim something works because a test exists; run it or say it is unverified.

## Commands

```bash
npm ci                 # install (npm workspaces; pnpm is not supported)
npm start              # local sandbox: Admin http://127.0.0.1:3210/admin/ key lip-dev-key
npm test               # vitest, full suite
npm run typecheck
npm run verify         # full pipeline (needs disposable Postgres for some suites)
npm run generate       # regenerate schemas/OpenAPI/SDK after protocol type changes
npm run lip -- doctor http://127.0.0.1:3210 --api-key lip-dev-key
npm run lip -- test   http://127.0.0.1:3210 --api-key lip-dev-key
docker compose --profile postgres up --build   # Postgres-backed runtime on :3211
```

Note: this copy has no `.git` and no `node_modules`; run `npm ci` and `git init`
before relying on any of the above.

## Where things are

| Need | Path |
| --- | --- |
| Normative protocol prose | `spec/core.md`, `spec/lifecycle.md`, `spec/account-experience.md`, `spec/profiles/foodservice.md` |
| Protocol types / validation | `packages/protocol/src/*.ts` (TypeBox → `spec/schemas/*.json`) |
| Loyalty engine (points, stamps, tiers, lots, expiry) | `packages/reference/src/engine.ts`, `config.ts` (`ProgramDefinition`) |
| HTTP server + Admin API | `packages/server/src/server.ts` |
| Roles, API keys, location scope, audit | `packages/server/src/access-control.ts` |
| Branches (locations) | `packages/server/src/locations.ts` |
| Program draft / publish / rollback | `packages/server/src/program-management.ts` |
| Customer profiles, consent, events, CSV import | `packages/server/src/customer-data.ts` |
| Segments + reward campaigns + holdouts | `packages/server/src/campaigns.ts` |
| Messaging jobs (webhook connector only) | `packages/server/src/engagement.ts` |
| Postgres storage + RLS | `packages/storage-postgres/` |
| Customer identity (OIDC → customer → member) | `packages/identity/`, `apps/cloud/src/customer-*.ts` |
| Plans, subscriptions, billing (Stripe today → Kashier, PD-005) | `apps/cloud/src/billing.ts`, `apps/cloud/src/types.ts` |
| Admin UI (React/Vite, single 77 KB `App.tsx`) | `apps/admin/src/` |
| Guest wallet BFF (OIDC/PKCE) | `apps/wallet/src/server.ts` |
| Tests | `tests/unit`, `tests/conformance` |

Mapping of our product modules → LIP constructs: `docs/context/02-lip-architecture-map.md`.

## Known upstream drift (do not trust blindly)

- `skills/lip/SKILL.md` says program editing is boot-time only and lists campaigns/
  segments as out of scope; the code and CHANGELOG 0.2.0 ship draft/publish/rollback
  and `/platform/v1` campaigns. Prefer code + `spec/` over skills/docs.
- `docs/api-docs-gap-analysis.md` (July 2026) predates 0.2.0; several "missing"
  items now exist.
- Upstream branding ("Crave", "CraveUp", `crv_cus_*`) must be replaced before we
  ship anything under our own brand; keep Apache-2.0 `LICENSE` and attribution.

## How to work

- Small, reviewable changes. Write or update the test first for engine/ledger/
  idempotency/tenant code.
- Before touching money, balances, reservations or RLS: re-read the relevant
  section of `docs/context/04-business-rules.md` and the spec.
- Respond to the human in Egyptian Arabic unless asked otherwise; keep code,
  identifiers, commits and docs in English.
