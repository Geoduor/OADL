# AGENTS.md

Instructions for AI coding agents and human contributors working on OADL. Read this file, then `docs/OPEN_QUESTIONS.md`, before writing code.

## 1. Project in one paragraph

OADL is a real production system for a real client: a Kenyan company that sells herbal medicines nationwide through about 7 to 10 field agents. Customers order through a storefront (payment on delivery). A manager assigns orders to agents. Agents mark orders dispatched, delivered, unresponsive or rescheduled. The database is the source of truth, and changes are pushed one-way to a Google Sheet the company already uses.

## 2. Anti-hallucination rules (non-negotiable)

- **Do not invent business rules**, prices, products, counties per agent, SMS rates, API limits or provider requirements. If it is not in `docs/`, ask or add it to `docs/OPEN_QUESTIONS.md`.
- Mark unknowns in code with `// TODO(confirm): <question>` and in docs with `UNCONFIRMED` or `UNVERIFIED`.
- Third-party facts (Google Sheets API, SMS providers, Render, Vercel, Safaricom Daraja) change. **Read the current official documentation before implementing** and link it in the PR. Do not rely on memory.
- If a doc and the code disagree, stop and flag it. Do not silently pick one.
- Do not add features beyond the current phase (`docs/ROADMAP.md`).

## 3. Source-of-truth order

1. `docs/OPEN_QUESTIONS.md` (confirmed decisions)
2. `docs/REQUIREMENTS.md`, `docs/ORDER_LIFECYCLE.md`, `docs/DATA_MODEL.md`
3. `docs/ARCHITECTURE.md`, `docs/INTEGRATIONS.md`
4. This file

## 4. Stack and layout

Monorepo (pnpm workspaces). See `docs/FILE_STRUCTURE.md`.

- `apps/api`: NestJS + Prisma + PostgreSQL
- `apps/storefront`: Next.js (public shop)
- `apps/portal`: React + Vite (manager and agent, agent side is a PWA)
- `packages/shared`: enums, constants and types shared by all apps (no business logic, no secrets)

`apps/api` is scaffolded (2026-11-15): NestJS 12, **ESM**, TypeScript strict, Vitest, oxlint. In ESM, relative imports end in `.js`, `__dirname` does not exist (use `import.meta.dirname`), and mocks are `vi.fn()`. See `apps/api/AGENTS.md`. The storefront, portal and shared package are not created yet.

Database layer (D17): **Prisma 7.10.1, pinned**. Never install `prisma@latest` (npm's latest CLI was a release candidate on 2026-11-16). The generated client lives in `apps/api/src/generated/prisma` and is **not committed**: run `pnpm --filter api prisma:generate` after cloning or changing `schema.prisma` (`pnpm build` does it). Use Prisma through `PrismaService` / `PrismaModule`. Run the Prisma CLI as `pnpm exec prisma ...` inside `apps/api`. Use `migrate dev` locally only; production uses `migrate deploy`.

## 5. Conventions

- TypeScript strict mode everywhere. No `any` without a comment explaining why.
- Money is stored as **integer KES** (no decimals, no floats).
- Phone numbers are stored in **E.164** (`+254...`). Normalise on input.
- Timestamps are stored in **UTC**; display in `Africa/Nairobi`.
- API DTOs: validation library is **undecided** (Q21: `class-validator`, or a Standard Schema library such as Zod). Decide before writing the first DTO. Never trust client input. Never trust client-supplied prices, roles or user IDs.
- Database changes go through **Prisma migrations** only. Never edit the database by hand.
- Public API responses use an explicit Prisma `select` allow-list, never a whole row, so a new internal column cannot leak (see `apps/api/src/products/products.service.ts`).
- Order status changes go through **one service method** that enforces the state machine, writes `OrderStatusHistory`, adjusts stock and enqueues side effects (notifications, SMS, sheet sync). No other code may write `Order.status`.
- Side effects (SMS, Google Sheets, push) are **asynchronous with retries** (outbox pattern). A failed external call must never fail or roll back the order.
- Authorisation is enforced **on the server** with guards. An agent can only read and change orders assigned to them.
- Commit messages: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`). One concern per PR.

## 6. Security and privacy

- Never commit secrets. Use environment variables (`docs/DEPLOYMENT.md`) and keep an up-to-date `.env.example` with **names only**.
- Customer names, phones and addresses are personal data. Do not log them in plain text, put them in error messages, or use real data in tests, fixtures or screenshots.
- The public order endpoint must have rate limiting, bot protection and an idempotency key.
- Passwords are hashed with a modern algorithm (argon2 or bcrypt). No default or shared accounts in production.

## 7. Commands

Available now (run from the repo root):

```bash
pnpm install
pnpm --filter api prisma:generate   # after clone or schema change
pnpm dev:api                  # NestJS API with auto-reload, http://localhost:3000
pnpm build
pnpm lint
pnpm typecheck
pnpm test                     # unit tests (Vitest)
pnpm --filter api test:e2e    # API end-to-end tests (needs the local database, see README)
```

From `apps/api`: `pnpm exec prisma migrate dev --name <change>`, `pnpm exec prisma validate`.

Planned, **not created yet** (update this section when they exist): storefront and portal dev commands, a seed command.

## 8. Definition of done

- Behaviour matches `docs/REQUIREMENTS.md` and `docs/ORDER_LIFECYCLE.md`.
- Unit tests for business rules (state machine, pricing, assignment, stock). Integration tests for order creation, assignment, delivery and the permission boundaries between manager and agent.
- Lint, typecheck and tests pass.
- No new `UNCONFIRMED` assumption is hidden in code. It is either confirmed with the client or listed in `docs/OPEN_QUESTIONS.md`.
- Docs updated in the same PR when behaviour changes.

## 9. Ask the human before

- Adding a new third-party service, paid dependency or new top-level package.
- Changing the order statuses, stock rules or pricing logic.
- Changing the Google Sheet layout or writing to anything except the mapped columns.
- Any destructive migration or data deletion.
- Anything that touches real customer data.

## 10. Project owner

The developer owns the repository (contact details live in the repository settings, not in this file). The client is the company's management. Business questions go to the developer, who confirms them with the client.
