---
name: lip
description: >-
  Loyalty Interchange Protocol (LIP) router. Use when integrating restaurant
  loyalty, earning or redeeming points, checkout lifecycle, webhook receivers,
  the lip CLI, TypeScript SDK, BFF patterns, refunds, program definitions,
  or conformance testing. Routes to the right LIP skill for the task.
---

# LIP Skills Router

LIP is a **transaction protocol**, not a customer auth platform. Apps use a
backend-for-frontend (BFF) that holds the merchant API key; LIP holds the ledger.

Read [`llms.txt`](../../llms.txt) first. When docs and `spec/` disagree, `spec/` wins.

## By task

| Task | Skill |
| --- | --- |
| CLI: serve, doctor, test, validate | `lip-cli` |
| TypeScript SDK, LipClient, idempotency | `lip-sdk` |
| Checkout: evaluate, reserve, accrue, capture, refund | `lip-checkout` |
| Webhook delivery and verification | `lip-webhooks` |
| Mobile/web app + BFF integration | `lip-bff` |
| Conformance, schema validation, testing | `lip-conformance` |

## Quick navigation

- `/lip-cli` — terminal workflows
- `/lip-sdk` — application client
- `/lip-checkout` — earn and redeem lifecycle
- `/lip-webhooks` — signed CloudEvents
- `/lip-bff` — customer app pattern (BFF reference)
- `/lip-conformance` — doctor, test, validate

## Pitfalls (do not implement against `/lip/v1` core directly)

- Customer OTP, social login, or sessions (keep in your BFF; see `docs/context/01-decisions.md` PD-004 for our BFF-owned WhatsApp/SMS OTP flow)
- Campaigns, segments, CRM, or messaging inside `/lip/v1` (the reference platform exposes these outside `/lip/v1` under `/platform/v1/*` and `/admin/api/v1/*`)
- Program editing on `/lip/v1` (`/lip/v1/programs/get` is read-only; runtime program draft, validation, publish, and rollback live on `/admin/api/v1/program/*`, in addition to boot-time `--program`)
- Client-side points math when `orders/evaluate` is available
