---
trigger: always_on
description: Multi-tenant Postgres RLS isolation, EGP integer piasters, Egyptian phone normalization, PDPL privacy controls, and OTP/webhook security
---

# Security, Multi-Tenant Isolation, & Domain Invariants

1. **Multi-Tenant Isolation (`04-business-rules.md`, `PD-001`, `PD-006`)**:
   - Every business-owned row MUST be isolated at the database level via PostgreSQL Row-Level Security (`RLS` via transaction-local GUC `lip.tenant_id`, see `packages/storage-postgres/migrations/002_tenant_isolation.sql`).
   - Never add a tenant table without an RLS policy; never trust a tenant ID supplied by a client.
   - Merchant API keys must never reach a browser or phone; client surfaces talk only to the BFF.

2. **Monetary Representation & Rounding (`04-business-rules.md`, `PD-007`, `PD-008`)**:
   - Store and process all monetary values in integer minor units (for `EGP`, integer piasters where `4550` = `45.50 EGP`). Never use floats for money or points.
   - Do not prescribe `Math.floor()` as a universal monetary rounding policy. Follow the explicit business rules and rounding requirements in `docs/context/04-business-rules.md` and `spec/` (rounding applies once on total eligible spend, never per line; earn previews come from LIP `orders/evaluate`, never client-side math).

3. **Egyptian Mobile Phone Normalization (`PD-004`, `04-business-rules.md`)**:
   - Normalize and validate Egyptian mobile phone numbers in E.164 format across the four valid mobile prefixes:
     - `+2010XXXXXXXX`
     - `+2011XXXXXXXX`
     - `+2012XXXXXXXX`
     - `+2015XXXXXXXX`
   - Validation regex: `^\+20(10|11|12|15)\d{8}$`.

4. **Privacy & PDPL Engineering Controls (`Law 151/2020`, `PD-006`)**:
   - Treat PDPL requirements in `docs/context/04-business-rules.md` and `PD-006` (keeping personal data only in the platform customer directory schema/role, per-brand marketing consent, right-to-erasure scrubbing profile PII while preserving the pseudonymous immutable ledger, and zero raw phone/email across `/lip/v1` or in logs/URLs/idempotency keys) as engineering requirements subject to legal validation (Task `0.10`).
   - Never claim legal approval or compliance certification without external evidence.

5. **OTP, Session, & Webhook Security (`PD-004`, `PD-005`)**:
   - Store OTP codes as HMAC digests with a server-side secret and compare in constant time (`crypto.timingSafeEqual`).
   - Store session IDs hashed (`>= 256` bits entropy) with `httpOnly`, `Secure`, `SameSite` cookies and CSRF protection.
   - Verify webhooks on the raw body using HMAC-SHA256 + constant-time comparison and deduplicate by transaction/event ID.
