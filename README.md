# OADL

Order, assignment and delivery management for a Kenyan logistics and distribution company that sells herbal medicines nationwide through field agents.

> Status: **planning, Phase 1 not started.** Docs version 0.1, written 2026-11-15.
> The expansion of the acronym "OADL" has not been confirmed (see `docs/OPEN_QUESTIONS.md`).

## What it does

1. **Storefront**: customers open a product link shared on the company's Facebook page, choose a product and quantity, and book an order. Payment is **on delivery**. A "Talk to us" button opens the manager's WhatsApp.
2. **Manager dashboard**: sees new orders, assigns each one to an agent (manually, or automatically by county), tracks statuses, and manages agents and per-agent stock.
3. **Agent portal (mobile-first PWA)**: agents (about 7 to 10, nationwide) see their assigned orders, mark them **Dispatched** or **Delivered** (recording payment method and amount collected), or mark them **Unresponsive** or **Rescheduled**.
4. **Google Sheet sync**: the database is the source of truth. Order changes are pushed one-way into the company's existing Google Sheet (one tab per agent).
5. **Customer SMS on dispatch.**

## Stack (decided)

| Layer | Choice |
|---|---|
| API | NestJS (TypeScript) |
| Database | PostgreSQL, accessed with Prisma |
| Storefront | Next.js (server-rendered so Facebook link previews work) |
| Manager and agent apps | React (Vite), one app with role-based routes, agent side is a PWA |
| Hosting | API on Render, storefront on Vercel, database on Supabase Postgres |
| FastAPI | Not used in Phase 1. Only if a clear need appears later |

## Documentation map

| File | Purpose |
|---|---|
| `AGENTS.md` | Rules for AI coding agents and contributors. Read first |
| `CLAUDE.md` | Points Claude Code to `AGENTS.md` |
| `docs/REQUIREMENTS.md` | Phase 1 scope, user stories, acceptance criteria |
| `docs/ARCHITECTURE.md` | System design, components, key flows, cross-cutting concerns |
| `docs/FILE_STRUCTURE.md` | Monorepo layout and naming conventions |
| `docs/DATA_MODEL.md` | Entities, relationships, constraints, stock ledger |
| `docs/ORDER_LIFECYCLE.md` | Statuses, transitions, who may do what |
| `docs/INTEGRATIONS.md` | Google Sheets sync, SMS, WhatsApp, push, payments |
| `docs/DEPLOYMENT.md` | Environments, environment variables, release checklist |
| `docs/ROADMAP.md` | Phases 1 to 3 |
| `docs/OPEN_QUESTIONS.md` | Confirmed decisions and unconfirmed items. **Check before building** |

## Ground rule

Nothing in these docs may be treated as a business rule unless it is listed as **confirmed** in `docs/OPEN_QUESTIONS.md`. Anything marked `UNCONFIRMED` or `UNVERIFIED` must be checked with the client or the provider before it is built.
