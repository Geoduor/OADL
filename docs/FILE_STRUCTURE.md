# File Structure

Status: Draft v0.1, 2026-11-15. A pnpm-workspaces monorepo named `OADL`. This is the **target** layout; create folders as each feature is built.

```
OADL/
├─ README.md
├─ AGENTS.md
├─ CLAUDE.md
├─ .env.example                 # variable NAMES only, never values
├─ .gitignore
├─ package.json                 # workspace root scripts
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
├─ docs/
│  ├─ REQUIREMENTS.md
│  ├─ ARCHITECTURE.md
│  ├─ FILE_STRUCTURE.md
│  ├─ DATA_MODEL.md
│  ├─ ORDER_LIFECYCLE.md
│  ├─ INTEGRATIONS.md
│  ├─ DEPLOYMENT.md
│  ├─ ROADMAP.md
│  └─ OPEN_QUESTIONS.md
├─ packages/
│  └─ shared/                   # enums, constants, types only
│     └─ src/
│        ├─ enums.ts            # OrderStatus, PaymentMethod, StockMovementType, Role
│        ├─ constants.ts        # e.g. timezone, phone country code
│        └─ types.ts            # API response shapes
├─ apps/
│  ├─ api/                      # NestJS
│  │  ├─ prisma/
│  │  │  ├─ schema.prisma
│  │  │  ├─ migrations/
│  │  │  └─ seed.ts             # counties, products, bundles, first manager
│  │  ├─ src/
│  │  │  ├─ main.ts
│  │  │  ├─ app.module.ts
│  │  │  ├─ config/             # env loading and validation
│  │  │  ├─ prisma/             # PrismaModule, PrismaService
│  │  │  ├─ common/
│  │  │  │  ├─ guards/          # JwtAuthGuard, RolesGuard
│  │  │  │  ├─ decorators/      # @Roles, @CurrentUser
│  │  │  │  ├─ filters/         # exception filter
│  │  │  │  ├─ interceptors/
│  │  │  │  └─ utils/           # phone normalisation, money helpers
│  │  │  └─ modules/
│  │  │     ├─ auth/
│  │  │     ├─ users/
│  │  │     ├─ agents/          # agents, county coverage, sheet tab link
│  │  │     ├─ counties/
│  │  │     ├─ products/        # products and bundle prices
│  │  │     ├─ orders/          # controller, service, state machine, DTOs
│  │  │     ├─ assignment/      # manual and auto assignment
│  │  │     ├─ payments/
│  │  │     ├─ stock/           # ledger, issue, return, adjust
│  │  │     ├─ notifications/   # stored notifications
│  │  │     ├─ realtime/        # WebSocket gateway
│  │  │     ├─ sms/             # SmsProvider interface + implementation
│  │  │     ├─ sheets-sync/     # outbox handler for Google Sheets
│  │  │     ├─ outbox/          # worker, retry, failure handling
│  │  │     ├─ audit/
│  │  │     └─ health/
│  │  └─ test/                  # e2e tests
│  ├─ storefront/               # Next.js (App Router assumed)
│  │  ├─ app/
│  │  │  ├─ page.tsx            # landing and product grid
│  │  │  ├─ products/[slug]/page.tsx   # product landing page: bundles, order form, Open Graph metadata (Facebook ad destination)
│  │  │  └─ order/[orderNo]/page.tsx   # confirmation
│  │  ├─ components/
│  │  ├─ lib/                   # API client, formatters
│  │  └─ public/
│  └─ portal/                   # React + Vite
│     ├─ public/                # manifest, icons
│     └─ src/
│        ├─ main.tsx
│        ├─ app/                # router, auth provider, layouts
│        ├─ routes/
│        │  ├─ manager/         # orders, agents, products, stock, payments, sync
│        │  └─ agent/           # my orders, order detail, my stock
│        ├─ features/           # feature components and hooks per domain
│        ├─ components/         # shared UI
│        ├─ lib/                # API client, socket client, formatters
│        └─ pwa/                # service worker registration (Web Push: Phase 2)
└─ .github/
   └─ workflows/                # CI: lint, typecheck, test
```

## Scaffold status (2026-11-15)

Created so far: root workspace files, `docs/`, and `apps/api` (NestJS 12, ESM, Vitest, oxlint, Prisma 7.10.1). In `apps/api`: `prisma/schema.prisma` and `prisma/migrations/` (Product and ProductPrice), `prisma7.config.ts` (the config file name for Prisma 7.10; Prisma 8 accepts only `prisma.config.ts`), `src/prisma/` (PrismaModule, PrismaService), `src/products/` (public catalogue: `GET /products`, `GET /products/:slug`), `test/support/local-database.ts` (guard for database tests), `src/generated/prisma/` (generated, gitignored), `.env.example`. In `apps/api`, unit tests sit next to the code (`src/*.spec.ts`), end-to-end tests are in `test/*.e2e-spec.ts` with `vitest.config.e2e.ts`. Everything else in the tree above is still the target.

## Naming conventions

- Files: `kebab-case.ts`; React components: `PascalCase.tsx`.
- NestJS: `orders.module.ts`, `orders.controller.ts`, `orders.service.ts`, `dto/create-order.dto.ts`.
- Database: Prisma models in `PascalCase`, tables mapped to `snake_case` with `@@map`.
- Enums are defined once in `packages/shared` and mirrored in Prisma. A test should assert they match.
- Branches: `feat/...`, `fix/...`, `docs/...`. Default branch: `main`.

## Notes

- Whether the portal is one app or two can be revisited. One app with role-based routes is the Phase 1 choice.
- `apps/storefront` assumes the Next.js App Router. Confirm the current recommended setup in the official docs when scaffolding.
