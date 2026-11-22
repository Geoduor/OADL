# Roadmap

Status: Draft v0.1, 2026-11-15. Phases follow what the developer confirmed. Dates are not set; agree them with the client after the open questions in `OPEN_QUESTIONS.md` are answered.

## Phase 0: Foundations

**Progress (2026-11-18):** repository, pnpm workspace, NestJS API scaffold, Prisma with PostgreSQL, first migration (products) and a database smoke test are done. Blocking questions Q1 to Q5 and Q7 are still open.

**Phase 1 progress (2026-11-19):** public catalogue endpoints (`GET /products`, `GET /products/:slug`) built and covered by e2e tests. The order tables (County, Order, OrderItem, OrderStatusHistory) and the 47 counties are in the schema. A seed script (`apps/api/prisma/seed.ts`) loads PROSTGUARD only (bundles 1/2/3 at 3,999 / 5,500 / 7,000 KES, from the client's sheet). Other products wait for Q2 and Q24. **2026-11-22:** `GET /counties` and `POST /orders` (Zod validation, prices from the database, idempotency key, status `PLACED`) are built. Still missing before the order endpoint may be public: rate limiting and bot protection (next PR; provider is Cloudflare Turnstile, D22). Manager notification, sheet sync and the state machine come later.

- Create the `OADL` GitHub repository, commit these docs.
- Scaffold the monorepo, CI, linting, `.env.example`.
- Answer blocking open questions: Q1 to Q5, Q7.

## Phase 1: MVP (simple, working end to end)

Suggested build order:

1. Database schema, migrations and seed (counties, products, prices, manager).
2. Auth and roles (manager, agent); agent management with county coverage.
3. Orders: public create endpoint, state machine, history, manager list and detail.
4. Storefront: one landing page per product (bundles, order form on the same page, Open Graph tags), confirmation, WhatsApp link, UTM capture, test inside Facebook's in-app browser.
5. Assignment: manual and auto (county, stock, workload).
6. Agent portal (PWA): my orders, Dispatched, Delivered with payment, Unresponsive, Rescheduled.
7. Stock ledger: issue, return, adjust, per-agent view, reservation logic.
8. Real-time and stored notifications.
9. Outbox worker, Google Sheets sync, SMS on dispatch.
10. Manager reports: payments by agent and method, failed sync items.
11. Hardening: rate limiting, CAPTCHA, tests, backups, monitoring; pilot with one agent, then roll out.

**Exit criteria:** acceptance criteria in `REQUIREMENTS.md` pass; two weeks of pilot use with the sheet matching the database.

## Phase 2: Operations upgrade
- Web Push for agents when the app is closed (check platform support first).
- Distance-based assignment (customer pin or geocoding; provider to be verified).
- Stock alerts and basic reports (stock flow, deliveries per agent, unresponsive rate).
- Cash reconciliation report and agent settlement workflow.
- Customer order tracking page.

## Phase 3: Payments and messaging
- Online payment with M-Pesa through Daraja (after the paybill onboarding question is answered).
- WhatsApp notifications through a business API provider (approval requirements to be verified).
- Optional: demand forecasting from stock and order history. This is the one place a separate FastAPI service could be justified.

## Not planned
Native mobile apps, multi-country support, marketplace features, customer accounts (revisit if the client asks).
