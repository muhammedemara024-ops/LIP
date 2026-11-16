# Phase 0 Research: [Product] P0 technical plan

**Feature**: `specs/002-p0-prd/spec.md` (PRD v1.0, Gate 1 approved 2026-11-12, published in `3016954e190df50d9deeba575456f15c789ae4c8`)
**Date**: 2026-11-12
**Status**: Included in the P0 Planning Gate approved by the owner on 2026-11-12 (approval provenance and scope: plan.md, Approval reconciliation). R-01–R-26 and R-16a form the approved planning baseline, subject to every explicit unresolved decision and verification gate. OD-01–OD-18 and their recommendations remain Proposed. No Approved product decision is changed; no implementation is authorized.

## 0. Method and evidence

- Sources read: `AGENTS.md`, `.specify/memory/constitution.md`, `.agents/rules/*`, `docs/context/01-decisions.md` (PD-001–PD-038), `02-lip-architecture-map.md`, `03-gap-analysis.md`, `04-business-rules.md`, `05-glossary.md`, `06-roadmap.md`, `07-fork-patches.md`, the spec and its checklist.
- Repository inventory (read-only, 2026-11-12). These facts are **source-read, not executed** unless stated otherwise:
  - **Missing pieces.** No `apps/bff` or `apps/web` exists. Nothing implements OTP, PIN, member QR, WhatsApp, a stage engine, per-member locks or a cashier role.
  - **HTTP servers.** `packages/server`, `apps/cloud` and `apps/wallet` use raw `node:http` with no framework.
  - **Database access.** PostgreSQL through `pg` 8.22.0. Migrations are custom SQL-file migrators following the FP-001 lock pattern (`packages/storage-postgres/src/index.ts` 272–309, `apps/cloud/src/postgres-repository.ts` 284–315).
  - **Tenant isolation.**
    - `withTenantTransaction` sets the GUC `lip.tenant_id` with `set_config(...,true)` after `SET LOCAL ROLE lip_tenant_runtime` (`NOLOGIN NOBYPASSRLS`), with FORCE RLS on 14 engine tables.
    - `assertTenantIsolationEnforced` runs at managed startup.
    - Live tests are gated by `LIP_TEST_POSTGRES_URL`, and CI fails if any test is skipped (`.github/workflows/ci.yml`, `postgres:17`).
  - **Engine persistence.** `PostgresEngineRepository.mutate` takes the transaction lock `lip:engine:{tenant}:{program}`, then **reloads the whole program state and deletes and re-inserts every engine row for that tenant/program on every write** (`index.ts` 434–446, 617–784).
    - `withLease()` (session `pg_try_advisory_lock`) has no production caller.
    - No per-member serialization exists.
  - **One environment per café.** Each Cloud environment is bound to one `tenant_id` and one `program_id`, served at `/runtime/v1/environments/{id}` by one managed data-plane process (`apps/cloud/src/managed-data-plane.ts`). `provisionTenant` obtains a merchant credential **only inside its optional webhook branch** (`apps/cloud/src/tenant-onboarding.ts` ~338); P0 requests no webhook, so credentials must be obtained separately through the existing credential-rotation operation (R-02).
  - **Engine capabilities.**
    - Stamps are native (`visit_stamp_policy`, `stamp-{member}-{n}` issued rewards, reset adjustments).
    - Points use `earn_rate`, `earning_policy` and point lots.
    - `orders/adjust` exists for refund, void and correction.
    - `ledger/list` uses a cursor and returns at most 100 entries per page.
  - **SDK.** `LipClient` accepts a `baseUrl` that includes a path prefix, and supports per-call idempotency keys (`packages/sdk/src/client.ts`).
  - **Cloud customer identity.** It verifies external IdP tokens only and its tables (`apps/cloud/migrations/003`) have **no RLS**. Cloud billing supports `manual` and `stripe`; usage events are recorded only when explicitly posted.
  - **Frontends.** `apps/admin` (React/Vite) and `apps/wallet` (vanilla) have no i18n or RTL.
  - **Observability.** Logging is JSON lines on stdout; metrics are hand-rolled Prometheus text; `/health` and `/ready` exist.

## 1. Architecture and service boundaries

### R-01 — Topology: three services per environment (PD-006, unchanged)
- **Decision.** Three services per environment:
  - The LIP runtime: `apps/cloud` managed data plane, **one instance** (PD-002, PD-006).
  - `apps/bff`: a long-running Node 22 service.
  - `apps/web`: one Next.js app serving the `app.`, `staff.` and `dashboard.` subdomains.

  All three run in Render Frankfurt behind Cloudflare, with Render Postgres. Only the BFF reaches LIP, over Render's private network. Only the BFF holds merchant keys.
- **Rationale.** This is fixed by PD-006 and the architecture map, so the plan only implements it.
- **Alternatives.** Serverless BFF (rejected by PD-006: timers and session advisory locks); merging BFF into the LIP process (breaks the product/upstream boundary, Constitution Art. II.4).

### R-02 — One LIP environment (tenant) per café
- **Decision.**
  - **Provisioning.** Each café is a Cloud organization with one production environment, provisioned with `provisionTenant` (operator tooling). That environment is bound to one `tenant_id` and one `program_id`, which matches PD-012's single program per café.
  - **Credentials.** `provisionTenant` returns no credential on the P0 path (no webhook). Provisioning is therefore a recoverable, resumable sequence recorded in `bff.cafes.provisioning_step`: (1) create the organization/environment and record its ids; (2) wait for readiness; (3) issue a merchant credential through the existing rotation operation; (4) persist it encrypted (AES-256-GCM, key from the BFF secret store) and verify it with a read-only LIP call; (5) only then mark the café `provisioned` and allow invites. A crash at any step resumes from the recorded step; a credential issued but not persisted is revoked by re-running rotation. The BFF calls `/runtime/v1/environments/{environment_id}/lip/v1/*` through `LipClient`.
  - **Test café.** The dedicated SLO test café (PD-038 P3) is an ordinary environment flagged `is_test_cafe` in our layer.
- **Rationale.**
  - It reuses the existing provisioning, RLS scoping and credential rotation.
  - Tenant isolation is the existing FORCE-RLS on engine tables.
  - A café's credential can act only on that café's tenant/program.
- **Alternatives.** Shared tenant with one program per café: rejected, because cross-café isolation would then depend on application filters only.
- **[VERIFY at task 2.2]** The SDK base URL with the runtime path prefix works end-to-end through the managed data plane.

### R-03 — BFF HTTP framework: Hono on `@hono/node-server`
- **Decision.** Build `apps/bff` on Hono 4.x with `@hono/node-server`, both promoted from transitive to direct dependencies at the versions already pinned and audited by FP-002 (`hono` 4.13.17, `@hono/node-server` 2.1.6). Request validation uses TypeBox + Ajv, as the repository already does.
- **Rationale.**
  - The BFF has roughly 80 routes across four audiences with cookies, CSRF, step-up and idempotency middleware, and hand-written `node:http` routing would add security-relevant boilerplate.
  - Hono is small, standards-based (Fetch API), well-typed and already in the audited lockfile.
- **Alternatives.**
  - Raw `node:http`, as upstream does: consistent, but its routing and middleware are error-prone at this size.
  - Fastify or Express: these would be new dependency trees needing a fresh audit.
- **Dependency gate.** Any new direct dependency (Hono, Next.js and its tree, Playwright, a QR library) passes the FP-002 audit discipline (`npm audit --omit=dev` production gate, SC-015) before merge.

### R-04 — Web: one Next.js app (`apps/web`), surfaces split by subdomain (PD-006)
- **Decision.**
  - **Routing.** Next.js App Router. Middleware routes by `Host` to three route groups (`(customer)`, `(staff)`, `(owner)`) whose code never imports one another.
  - **PWA.** The customer and staff surfaces are installable PWAs with a service worker.
  - **i18n.** Arabic RTL is the default and English the second language. `next-intl` or an equivalent message catalog is chosen at task 2.8 under the dependency gate. `<html dir>` and `lang` are set server-side from the account or cookie (PD-007).
  - **Rendering.** All data is fetched from the BFF; no business rule is evaluated in the browser (previews come from `orders/evaluate`, PD-008).
- **Rationale.** PD-006 consequence 3 and the architecture map name one Next.js app.

### R-05 — Browser → BFF transport: same-origin `/api` per surface host
- **Decision.** Each surface host (`app.`, `staff.`, `dashboard.`) exposes `/api/*` as a Next.js rewrite to the BFF's private URL.
  - **Cookies.** Session cookies are host-only `__Host-` cookies set for that surface host, so there is exactly one session cookie per subdomain (PD-010).
  - **No CORS.** The browser never talks cross-origin.
  - **`api.` host.** Reserved for operator endpoints and future webhooks.
  - **Client IP.** The BFF trusts `CF-Connecting-IP` only through the Next.js hop on the private network, and the web service is reachable only through Cloudflare.
- **Rationale.** `__Host-` cookies cannot be shared across subdomains, so having each surface call `api.` directly would put the cookie on `api.` for all three surfaces and lose PD-010's one-cookie-per-subdomain separation (a customer session and an owner session in the same browser would collide).
- **Alternatives.** Direct `api.` calls with CORS and credentials: rejected for the cookie reason above.
- **Cost.** One extra private-network hop, measured in the load test (task 5.2).

