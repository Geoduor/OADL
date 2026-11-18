# OADL

Order, assignment and delivery management for a Kenyan logistics and distribution company that sells herbal medicines nationwide through field agents.

> Status: **Phase 0 (foundations) in progress.** The workspace and an empty NestJS API exist; no OADL features are built yet. Docs version 0.1, written 2026-11-15.
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
| Hosting | API on Render, storefront on Vercel, database on Render Postgres |
| FastAPI | Not used in Phase 1. Only if a clear need appears later |

## Getting started

Requirements: Node and pnpm 11.15.0 (pinned in `package.json` through `packageManager`). Per NestJS's docs (checked 2026-11-15), running the app needs Node 20.19+ or 22.12+, and the Nest CLI generators need 22.22.3+, 24.15+ or 26+. The API was scaffolded on Node 24.16.0.

```bash
pnpm install
pnpm --filter api prisma:generate   # creates the Prisma client (not committed); typecheck and the e2e tests need it
pnpm dev:api        # http://localhost:3000 shows "Hello World!" until we build real routes
pnpm lint && pnpm typecheck && pnpm test
```

### Local database

1. Install PostgreSQL (developed on 18.4; Render supports 18).
2. As the admin user in `psql`, create a login and a database. `CREATEDB` is needed because `prisma migrate dev` creates a temporary shadow database:
   ```sql
   CREATE USER oadl WITH PASSWORD '<your local password>' CREATEDB;
   CREATE DATABASE oadl_dev OWNER oadl;
   ```
3. Copy `apps/api/.env.example` to `apps/api/.env` and set `DATABASE_URL`. Never commit `.env`.
4. From `apps/api`: `pnpm exec prisma migrate dev` (creates the tables), then `pnpm --filter api test:e2e`.

The database tests refuse to run unless `DATABASE_URL` points at localhost.

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
