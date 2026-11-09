# Domain Documentation & Context Map (`docs/agents/domain.md`)

How engineering skills (`grill-with-docs`, `domain-modeling`, `tdd`, `diagnosing-bugs`, `code-review`, `improve-codebase-architecture`, `to-spec`, `to-tickets`, `wait-what`) consume and update domain documentation in this repository.

## 1. Authoritative Domain Files (No Root `GLOSSARY.md` or `docs/adr/`)

This repository uses an established context pack under [`docs/context/`](../context/README.md). **Do NOT create a duplicate root `GLOSSARY.md`, `GLOSSARY-MAP.md`, or `docs/adr/` directory.**

Whenever a skill refers to `GLOSSARY.md` or `docs/adr/`, use these authoritative LIP files instead:

| Concept in Skills | Authoritative File in This Repository | Rules |
|---|---|---|
| **Domain Glossary (`GLOSSARY.md`)** | [`docs/context/05-glossary.md`](../context/05-glossary.md) | Canonical Arabic/English domain and `/lip/v1` protocol terms. Update inline when new domain terms are settled. |
| **Architectural Decisions (`docs/adr/`)** | [`docs/context/01-decisions.md`](../context/01-decisions.md) | Decision log (`PD-001` through `PD-009`+). Strictly distinguish **Approved**, **Proposed**, **Rejected**, and **Superseded**. Only **Approved** decisions are binding. Never modify an Approved decision or promote a Proposed decision without explicit user approval. |
| **Business Rules & Invariants** | [`docs/context/04-business-rules.md`](../context/04-business-rules.md) | Binding `MUST` invariants for tenancy (`lip.tenant_id` RLS), privacy/PDPL, EGP integer piasters, `+20(10\|11\|12\|15)XXXXXXXX` phone format, QR flows, staff controls, locale (`Africa/Cairo`, Arabic RTL), OTP, messaging, and subscriptions. |
| **Upstream Fork-Patch Log** | [`docs/context/07-fork-patches.md`](../context/07-fork-patches.md) | Log of every modification to upstream LIP code/behavior (`FP-001`+). Product SaaS extensions (`apps/bff`, `apps/web`, or dedicated SaaS extensions) are not classified as upstream patches unless they alter existing upstream LIP code/behavior. |
| **Architecture & Gap Context** | [`docs/context/00-product-brief.md`](../context/00-product-brief.md), [`02-lip-architecture-map.md`](../context/02-lip-architecture-map.md), [`03-gap-analysis.md`](../context/03-gap-analysis.md), [`06-roadmap.md`](../context/06-roadmap.md) | Product scope, LIP module mapping, tracked gaps (`G-01`..`G-14`), and phased execution roadmap. |

## 2. Order of Authority When Files Disagree

1. [`docs/context/01-decisions.md`](../context/01-decisions.md) (Approved decisions)
2. [`spec/`](../../spec/) (LIP normative `/lip/v1` protocol specification)
3. [`docs/context/04-business-rules.md`](../context/04-business-rules.md)
4. [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) and [`AGENTS.md`](../../AGENTS.md)
5. All other documentation