### R-06 — Directory (personal data) as a separate module, schema and DB role (PD-006 hedge, G-01)
- **Decision.** `apps/bff/src/directory/` is a module with its own `pg` pool, login role `lip_directory_app` and schema `directory`. Personal data never leaves it except through its TypeScript `DirectoryService` interface.
  - **Contents.** Phone numbers, first names, consents, customer sessions and devices, and OTP challenges. Owner and staff phone numbers are included as *phone identities*.
  - **Isolation.** The product role `lip_bff_app` has **no grants** on schema `directory`, and a lint rule forbids imports of directory internals from outside the module.
  - **Future move.** The interface is shaped so it can be replaced by an HTTP client if the directory must later move to an Egyptian host (task 0.10).
- **Rationale.** This is PD-006 consequence 10 and the architecture map, and it keeps raw phones out of LIP, logs and other schemas (FR-004).
- **Alternatives.** Reusing `apps/cloud` customer identity: rejected. It verifies external IdP tokens only (PD-004 requires our own OTP), it is single-tenant via configuration, and its tables have no RLS.

### R-07 — Durable per-member admission, operation journal and fencing (PD-008 A1 C8, PD-038 P10)
- **Problem.** BFF operations span several LIP calls and cannot hold a database transaction across HTTP. A session advisory lock can be lost while a dispatched call is still in flight, and LIP gives no server-side fencing: a request context carries no enforced deadline, and LIP caches only **successful** idempotent results, not refusals (`engine.ts` ~2354). So a delayed ("zombie") copy of a call that the BFF already recorded as refused can still commit later.
- **Decision.** Every operation that can change a member's balance or rewards — purchase accrual, claim confirmation, redemption reserve, capture and release, void steps, void settlement, owner adjustments, migration posting, and customer erasure (data-model §2) — follows one pattern:
  1. **Durable admission slot (the source of truth).** The operation is admitted by inserting `bff.member_ops (tenant_id, member_id)` — a primary-key row naming the operation (`op_ref`, `kind`), status `admitting`, with a lease and a fresh **admission token** (`admission_id`, a new ULID generated for every successful insert, UNIQUE, never reused even when the same `op_ref` is admitted again) — in its **own short transaction** (1a). The token stays inside the BFF; it is carried by the in-process operation and recorded on every journal intent the admission creates (`lip_calls.admission_id`). It is never sent to a client or to LIP. Any pre-call LIP reads (stamp snapshot, void plan, migration re-check) happen next, **outside any database transaction** (1b). A second short transaction (1c) re-takes its locks in the global order (data-model §6): for a counter operation the branch row `FOR SHARE` with the branch, device and session checks **repeated** (R-16a), then `bff.members` `FOR UPDATE`. It verifies, under that lock, that the member's slot row carries **exactly this admission's token** and is still `admitting`. Checking `op_ref` is not enough: a re-submitted confirm or a repeated void request re-admits the same `op_ref` with a new token, so only the token proves that no reclaim and re-admission happened in between. The sweeper's reclaim takes the same `bff.members` lock, so a stale or reclaimed admission is detected and 1c aborts **before** committing any snapshot, plan or intent, with nothing sent. Only then does 1c commit the snapshot or plan and the first journal intent and move the slot to `active`. If any 1c check fails, 1c deletes the slot only `WHERE admission_id = <its own token>` (never by member alone, so it can never remove a newer admission's slot) and sends nothing. Only redemption steps, which need no pre-call read, run 1a and 1c as one transaction. No database transaction is ever held open across an HTTP call. A slot left `admitting` with no journal intent after its lease expires was never used to send anything; the recovery sweeper deletes it.
     - **Slot lease and reclaim.** 1a sets `lease_until` to now plus the sum of the 1b read timeouts plus a margin, so a live admission is normally not reclaimed. The sweeper finds candidates through `bff.due_work` and reclaims each in a tenant-scoped transaction that locks `bff.members` `FOR UPDATE` (several members in one transaction only in ascending `member_id`, global lock order), re-reads the slot, and deletes it only if it still carries the **same `admission_id` it observed**, is `admitting`, its lease has expired, and no journal intent carries that token. If a slow admission is reclaimed anyway, its 1c fails the token check and nothing is sent; the caller gets retryable `member_busy` (a capture session stays `open`; a void stays `requested`). Terminal-outcome transactions likewise delete the slot only by the `admission_id` recorded on their journal intent. A conflicting insert means another operation for that member is unresolved, and the request is refused with retryable `member_busy`. The slot is deleted only in the transaction that records the operation's **terminal** outcome (every step terminal and every domain effect written). A void is admitted like any other operation, with a `member_ops` slot of kind `void`; its 1c transaction hands the member over from that slot to the member block (`member_blocks`) atomically, and the block then holds the member from planning until reconciliation completes, exactly as PD-008 A1 requires (R-17). A session advisory lock (`bff:member:{tenant}:{member}`) may still be taken as a fast-path to avoid conflicts, but correctness never depends on it.
     - Consequences: at most one balance-changing operation per member is ever unresolved; a delayed adjustment can never interleave with an accrual or a void plan (closes Sol R1 #1/R2 #1); every pre-call read (stamp snapshot, void plan, migration re-check) sees a state that no unresolved call of ours can still change (closes R2 #3), so no "clean snapshot" flag is needed.
  2. **Durable block check.** A void's member block also refuses unrelated operations with `void_in_progress` (FR-063), except the steps of that void and the owner's settlement of a *needs owner* void.
  3. **Write-ahead journal with leases.** Each dispatch of a call is recorded as an attempt (`bff.lip_call_attempts`: attempt number, sent at, outcome), so a late answer from an earlier attempt is never discarded. Each LIP call is a `bff.lip_calls` row: `member_id`, `workflow_ref` and `step_no` (UNIQUE together), business id, idempotency key, exact body and SHA-256, status, `lease_owner`, `lease_generation`, `lease_until`. The dispatcher re-checks its lease, sets `dispatched`, then calls LIP with an HTTP timeout shorter than the lease. Each attempt's answer is always recorded on its attempt row. The call's own status is updated under a guard that only forbids **regressing** a terminal state (`WHERE status NOT IN ('confirmed','failed_definite','abandoned')`), not under the lease generation, so the original dispatch's own refusal still counts. The outcome and its domain effect are recorded **in one transaction**. A workflow dispatches step *n* only after step *n−1* is terminal.
  4. **What counts as definitive.** Only these end a call:
     - any attempt's **success** (LIP caches successes, so every other attempt, past or future, has no second effect);
     - **every** dispatched attempt answered with a definite engine refusal (no attempt is still unanswered), which proves none committed;
     - a call that is **provably undispatched**: an `intent` row whose lease expired before it was ever marked `dispatched` is marked `abandoned` (the dispatcher re-checks its lease before marking `dispatched` and sends only after that commit, so an `intent` row was never sent).
     - **conditional, pending S-2:** a redemption `capture` or `reverse` attempt answered **`expired`**. The engine expires an overdue reservation inside its program-locked transaction before any effect, refusals are not cached and successes are (`engine.ts` ~835–843, ~891–896, ~2274–2278, ~2354–2358). If an earlier attempt had committed, a same-key attempt returns that cached success instead of `expired`; any attempt still in flight reaches the engine after expiry and is also refused. So an `expired` answer would prove that no attempt of that call has committed or can still commit. This outcome counts as definitive **only after S-2 has verified** that (i) expiry is evaluated inside the same locked transaction before any effect, (ii) an expired reservation never becomes capturable again, (iii) an original attempt arriving after a re-send is answered `expired` (or the cached success), and (iv) expiry restores the issued reward or points exactly once (lip-integration.md). Until then an `expired` answer is treated like any other refusal: it ends the call only when no other attempt is unanswered, otherwise the call stays `uncertain` and the member stays held (fail closed). When it does end the call: the call becomes `failed_definite` with the `expired` response recorded, the redemption becomes `expired` (terminal), and the member's slot is released in the same transaction. Accruals, adjustments, migration postings and void steps have no expiry, so `expired` never ends them; it does not affect a void's member block.
     A refused re-send does not end a call while some **other** attempt is still unanswered, because that delayed attempt might still commit later. The call stays `uncertain`. A crash after `dispatched` but before the bytes left the process is indistinguishable from an unanswered send and is treated the same way (a freeze under option B; see K-5b).
  5. **Forward-only recovery.** The recovery sweeper (R-15) claims `uncertain` rows and `dispatched` rows whose lease expired.
     - **Re-send prerequisites.** LIP's idempotency cache key includes `context.source.system` (`engine.ts` ~2339), so every BFF instance sends one pinned constant `source`; a test pins that, and that generated SDK write methods stay `safeToRetry: false` so the SDK never retries on its own.
     - **Non-accrual operations** are re-sent with the same key and byte-identical body until a re-send succeeds or the original's fate is fenced (step 6). Recovery never recomputes an amount.
     - **Accruals are never re-sent**, interactively or in the background (PD-038 P8, FR-069, `engine.ts` 611). Uncertain accruals follow R-14. Whether a same-key, byte-identical re-send **within the capture flow's own recovery window** is permitted is a separate owner question (**OD-17**); the plan keeps "never" until it is decided.
  6. **Fencing (OD-15).** The member's slot can be released after an unresolved call only when that call can no longer commit. LIP offers no such guarantee today. Two options are put to the owner:
     - **(A, recommended) Dispatch-deadline fork patch (candidate FP-005).** A small upstream change **with no `/lip/v1` schema change**: `RequestContextSchema` is closed (`additionalProperties: false`, `packages/protocol/src/primitives.ts` ~55–65) and `07-fork-patches.md` forbids wire-semantics changes, so the deadline cannot travel in the request body. Instead the managed data plane (`/runtime/v1/environments/{id}`, `apps/cloud` / `packages/server`) accepts an optional private-network header (for example `X-Lip-Not-After`) and checks it **inside the program-locked `mutate` wrapper**, refusing the write if the locked transaction starts later than that instant. A request without the header behaves exactly as today. Whether this optional header on the runtime path is an allowed behaviour addition under `07-fork-patches.md` is part of the decision; if it is judged a wire change, option A is withdrawn and only B remains. The BFF sets `not_after` = dispatch time + a few seconds. After `not_after` plus a clock-skew margin, an unanswered call can never commit: its effect either happened (and is visible to reads) or never will. The slot is then released; a non-accrual call is resolved by re-send or recorded as refused; an uncertain **accrual** becomes `unconfirmed` (R-14) and only that one purchase stays unresolved, while the member can earn and redeem again. Needs its own owner decision, `07-fork-patches.md` entry and tests (Constitution Art. II).
     - **(B) No upstream change, fail closed.** An unresolved call keeps the member's slot until resolved. For an uncertain accrual before FP-003 V4 (no authoritative evidence), that means the member cannot earn, redeem or be adjusted until an operator resolves it. The only release is an operator action recording an explicit, audited acceptance of the residual risk; that action itself is a product rule the owner must approve.
       - **Status.** B is a **temporary fail-closed baseline for development and verification only. It is not accepted production behaviour**: an indefinite freeze of a customer is not an outcome the plan treats as shippable. OD-15 must be decided — A, or B together with an owner-approved release procedure and escalation timing — before PM-3 exit.
       - **Recovery and escalation path under B.** (1) *Automatic, forward-only:* the recovery sweeper keeps working the call; a non-accrual call is re-sent with the same key and byte-identical body, and any success ends it; a redemption-step freeze ends at reservation expiry once S-2 verifies the conditional outcome in step 4 (below); until then it too stays fail closed. (2) *Visibility:* a frozen member is shown at once on the owner's *needs attention* list and the operator report, with the unresolved call and its age (no phone or name beyond what those surfaces already show). (3) *Escalation:* an unresolved freeze is escalated to the operator (Super Admin); the escalation timing is part of OD-15 and is not assumed. (4) *Final resolution of an uncertain accrual:* the FR-069 authoritative ledger read, once FP-003 V4 has verified it, or an operator release under the owner-approved procedure. Nothing is ever recomputed or re-sent as a new accrual.
     - **Existing partial fence.** `capture` and `reverse` expire an overdue reservation first and refuse with `expired` (`engine.ts` ~835–843, ~891–896). So, even under B, a freeze caused by an uncertain redemption capture or release would be bounded by `reservation_ttl_seconds` plus clock skew, through the conditional definitive outcome in step 4. That bound holds **only after S-2 verifies it**; until then such a freeze is unbounded like the others. Only accruals, owner adjustments, migration postings and void steps can freeze a member without bound under B either way. This uses LIP's existing expiry only; it is not FP-005 and adds no deadline header. **[VERIFY at S-2]** (lip-integration.md).
     Until OD-15 is decided, the plan assumes **B** (fail closed) and builds nothing for A.
- **Rationale.**
  - Correctness must rest on durable rows, not on a connection-scoped lock.
  - Without server-side fencing, no client-side lease or timeout can prove a delayed request will not commit (Sol R2 #24).
- **Alternatives.**
  - Session advisory lock as the source of truth: rejected, it is lost with its connection while calls are in flight.
  - `SELECT … FOR UPDATE` held across LIP calls: a long transaction, and the intent is lost on crash.
  - An in-process mutex: not multi-instance safe (SC-016).
- **[VERIFY]** PD-008 A1 checks (c) and (d) and FP-003 V5 on Linux + PostgreSQL 17 with two BFF instances: crash injection (i) after the intent commit and before `dispatched`, (ii) after `dispatched` and before send, (iii) after the LIP commit and before the outcome record; (iv) lock-connection loss while a call is in flight, followed by any other operation on another instance (must be refused by the slot); (v) a delayed zombie send after a refused re-send (the slot must still be held under option B; under option A the engine must refuse it after `not_after`); (vi) stale-worker outcome writes (must not apply).

### R-08 — Engine persistence cost (architectural risk, measured first)
- **Finding (source-read).** Every engine write reloads and rewrites the full state of the café's program, so cost grows with the café's members, ledger, lots and idempotency records. Idempotency records are never pruned (`once()`, `lip_engine_idempotency`).
- **Decision.**
  - **Spike first.** An early, independent benchmark (milestone PM-S, `quickstart.md` §2) measures the **complete proposed workload**, not accruals alone. Every engine call goes through the mutation wrapper, including reads (`packages/server/src/server.ts` ~2587), and `once()` adds a persistent idempotency record per write (`engine.ts` ~2333). So the run includes the public award flow (evaluate preview → accrual), redemption (reserve → capture), customer card reads and polling across several cards, owner dashboard reads, and SLO probe traffic. It uses synthetic cafés of 1k, 10k and 50k members with 12 months of ledger and idempotency growth, on Linux + PostgreSQL 17 on the **budgeted Render service and database sizes**, and records latency, memory, CPU and database connections.
  - **If within budget.** If p95 accrual stays under 500 ms at the projected 12-month café size under SC-005 load, nothing changes.
  - **If over budget.** If not, the remedy is an **incremental-persistence fork patch** to `PostgresEngineRepository`: write only changed rows and keep the same schema and wire semantics. That patch is a new fork patch (candidate FP-004) needing its own owner decision and authorization, and the plan does not assume it.
- **Rationale.** SC-005 (p95 < 500 ms at peak across 100 cafés) and PD-002 exit criterion 3 depend on this. It must be known before Phase 3 code piles up on the engine.
- **Alternatives.** Sharding engine state per member (changes upstream architecture); caching in BFF (does not remove the write cost).
- Also relevant: the SLO test café (R-22) accrues every minute, so its own state grows fastest. The spike includes that growth curve.

## 2. Identity, sessions and devices

### R-09 — OTP service (PD-004, PD-010, PD-020)
- **Decision.**
  - **Codes.** 6-digit codes from `crypto.randomInt`, stored as `HMAC-SHA256(OTP_PEPPER, challenge_id ‖ phone_e164 ‖ code)` and compared with `crypto.timingSafeEqual`.
  - **Rules.** One active challenge per phone, with issuance superseding earlier ones inside a transaction locking the phone identity row. Codes are valid for 5 minutes, the resend cooldown is 60 s, there are at most 5 wrong attempts, and each phone gets at most 5 sends in any rolling 60 minutes, shared across WhatsApp and SMS and all purposes (PD-042), and 10 per day. What counts as one send is still open under F-01 (JG-01) and not chosen here: a WhatsApp send followed by SMS fallback, failed or uncertain dispatches, and concurrent send reservations.
  - **Rate limiting.** Per-IP and per-device limits are kept in Postgres counters (`directory.rate_counters`, fixed windows) so they hold across instances. Turnstile verification happens server-side before the first send.
  - **Circuit breaker.** A platform-wide circuit breaker (`directory.otp_circuit`) keeps a daily count and spend per Cairo day; a trip pauses sending and raises an operator alert.
  - **Purposes.** Every challenge has a **purpose**: customer sign-in, customer phone change, customer deletion, owner sign-in, owner step-up, staff phone verification, or invite acceptance. A code verifies only for its own purpose, so a customer code can never satisfy owner step-up (spec Clarifications).
  - **Channels.** An `OtpChannel` interface has WhatsApp Cloud API (authentication template) and SMS (Egyptian provider chosen before task 2.4, PD-004) adapters, plus a `fake` adapter for tests and staging, so live delivery waits on task 0.11 without blocking development.
  - **SMS format.** The WebOTP format and the one-segment check are unit-tested against the final domain length.
- **Open technical values.** The per-IP and per-device limit values and the circuit-breaker daily caps are not numbered by any approved decision. They are listed as OD-05.

### R-10 — Sessions and CSRF (PD-004, PD-010, Constitution Art. VIII)
- **Decision.**
  - **Session ids.** 32 random bytes in base64url, stored as SHA-256 hashes.
  - **Cookies.** `__Host-` cookies with `Secure`, `HttpOnly`, `Path=/` and `SameSite=Lax`.
  - **CSRF, authenticated.** Each surface has its own session endpoint (`GET /api/v1/customer/session`, `GET /api/v1/owner/session`, `GET /api/v1/staff/session`) that returns the per-session CSRF token. It must be echoed in `X-CSRF-Token` on every state-changing request. The BFF also checks that `Origin` (or `Sec-Fetch-Site: same-origin`) matches the surface host.
  - **CSRF, before sign-in.** Unauthenticated mutations (OTP send and verify, invite acceptance, device enrollment, staff PIN sign-in) use a double-submit token: the same session endpoint sets a short-lived host-only `__Host-pre` cookie holding a random token and returns it in the body, and the request must echo it in `X-CSRF-Token`. The Origin check applies too. A successful sign-in replaces the pre-session token with the session's own (no fixation: the session id is always newly generated at sign-in).
  - **Operator API.** Operator calls use `Authorization: Bearer` OIDC tokens on the `api.` host only. That host accepts no cookies and sets none, so CSRF does not apply. Browser surfaces never call it.
  - **Sliding lifetimes.** Customer sessions slide over 90 days and owner sessions over 30 days. Every session is revocable, and "sign out of all devices" plus phone change revoke every session and device secret.
- **Why `Lax` rather than `Strict`.** Customers arrive by scanning a printed Branch QR, which is a cross-site top-level navigation. A `Strict` cookie would be withheld on that first request and the signed-in customer would look signed out. CSRF is still enforced by the token and the Origin check.

### R-11 — Member QR (Method B, PD-003 A1)
- **Decision.**
  - **Device secret.** At sign-in each customer device receives a 32-byte device secret. The browser imports it as a **non-extractable** WebCrypto HMAC key in IndexedDB. The server stores it encrypted (AES-256-GCM), not hashed, because it must recompute the MAC.
  - **Codes.** The customer device renders two kinds of code, both domain-separated by purpose:
    - **Member code**: `v1.<device_id>.<card_ref>.<counter>.<mac>`, with `mac` = first 16 bytes of `HMAC-SHA256(secret, "lipqr|v1|member|" ‖ device_id ‖ "|" ‖ card_ref ‖ "|" ‖ counter)`.
    - **Reward code** (stamp and points rewards alike, R-16): `v1r.<device_id>.<card_ref>.<reward_ref>.<counter>.<mac>`, with `mac` = first 16 bytes of `HMAC-SHA256(secret, "lipqr|v1|reward|" ‖ device_id ‖ "|" ‖ card_ref ‖ "|" ‖ reward_ref ‖ "|" ‖ counter)`. `reward_ref` is a random BFF reference to either an issued reward (stamps) or a catalogue reward (points).
    - In both, `counter = floor(unix_seconds / 30)`, values are base64url, and `card_ref` is the membership's random public reference, so no tenant id, member id or PII appears in a code.
  - **Server checks.** The server accepts only `counter ∈ {now, now−1}`, which caps validity at 60 s. It also requires:
    - the device to be active and belong to the card's customer;
    - the card's tenant to equal the staff session's tenant;
    - the counter to be strictly greater than the last consumed counter **for that (device, card, purpose)**, updated atomically. This makes each code single-use without coupling different cards or purposes: a scan at café A does not invalidate the code café B's card shows in the same interval.
  - **Rotation.** The device secret rotates whenever the app is online (PD-003 A1). The previous version stays valid until the end of the current and next counter step so a code shown just before rotation still scans.
  - **Device limit.** At most 3 active devices per customer, enforced under a row lock on the customer.
  - **Google Wallet passes.** Out of P0 (P1 task 6.8).
- **Rationale.** This is an offline-capable, server-verifiable, device-bound, single-use code with TTL ≤ 60 s, as PD-003 A1 approves.
- **Alternatives.** RFC 6238 TOTP digits: a shorter MAC, not bound to the card. Server-signed tokens: not offline, superseded by A1.

### R-12 — Staff devices, PIN and owner staff profile (PD-010, PD-014, PD-034, FR-014, FR-016)
- **Decision.**
  - **Device registration.** The owner, signed in on `dashboard.`, creates a single-use enrollment code for a branch (step-up OTP, FR-012 covers staff/device changes). The staff device redeems it on `staff.` and receives a 32-byte device token stored hashed (`bff.devices`), kept in a `__Host-` cookie on `staff.`.
  - **Staff sign-in.** A staff session requires a valid device token **and** a PIN for a staff profile of the same café, allowed at that device's branch (the owner staff profile is allowed at any branch of the café). PINs are hashed with `crypto.scrypt` and a per-profile salt.
  - **Staff profiles.** Profiles carry an OTP-verified phone identity (FR-085). The staff member's first name is personal data and lives in the directory (`directory.staff_people`); `bff.staff_profiles` holds only the reference. FR-028 self-dealing compares the staff profile's `phone_identity_id` with the scanned customer's, inside the directory, without exposing phones.
  - **PIN lifecycle.** A new staff profile has no PIN. After the phone OTP verifies, the owner issues a single-use **PIN setup code** (step-up, bound to that profile, short-lived per OD-01). The staff member enters it once on an enrolled device of an allowed branch and chooses a PIN. This completion is a **bootstrap operation** like sign-in: it needs no staff session and is authenticated by the enrolled-device credential, the valid profile-bound setup code and the pre-session CSRF token (R-10). A PIN **reset** reuses the same mechanism: it clears the PIN hash and failure count, revokes every session of that profile, and is audited. A locked profile (OD-01 lockout) is unlocked only by a reset. A staff member may change their own PIN from a signed-in session by entering the current PIN. The owner staff profile's PIN uses the same setup code, issued from the dashboard with step-up.
  - **Owner staff profile.** Exactly one per café (partial unique index). It is linked to the owner account. Owner-only actions from a staff session require a fresh owner OTP step-up and are audited as overrides (FR-016).
- **Open values (OD-01).** The PIN length, PIN attempt lockout, staff session lifetime and idle timeout, and enrollment-code lifetime are not fixed by an approved decision.

### R-13 — Owner sign-in, invites, step-up and Super Admin (PD-010, PD-011, FR-012, FR-013, FR-015)
- **Decision.**
  - **Invites.** An invite token (32 bytes) is stored as SHA-256, single-use, bound to a phone identity and valid for 72 h. Accepting it requires an OTP to that phone and creates the owner account plus the owner staff profile record (PIN set at first counter use).
  - **Step-up.** A fresh OTP to the owner's phone yields a **step-up grant** bound to one action type and one target, single-use and short-lived (OD-01). The grant is consumed atomically with the action it authorizes.
  - **Super Admin.** OIDC with provider-enforced MFA (provider chosen at task 2.2). `OidcTokenVerifier` (jose/JWKS) **authenticates**; it does not authorize. Authorization is a separate, explicit allowlist `bff.operators (issuer, subject, status, added_by, revoked_at)`. A request is an operator request only when the token's signature, `iss`, `aud`, `exp`/`nbf` and MFA claim (`amr` or the provider equivalent confirmed at 2.2) verify **and** its (`iss`, `sub`) is an active allowlist row. Revocation sets `revoked_at` and takes effect on the next request. Changes to the allowlist are made by an existing operator (the first by a migration-time bootstrap) and audited. Negative tests: a valid MFA-authenticated non-operator, a revoked operator, a wrong audience and a token without the MFA claim are all refused.
  - **Operator tooling.** P0 operator tooling is a CLI (`apps/bff/src/operator-cli.ts`) that signs in with the OIDC device-authorization flow and calls `/operator/v1/*`. There is no console UI (P1 task 6.7).
- **[VERIFY at 2.2]** The chosen provider supports device flow and exposes an MFA claim. If not, the operator transport is decided then (OD-06).

## 3. Loyalty workflows

### R-14 — Purchase capture (PD-008, FR-020–FR-032)
- **Decision.**
  1. **Scan.** Scanning a member QR (or confirming a claim code) creates a **capture session** that consumes the code, resolves the card under RLS and runs every check:
     - stage allows accrual;
     - device, staff and branch are active;
     - the self-dealing check passes;
     - the member is not blocked.

     It assigns a server-generated `order_id` (`p_<ULID>`, PD-008 "BFF owns order_id per scan session").
  2. **Preview.** The cashier enters an amount, which the BFF normalizes from Western, Arabic-Indic or Persian digits to integer piasters. The large-bill re-type and 5× rejection apply. The BFF calls `orders/evaluate` with one synthetic loyalty-eligible line and returns the engine's preview.
  3. **Confirm.**
     - **Admission and pre-accrual snapshot (R-07 steps 1a–1c).** No database transaction is open during the LIP reads.
       - **1a (own transaction).** Branch row `FOR SHARE` with the active checks (early refusal only), then `bff.members` `FOR UPDATE` and the slot inserted `admitting`; commit. If the slot cannot be admitted, nothing is read or sent (`409 member_busy` / `void_in_progress`).
       - **1b (no transaction).** Because no other operation for that member can be unresolved while the slot is held, the BFF reads the member's current balance and issued stamp rewards from LIP (`accounts/get`, `issued-rewards/list`).
       - **1c (own transaction).** Branch row `FOR SHARE` with the branch, device and session checks **repeated** (the binding R-16a check), then `bff.members` `FOR UPDATE` and verification that the slot carries **this admission's token** (`admission_id` from 1a) and is still `admitting`; a reclaimed or re-admitted slot fails here before anything is committed. It then commits, together with the journal intent and the slot moving to `active`, an immutable snapshot on the capture session: balance before, reward marker (the highest issued `stamp-<member>-<n>`), threshold, program revision, the current reward text-version ids per language, and the minimum eligible spend in force (PD-038 P2). If the branch is now inactive (`403 branch_inactive`) or the slot was reclaimed, 1c deletes the slot only if it still carries its own token, the session stays `open`, and nothing is sent. These are the facts PD-008 A1 needs later and cannot be reconstructed after a crash, because threshold issuance records no originating order (`engine.ts` ~1910).
     - **Dispatch.** `accruals` posts with idempotency key `accrue:<order_id>`.
     - **Outcome (transaction 2).** On `confirmed`, one transaction writes the purchase from the snapshot plus the authoritative result (entry id, unit, amount, balance after), marks the session confirmed, and releases the slot. Newly issued rewards are not in the accrual response (`LedgerResponse` carries ledger entries and balances only, `packages/protocol/src/loyalty.ts` ~161), so they are discovered by an `issued-rewards/list` read and materialized with their terms snapshot before the slot is released (R-16).
     - A confirm re-submitted to the BFF for the same capture session returns the session's current state; it never re-sends to LIP. A different amount on the session is `conflict`. LIP's business-id protection also prevents a second accrual of the same `order_id` (FR-026).
  4. **Repeat-award confirmation.** A new capture session for the same card within 10 minutes of a confirmed award at the café requires an explicit confirmation flag, shown with first name and progress only (PD-027). Retries of an existing session never trigger it.
- **Rationale.** This implements PD-008, PD-003 and PD-027 exactly.
- **Uncertain outcome.** If the accrual call is uncertain, the API returns `202 {status:"confirming"}`. The UI never shows success before the accrual is `confirmed`.
  - **No re-send, ever.** Neither the cashier nor any sweeper re-sends an uncertain accrual (PD-038 P8, FR-069, `engine.ts` 611). "Retrying the same submission is safe" is satisfied at the BFF boundary: re-submitting the confirm returns the session's state and never produces a second LIP call.
  - **Short wait.** For a few seconds the BFF keeps the session `confirming` while an in-flight response may still arrive. If none does, the session becomes `unconfirmed`. The cashier sees "not confirmed — do not promise a stamp/points", the customer is never told they earned, and the item appears on the owner's *needs attention* list and the operator report.
  - **Resolution.** Only an authoritative, complete ledger read can resolve it (the FR-069 evidence model, usable only after FP-003 V4 verifies such a read). Until then it stays unresolved for owner/operator handling. Whether the member's slot can be released meanwhile depends on fencing (R-07 step 6, OD-15): under option A, after `not_after` the accrual can no longer commit, so the slot is released and only this purchase stays unresolved; under option B (assumed until decided), the slot stays held and the member is frozen for balance-changing operations until resolution.
  - **Open decision (OD-10).** What the cashier may do while the customer is still present after `unconfirmed` (for example, whether a fresh capture of the same purchase is allowed, which risks a double award if the first accrual did commit), and how the owner closes such items, are owner-visible and are not assumed.

### R-15 — Background work: database sweepers with `SKIP LOCKED`, no in-process `setInterval` correctness (SC-016)
- **Decision.** Every timed job is a sweeper that claims due rows with `SELECT … FOR UPDATE SKIP LOCKED LIMIT n` and performs an idempotent state transition in the same transaction, or journals an idempotent LIP call. Several BFF instances can therefore run the same sweeper and a due item is processed exactly once.
  - **Cross-tenant discovery under RLS.** A sweeper finds due work through narrow `SECURITY DEFINER` functions (`bff.due_work(kind, limit)`) that return only (`tenant_id`, row id) pairs, owned by the non-login `bff_definer` role (hardening in data-model §1). Each item is then processed in an ordinary tenant-scoped transaction under `lip_bff_tenant_runtime`. No sweeper role can read tenant rows directly (data-model §1 policy matrix).

  The jobs are:
  - release reward holds older than 120 s that have **no capture intent**, and holds whose capture failed definitely (R-16);
  - expire pending claims after 15 min;
  - expire pending migrations after 15 min;
  - recover uncertain and lease-expired LIP calls in workflow step order, and mark provably undispatched intents `abandoned` (R-07);
  - reclaim `admitting` member slots whose lease expired with no journal intent, under `bff.members` `FOR UPDATE` in ascending `member_id`, deleting only a slot that still carries the `admission_id` observed (R-07 step 1; a void returns to `requested`, R-17);
  - re-admit `requested` voids that hold no slot, automatically, during the first 15 minutes (PD-008 A1 *Recovery*; R-17);
  - process queued customer erasures (data-model §2);
  - materialize any missing issued-reward terms snapshots (R-16);
  - mark voids *needs owner* at 15 min and *escalated* at 24 h, with alerts;
  - record the daily subscription-stage transition (the stage itself is computed on read, R-19);
  - evaluate fraud alerts (R-21);
  - check the OTP circuit breaker;
  - export SLO results (R-22).

  A single global session lease (`withLease`-style `pg_try_advisory_lock('bff:sweeper:{name}')`) is used only where batching needs it.
- **LIP platform layer.** LIP's own schedulers stay single-instance (PD-002, PD-006: LIP at 1 instance). Making them lease-safe is roadmap 2.7, an upstream change planned as its own track (R-26, OD-04).

### R-16 — Redemption (PD-015, PD-024, PD-025, FR-050–FR-056)
- **Decision.**
  - **Reward credential (BFF-owned).** LIP's automatic threshold issuance stores no bearer artifact (`engine.ts` ~1911; `issueReward` only stores a caller-supplied one, ~682), so there is no LIP code to display. The BFF assigns every issued reward a random, unguessable `reward_ref` in `bff.issued_reward_terms` (UNIQUE, mapped to the LIP `issued_reward_id`); the predictable `stamp-<member>-<n>` id is never shown or accepted. Points rewards get a `reward_ref` per catalogue reward. The customer device renders the device-bound, single-use reward code from R-11. The app cannot reserve or capture (FR-050).
  - **Hold.** The cashier scans the reward code. With the member's slot admitted (R-07), the BFF journals and sends `redemptions/reserve` (stamp rewards by `issued_reward_id`; points rewards by reward id). It stores the **actual reservation response** as the hold's terms; the BFF catalogue mirror is never the source of the held cost. The reservation schema carries no catalogue revision (`packages/protocol/src/loyalty.ts` ~195), so the consistency check compares only fields LIP returns: the reward id and the reserved cost. For a points reward, if the reserved cost differs from the cost the cashier was shown, the hold is released through the journal (`409 reward_terms_changed`) and the cashier retries against the refreshed mirror. For an issued stamp reward the reserved cost is 0 by design and the shown terms are the immutable issuance snapshot, so no comparison applies. **[VERIFY at S-2]** the exact reservation response fields.
  - **Capture or release, serialized.** Capture (`confirm hand-over`) and release (cashier cancel, 120-s timeout, branch deactivation) are journaled steps of the same redemption workflow, so at most one of them is ever dispatched first. Every capture outcome is defined:
    - **Captured** → `captured` (terminal).
    - **Definite refusal of the original capture** (for example `insufficient_balance`, which LIP can return after a hold, `engine.ts` ~850) → `capture_failed`; the hold is then released by the next workflow step, immediately, without waiting for the timer.
    - **`expired`** → `expired` (terminal; R-16 backstop).
    - **Uncertain** → re-sent with the same key until a re-send succeeds or the original's fate is fenced (R-07 steps 4–6). A refused re-send does not end it.
    - The cashier UI says "do not hand over yet" until `captured`.
  - **The 120-second rule (FR-054) — OD-16.** FR-054 says a hold "not confirmed within 120 seconds" is released automatically. The plan reads a cashier's confirmation **submitted** (capture intent committed) before 120 s as "confirmed within 120 seconds": such a hold is never released by the timer, and the capture completes, fails definitely or is fenced as above. A hold with no capture intent at 120 s is released. Because this reading decides what happens at the boundary, it is put to the owner as OD-16 rather than assumed final.
  - **LIP expiry is a backstop only.** LIP `reservation_ttl_seconds` is set well above the BFF window (proposed 600 s), so the BFF always releases first. If LIP nevertheless answers `expired` (to a capture or release), the redemption moves to the terminal state `expired`; a capture answered `expired` is shown to the cashier as not captured. **[VERIFY at S-2]** that LIP expiry restores the issued reward or points exactly once and that a capture after expiry is refused.
  - **Issued-reward terms snapshot (FR-046).** After a confirmed accrual, and before the member's slot is released, the BFF lists the member's issued rewards (`issued-rewards/list`), and for each one with no `issued_reward_terms` row writes the snapshot: cost from LIP, and display texts from the **text-version ids recorded in the capture snapshot** (not the program revision, which a text-only edit does not change). Display texts are append-only versions (`reward_text_versions`), so a snapshot materialized later by the recovery sweeper after a crash still uses the texts in force at the purchase. A text edit made between admission and issuance is, by this definition, after the purchase and does not apply to it.
  - **One reward per order.** A partial unique index on `bff.redemptions(tenant_id, order_id)` over non-released rows.
  - **Redemption-only visits.** These use a zero-value synthetic order `r_<ULID>`, which is never accrued.
- **[VERIFY at task 3.4]** Hold cost is fixed at hold time. Reserve and capture work with a zero-value synthetic order. Capture from another branch is refused by the BFF.

### R-16a — Branch-operation barrier (FR-081)
- **Decision.** Every counter operation re-checks, **in the same transaction that commits its journal intent**, that its branch is active and its device and staff session are valid, taking `SELECT … FOR SHARE` on the `bff.branches` row. Deactivation takes `FOR UPDATE` on that row. For an operation admitted in two transactions (R-07 1a/1c), the check in 1a is only an early refusal; the binding check is repeated in 1c, the transaction that commits the intent, and a 1c that finds the branch inactive deletes its own `admitting` slot (only by its `admission_id`) and sends nothing. The two therefore serialize:
  - An operation whose intent committed **before** deactivation is a legitimate in-progress operation. Deactivation's enumeration includes it: an award completes or follows R-14; a reserve intent is marked `release_pending`, resolved forward, then released; a hold with **no** capture intent is released; a hold **with** a capture intent is never released by deactivation — it resolves forward to `captured`, or to `capture_failed` and then release.
  - An operation that reaches its intent commit **after** deactivation is refused with `branch_inactive`, however long ago it was validated.
  - **Lock order and transactions.** Deactivation's branch-lock transaction only changes branch, device, session, QR and claim rows and **enqueues** cleanup work; it never admits member slots. Each release then runs as its own workflow, admitting the member slot in its own transaction (global lock order, data-model §6).
  - **System cleanup is not a counter operation.** The releases, claim cancellations and recovery steps that deactivation itself creates are journaled under the deactivation's `workflow_ref`, authorized by it, and are **exempt** from the active-branch, device and session checks. Recovery steps of an operation admitted before deactivation are likewise exempt; only new counter operations are refused.

### R-17 — Stamp void (PD-008 A1, PD-003 A2, FR-060–FR-067)
- **Decision.** Implement exactly the approved algorithm:
  1. **Admission (V-a, own transaction).** A cashier void requires the same staff member and an age under 10 min. Locks in the global order: for a void started on a staff device, the branch row `FOR SHARE` with the active checks; then `bff.members` `FOR UPDATE` (refused with `member_busy` while `erasure_state = 'erasing'`). The void is admitted only if the member has **no** `member_ops` slot, **no** `member_blocks` row and **no non-terminal redemption** (`holding`, `held`, `capturing`, `capture_failed`, `releasing`, `release_pending`); otherwise `409 member_busy` (retryable; an open hold ends within the FR-054 window) or `409 void_in_progress`. It inserts a `member_ops` slot of kind `void` (`admitting`, `op_ref` = void id, a fresh `admission_id`) and the void row in `requested` (on a re-admission the existing `requested` row is kept); commit. Nothing is sent. A member whose `erasure_state = 'erased'` is refused with the final error `410 member_erased` (not retryable, audited); no void row is created.
     - From this commit on, no accrual, reserve, capture, release, adjustment, migration or other void can be admitted for the member, so no call of ours can change the member's LIP state until the void is completed. The redemption check closes the one gap the slot alone leaves: a hold whose reserve already completed holds no slot between its steps.
  2. **Precondition reads (V-b, no transaction).** Read from LIP the current balance, issued rewards and program revision (`accounts/get`, `issued-rewards/list`) and evaluate: no republish since the purchase; 0 ≤ cur < t; at least k cancellable `stamp-<member>-<n>` candidates above the marker.
  3. **Plan commit and handover (V-c, own transaction).** Same lock order (branch `FOR SHARE` with the checks repeated, for a device-started void; then `bff.members` `FOR UPDATE`); verify the slot carries **this admission's token** and is `admitting` (otherwise abort before any plan is committed, nothing sent) and re-verify no non-terminal redemption. If the branch of a device-started void is now inactive, the slot is deleted by its token and the void goes to `blocked_needs_owner` (reason `branch_inactive`, no plan, no block); the owner can void from the dashboard, which is not branch-bound. Then, in this one transaction, either:
     - **a precondition failed** → the void goes to `blocked_needs_owner` with no plan and no block, and the slot is deleted; or
     - **all passed** → compute and persist the plan once (cur, a, t, k, chosen reward ids, exact request bodies) with all step intents, insert `bff.member_blocks`, and delete the `member_ops` slot. The member is therefore held continuously: by the slot from V-a to V-c, by the block from V-c until `completed`.
     - A crash between V-a and V-c, or a reclaim of a slow admission, leaves the void `requested` with no slot (the sweeper deletes the slot by its token, R-15). Nothing was sent and no plan exists, so re-running admission recomputes nothing from an earlier attempt:
       - **Automatic:** the sweeper re-admits a `requested` void without a slot during the first 15 minutes (PD-008 A1 *Recovery*: automatic retries for 15 minutes). A re-admission of a device-started void whose branch is now inactive sends it to `blocked_needs_owner` (reason `branch_inactive`).
       - **Manual:** repeating the void request for the same purchase (one void per purchase), or the owner's retry (`POST /voids/{id}/retry`), re-runs admission at any time.
       - At 15 minutes a void still not completed (including `requested`) becomes *needs owner*, and at 24 hours *escalated*, as for any void.
  4. **Execute.** Cancel (`void:<void id>:cancel:<reward id>`), then void (`void-<void id>`), then restore (`void-<void id>-restore`), each journaled.
  5. **Reconcile.** Check the expected effects in `issued-rewards/list` and `ledger/list`. Only success deletes the block, in the same transaction that marks the void `completed`.
  6. **Escalation.** *Needs owner* at 15 min, Super Admin escalation at 24 h. Owner settlement is a journaled `correction` adjustment that is itself reconciled.
- **Testing.** Each of C1–C8 gets an executable test. Checks (a)–(f) run on Linux + PostgreSQL 17 before task 3.6 is done.
- **Member ids.** Fixed-format member ids (`m` + 26-char Crockford ULID, no hyphen) make `stamp-<member>-<n>` parsing unambiguous (check (e)).

### R-18 — Points void: built fail-closed and **disabled** until FP-003 is authorized
- **Decision.**
  - **What is built in P0.** The points-void *workflow shell*: authorization (FR-060), durable member admission slot and block, journal, the accrual-evidence model (FR-069 states), reconciliation framework and escalation timeline.
  - **What is disabled.** The step that posts a points reversal is behind a server-side capability flag `points_void_execution`, which stays **off** in every environment until all FP-003 gates have passed:
    - (a) an owner-approved point-lot attribution algorithm;
    - (b) source-level verification;
    - (c) V1 regression tests covering both the void and the redemption over-debit cases;
    - (d) V2–V4 and V7;
    - (e) separate FP-003 implementation authorization.

    V5/V6 and SC-017 are additionally required before any points café joins the pilot.
  - **Behaviour while off.** A points void request is refused with `points_void_unavailable`, audited, and **posts nothing to LIP**. It does not create a member block, because no plan exists. No code path computes the candidate formula `−max(0, E + A − X)` as an amount to post. The formula is never presented as proven safe.
  - **Accrual evidence reader.** The FR-069 reader (complete `ledger/list` paging while the member is blocked) is built only as a verification harness for V4. Until V4 passes, every missing accrual result is *uncertain*.
- **Production guard (OD-02, owner decision).** Recommended: the BFF refuses to **publish a points program for a non-test production café** while `points_void_execution` is off, so no real customer can be stuck with an unvoidable points purchase. This enforces the existing gate (SC-017 before any points café joins the pilot) rather than adding a product rule, but it is owner-visible, so it is asked rather than assumed.

### R-19 — Subscription stages and billing (PD-005 A1/A2, PD-017, PD-035)
- **Decision.**
  - **Where it lives.** Payments, plan assignment, period end and the stage engine live in **our layer** (`bff` schema, operator-only). The Cloud subscription stays `active` with `billing_provider:"manual"`, and P0 never posts Cloud usage events. No Cloud fork patch is needed. The approved "set manual subscription" fork patch (PD-005 A1 item 10) stays unused unless task 5.5 finds a need, and it would be logged as a fork patch then.
  - **Stage computation.** The stage is a pure function computed **on every request**: `days = cairo_date(now) − period_end_date`, giving active (≤ 0), grace (1–7), read-only (8–37) and suspended (≥ 38). This needs no scheduler to be correct. A daily sweeper only audits transitions.
  - **Enforcement.** One `stagePolicy(action, stage)` table mirrors the PD-005 A2, A3 and A4 tables cell for cell (72 cells), with a 100%-cell test (SC-008). *(Pending Gate 2 revision for PD-005 A5, owner-approved 2026-11-14: 75 cells, [gate2-branding-revision.md](gate2-branding-revision.md) §5.5; not approved.)*
  - **Payments.** Payments are append-only, with a stable `payment_id` supplied by the operator tool (double submit records once) and reversing entries. Plan and period changes are audited before/after.
- **Rationale.** PD-005 A2 forbids implementing stages via Cloud suspension, Cloud subscription status or LIP write-freeze. Keeping Cloud `active` and unmetered removes the 402/429 risk from the join, award and redeem paths (FR-095).
- **[VERIFY at 5.5]** That at runtime no Cloud path refuses an active manual subscription with no usage events.

### R-20 — Plan-limit monitoring (PD-035, PD-038 P9, FR-095)
- **Decision.** Plan limits (task 1.6 values) live in `bff.plans`. Usage is counted from our own tables: active memberships, active branches, and messages (OTP is excluded as a platform cost, PD-004). The counts are exact and uncapped, and the test café is excluded. They are exposed through `GET /operator/v1/cafes/{id}/usage`. Nothing in the join, branch, staff or message paths reads a limit.

### R-21 — Fraud alerts (PD-027, FR-110–FR-113)
- **Decision.**
  - **Evaluation.** Rules are evaluated **after** commit, from confirmed purchase, redemption and claim rows, by a sweeper (never in the request path, so they can never block).
  - **The three rules.**
    - Rapid awards: more than 3 confirmed awards to one card in a rolling 60 minutes.
    - Out of hours: an award, redemption or claim confirmation more than 30 minutes outside the branch's Cairo opening hours, with overnight intervals spanning midnight.
    - Staff concentration: at least 20 awards by one staff member in a rolling 7 days, with more than 40% going to their top 3 cards.
  - **Retries.** Idempotent retries never create rows, so they cannot trigger alerts.
  - **Deduplication.** FR-111 says alerts are "deduplicated by rule, subject and window" but does not define overlapping windows. The plan's recommended reading (at most one open alert per (rule, subject) whose window overlaps a new trigger; a new alert only after the previous window has ended) changes what owners see, so it is raised as **OD-14** rather than assumed.

### R-22 — Visits, attribution and SLO measurement (PD-032, PD-033, PD-038 P2–P6)
- **Decision (visits).** Visits are **derived on read**, never stored as accounting records (Key Entities). They come from SQL views over `bff.purchases`:
  - **Qualifying purchase.** It must be accrued, not voided, not in a test café, and have `amount_minor ≥ min_eligible_spend_at_capture`. Its channel is always `counter`, which the program marks eligible.
  - **Visit.** `(tenant, membership, cairo_date(captured_at))`. It is attributed to the branch of the minimum `(captured_at, purchase_id)` (P4), so voids recompute attribution automatically.
  - **Cohort reports.** The repeat rate and acquisition-branch cohort reports (P5) are views on the same base.
  - **View security.** Every view is created `WITH (security_invoker = true)` (PostgreSQL ≥ 15), so the caller's RLS policies on the base tables apply. No view is owned by a role that bypasses RLS and is read without invoker security. The isolation suites query the views themselves, not only the base tables.
  - **Cairo dates.** Cairo dates use `AT TIME ZONE 'Africa/Cairo'`.
  - **[VERIFY]** Postgres tzdata includes Egypt's DST rules on Render and in `postgres:17-alpine`. Covered by Cairo-midnight and DST boundary tests (task 4.5).
- **Decision (SLO probe).** A synthetic prober performs, every minute in the 08:00–02:00 Cairo window, one real award and one real redemption in the test café through the **public** production path (Cloudflare → web `/api` → BFF → LIP).
  - **Credentials.** It uses test-only staff and device credentials and a test customer device secret.
  - **Test café program.** The test café runs a stamp program with threshold 1, so every award issues a reward to redeem, configured by operator tooling and not by the wizard.
  - **Results.** Each minute's results are `success`/`failure` per operation. Missing minutes are gaps. Reports compute M, O, S, coverage and PASS / FAIL / INSUFFICIENT DATA exactly as SC-012 and P6 define, in a pure function with DST-day tests. Outages over 5 minutes are derived from consecutive failures and logged for weekly review.
  - **Where the prober runs: OD-03.** Recommended is a Cloudflare Worker cron trigger (external vantage point, free plan) writing results to Cloudflare D1, imported daily by a BFF sweeper. The alternative is a prober inside the BFF host, which is cheaper and simpler but measures less of the path, and while the host is down the probe cannot record its own failures. That would show up as gaps rather than failures. This choice touches PD-006's budget and vendors, so it is asked.

## 4. Data, quality and operations

### R-23 — Migrations
- **Decision.** Add a fourth migrator for the BFF using the FP-001 pattern: transaction-scoped `pg_advisory_xact_lock(hashtextextended('lip:bff:schema-migrations',0))` before `CREATE TABLE IF NOT EXISTS bff_schema_migrations`, with forward-only numbered SQL files under `apps/bff/migrations/`. The directory schema uses the same runner with its own table, `directory_schema_migrations`, and the lock key `lip:directory:schema-migrations`.
  - **When they run.** A pre-deploy command (Render `preDeployCommand`), plus a startup check that refuses to boot on pending migrations.
  - **Startup probe.** At startup, a probe like `assertTenantIsolationEnforced` confirms FORCE RLS and non-bypass roles on every `bff`/`directory` tenant table. Boot is refused otherwise.
  - **Pooling.** No transaction-mode pooler (`assertSessionLeaseCompatibleUrl` is reused).

### R-24 — Testing (Constitution Art. VII)
- **Decision.**
  - **Unit and integration.** Vitest, using the existing root config, which already includes `apps/**/*.test.ts`. Coverage is extended to `apps/bff/src/**` with the repository thresholds (lines 85, branches 75).
  - **Postgres tests.** Gated by the existing `LIP_TEST_POSTGRES_URL`. CI already fails on any skipped test.
  - **Concurrency tests.** These start **two BFF instances** against one database.
  - **End-to-end.** Playwright (new dev dependency, behind the dependency gate) against the compose stack, with Arabic RTL screenshots for the visual check.
  - **Load.** k6, or an equivalent run outside the repository's dependency tree, for task 5.2.
  - **Characterization.** Characterization tests of upstream behaviour run through `LipClient` against a real managed data plane. They cover the PD-008 A1 checks, the `stamp-` naming, `ledger/list` ordering and paging (V4 input), and hold cost.

### R-25 — Observability, backups, deployment
- **Decision.**
  - **Logging.** Structured JSON logs to stdout, following the upstream style. They carry `request_id`, `tenant_id`, actor ids and operation, and **never** a phone number, name, OTP, code, token or QR payload. A redaction unit test asserts this.
  - **Metrics.** Prometheus text at `/metrics`, private-network only, for request latency per route, LIP call outcomes, uncertain calls, open member blocks, voids by state, OTP sends and circuit state, and sweeper lag.
  - **Health.** `/health` for liveness. `/ready` checks the database, migrations applied, the RLS probe and LIP reachability.
  - **Backups.** Render Postgres PITR (7 days), with a restore drill per task 5.3 using the existing `cloud:restore-verify` checks extended to the `bff` and `directory` schemas.
  - **Deployment.** Docker images on `node:22-alpine` (digest-pinned, as upstream). Render services are created through `render.yaml`, extended with the BFF and web services.
  - **Release gate.** Before pilot: a dependency audit, an OS-package image scan, and live readiness checks (SC-015).

### R-26 — Roadmap 2.7 (LIP platform-layer multi-instance safety, G-11) — separate track
- **Finding.** P0 uses none of LIP's campaign, segment or engagement features and keeps no PII in `/platform/v1`. The LIP runtime stays at one instance (PD-006). SC-016 covers "every scheduler and the webhook dispatcher" being multi-instance safe.
- **Decision.** All **BFF** schedulers are multi-instance safe by design (R-15). The upstream part of 2.7 (LIP schedulers under `withLease()`, and moving the platform JSON state to RLS tables) is an upstream modification. It is planned as its own track with its own fork-patch entry and authorization. Whether P0 needs the full G-11 storage migration or only the scheduler leases is **OD-04**.

## 5. Open owner decisions raised by planning

These are not assumed anywhere in the plan. Each blocks only the tasks named. The *Recommendation* column is a proposal for the owner, **not an approved default**: until an OD is decided its tasks stay blocked, except where the plan states a fail-closed baseline (OD-15 B, OD-17 "never"), which applies only until the decision.

| ID | Question | Recommendation | Blocks |
| --- | --- | --- | --- |
| OD-01 | Staff PIN length, wrong-PIN lockout, staff session lifetime/idle timeout, device enrollment-code and PIN setup-code lifetimes, owner step-up grant lifetime; whether issuing a device enrollment code or a PIN setup code needs owner step-up (FR-012 lists staff create/deactivate, not these); whether staff may change their own PIN from a signed-in session | 6-digit PIN; lock the profile after 5 wrong PINs until the owner resets it (R-12); staff session ends at 12 h or 30 min idle; enrollment and PIN setup codes 10 min; step-up grant single action, 5 min; step-up for enrollment and PIN setup codes (conservative); staff self-service PIN change allowed with the current PIN | 2.6, owner step-up flows |
| OD-02 | Refuse publishing a points program for a non-test production café while FP-003 is not authorized and SC-017 has not passed? | Yes (R-18) | 3.7 production configuration |
| OD-03 | Where the SLO prober runs | Cloudflare Worker cron + D1 (R-22) | FR-155, 5.6 |
| OD-04 | Scope of roadmap 2.7 in P0: only scheduler leases, or also the G-11 platform-state storage migration | Leases only for P0, because P0 uses no `/platform/v1` feature; G-11 storage before P1 campaigns | 2.7 |
| OD-05 | Per-IP and per-device OTP limits and the circuit-breaker daily caps (count and EGP spend) | Per IP 20 sends/hour; per device 10 sends/hour; caps set from task 1.6 pricing | 2.4 |
| OD-06 | Super Admin operator transport if the 2.2 provider lacks device flow or an MFA claim | Decide at 2.2 | operator tools |
| OD-07 | FR-160 "share of customers who joined by staff scan versus branch QR": joining is always via Branch QR (US1), so what does "joined by staff scan" mean — the capture method of the customer's first qualifying purchase? | Report by the capture method of the first qualifying purchase (staff scan vs confirmed claim) and record both join source and first-capture method | 4.5 |
| OD-08 | A technical length cap on the first name (FR-019 adds no name rules) | 1–60 characters after trimming, as a storage safety bound only | 2.3 |
| OD-09 | Engine persistence remedy if the R-08 spike misses SC-005 | Raise candidate FP-004 (incremental persistence) as its own decision | Phase 3 start |
| OD-10 | An award whose accrual outcome is uncertain becomes `unconfirmed` and is **never re-sent** (fixed by PD-038 P8 / FR-069, not a choice). Open: (a) may the cashier start a **fresh capture** for the same purchase while the customer is present, accepting a double-award risk if the first accrual did commit? (b) how does the owner close an `unconfirmed` item before V4 makes ledger evidence usable (leave open; or resolve with an existing `service_recovery`/`correction` adjustment after checking the customer's card)? | (a) No — the cashier tells the customer the stamp/points are pending review; (b) leave open on *needs attention* and let the owner use an existing adjustment only after viewing the card's current balance | 3.3, 4.4 |
| OD-11 | Does an owner void started from the dashboard (not from the owner staff profile) need fresh owner authentication? FR-016 requires it from the staff profile; FR-012 does not list voids | Yes, for consistency with FR-016 | 3.6, 4.4 |
| OD-12 | FR-029: "3 wrong codes cancel the claim", but the cashier types only a code, so a wrong code identifies no claim (or the wrong one). How is a wrong attempt attributed without a customer list (PD-003)? | Make the claim code two parts, e.g. `47-83`: a **claim number** unique among the branch's open claims, plus a **check part** known only to the customer's app. A typed claim number with a wrong check part counts against that claim, and the 3rd cancels it (FR-029 as written). A typed claim number that matches no open claim counts against no claim but is rate-limited per device. Alternative (needs a spec change): count wrong codes per device instead of per claim | 3.5 |
| OD-13 | Lifetime of an open (unconfirmed) capture session, and supersession rules | A session expires 15 minutes after its last action; a newer scan of the same card on the **same device** abandons only that device's open session; sessions on other devices are never touched | 3.3 |
| OD-14 | FR-111 alert deduplication when windows overlap (R-21) | At most one open alert per (rule, subject) whose window overlaps the new trigger; a new alert only after the previous window ends | 3.8 |
| OD-15 | Fencing of uncertain LIP calls (R-07 step 6). (A) authorize a small, **conditional** dispatch-deadline fork patch (candidate FP-005): the managed data plane accepts an optional **private-network HTTP header** (for example `X-Lip-Not-After`) on the runtime path and refuses a write whose program-locked `mutate` transaction starts after that instant. No `/lip/v1` request or response schema changes (`RequestContextSchema` stays closed); a request without the header behaves exactly as today. A is available only if the owner judges this header an allowed behaviour addition under `07-fork-patches.md`; if it is judged a wire change, A is withdrawn and only B remains. (B) no upstream change: a member with an unresolved call (notably an uncertain accrual before V4) is frozen for balance-changing operations until it is resolved, with the recovery and escalation path in R-07 step 6; any operator release, and the escalation timing, need owner approval | A (conditional as stated). Until decided the plan uses B as a temporary fail-closed baseline, **not** as accepted production behaviour; A needs its own fork-patch entry, authorization and tests | 3.3, 3.4, 3.6, PM-3 exit |
| OD-16 | FR-054 boundary: does a cashier confirmation **submitted** before 120 s (capture intent committed) count as "confirmed within 120 seconds", so the timer never releases that hold while the capture completes, fails or is fenced? | Yes; a hold with no capture intent at 120 s is released; a definitely failed capture is released at once | 3.4 |
| OD-17 | Within the capture flow (seconds after the cashier's confirm, customer present), may the BFF re-send an uncertain accrual with the **same idempotency key and byte-identical body**? Engine evidence suggests single effect (successes cached, `accrualsByOrder` returns the existing entry for the same order and facts, `engine.ts` ~611–624, ~2339–2359), but FR-069 / PD-038 P8 forbid re-sending as void-time recovery and the plan extends that conservatively | Keep "never" until decided; if permitted, only inside a short window while the cashier waits, same key and body, never in the background, and only after S-2 confirms the single-effect behaviour | 3.3 |
| OD-18 | Owner award above 5 × the large-bill threshold (FR-016, PD-008): which adjustment classification and stage policy apply, and what happens in a **stamp** program, where FR-065 / PD-008 A1 C5 keep any adjustment within [0, t) and an adjustment never issues a reward or creates a visit (FR-159)? | Points: `bonus` classification under the normal stage policy; stamps: decide between refusing above 5× for stamp cafés or capping the award at what keeps the balance in [0, t) | 3.3, 3.6 |

## 6. Review residuals (recorded for the final verdict)

Codex Sol reviewed this plan in two read-only rounds (the debate limit). Round 1: REVISE (23 findings). Round 2: REVISE; it confirmed #4, #6–#8, #13–#17, #19–#23 resolved and the FP-003 restriction intact, and left open #1, #2, #3, #5 (blocking), #9–#12 (high), #18, #25 (medium) and a new blocking #24 (no fencing against a delayed request after a refused re-send). After round 2, without a further Sol round, the plan was revised as follows:

| Sol R2 item | Response |
| --- | --- |
| #1 accruals bypassing the barrier | Replaced the barrier by a durable per-member admission slot covering **every** balance-changing operation, accruals included (R-07 step 1) |
| #2 permanent refusal after an undispatched accrual intent | `intent` rows never marked `dispatched` are provably unsent and become `abandoned`; truly uncertain calls are fenced by OD-15 option A, or fail closed under option B (explicitly an owner decision) |
| #3 unstable snapshot and permanent `snap_clean` restriction | Snapshot taken after slot admission, so no unresolved call can change it; `snap_clean` and the extra void precondition removed |
| #5 120-s boundary and failed captures | Every capture outcome defined (`capture_failed` → immediate release); the boundary reading raised as OD-16 |
| #9 nonexistent revision / issued rewards not in accrual response | Comparison uses returned fields only; issued rewards discovered by `issued-rewards/list`; text-version ids stored in the capture snapshot |
| #10 cleanup blocked by deactivation | System cleanup and recovery steps exempt from active checks (R-16a) |
| #11 definer RLS and hardening | Definer policies, `pg_temp` last, schema-qualified names, `REVOKE EXECUTE … FROM PUBLIC`, positive and negative tests (data-model §1) |
| #12 erasure relying on advisory locks | Erasure admitted through the durable member slots and a directory-side join fence (data-model §2) |
| #18 PIN setup needing a session | PIN setup completion is a device-and-code-authenticated bootstrap operation (R-12, staff-api) |
| #24 zombie after refused re-send | A refused re-send no longer ends an uncertain call; fencing is OD-15 (upstream deadline patch, or fail closed) |
| #25 time-dependent index predicate | Index on status only; time cut-off in the query (data-model) |

### Final verdict (Fable 5.1 High, read-only) and follow-up

Verdict: **APPROVED WITH CONDITIONS** (before `/speckit-tasks`). The text conditions were applied afterwards, without a further review round:

| Condition / finding | Response |
| --- | --- |
| C1 / F1: DB transaction spanning LIP reads | Admission split into 1a (slot, own transaction), 1b (reads, no transaction), 1c (snapshot/plan + intent); stale `admitting` slots reclaimed (R-07 step 1) |
| C2 / F2: OD-15 A not an eligible fork patch | Respecified as an optional runtime-path header checked inside the program-locked `mutate` wrapper, no schema change; withdrawn if judged a wire change |
| C3 / F3, F8: unlisted decisions | OD-17 (capture-flow same-key accrual re-send) and OD-18 (owner award above 5×, stamp case) added |
| C4 / F6, F7: lock order; deactivation vs capture intent | Global lock order in data-model §6; deactivation enqueues cleanup and never releases a hold with a capture intent |
| C5 / F9: provenance of staged and untracked files | `.gitattributes` was already staged (`A`) and the `.claude/skills/speckit-*`, `.delegate/`, `.scratch/`, `.specify/integrations/claude.manifest.json` entries were already untracked in the git status captured at the start of this session, before planning began; planning staged nothing. The owner confirms. |
| D1–D4 (planning-gate closure assessment, after the verdict) | D1: R-14 step 3 rewritten as R-07 1a/1b/1c. D2: the binding branch check repeated in 1c, the intent-commit transaction (R-07, R-14, R-16a, data-model §6, staff-api gate order). D3: void admission through a `member_ops` slot of kind `void` with an open-redemption check, atomic handover to `member_blocks` in V-c (R-17, data-model §2/§4/§5/§6); erasure also waits for a void slot. D4: OD-15 row states the conditional private-header approach. Option B marked a temporary baseline with a recovery and escalation path. |
| Targeted verdict after D1–D4 (findings 1–7) | 1: fresh `admission_id` per admission, verified exactly in 1c and V-c under the `bff.members` lock; every slot delete conditioned on it; regression scenarios E18 (vi-f). 2: `expired` as a conditional definitive outcome in R-07 step 4, effective only after S-2 verifies it, fail closed until then; no FP-005 change; E18 (vi-g). 3: erasure waits for every non-terminal void (terminal = `completed`, `refused_unavailable`), including a `requested` void with no slot or block; `410 member_erased` for admissions after erasure; E15. 4–7: account-deletion row aligned; owner retry covers `requested` voids; automatic re-admission within 15 min; reclaim lease and ascending `member_id`; V-c on an inactive branch → `blocked_needs_owner`. Residual: erasure also waits on a `blocked_needs_owner` void (conservative reading of FR-008 "in progress"); it stays on *needs attention* and escalates per PD-008 A1. |
| F4, F5, F10–F16 | Reservation-expiry bound stated; per-attempt outcomes; stale OD counts fixed; step-up and PIN self-change folded into OD-01; per-setting stage cells deferred to a task-level enumeration (noted in owner-api); entry gates add 0.7/0.8 and `/speckit-checklist`; `source` pinned and `safeToRetry: false` tested; post-`dispatched` crash added to K-5b and E18 |
