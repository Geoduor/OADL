# Roadmap

Status: Draft v0.1, 2026-11-15. Phases follow what the developer confirmed. Dates are not set; agree them with the client after the open questions in `OPEN_QUESTIONS.md` are answered.

## Phase 0: Foundations

**Progress (2026-11-18):** repository, pnpm workspace, NestJS API scaffold, Prisma with PostgreSQL, first migration (products) and a database smoke test are done. Blocking questions Q1 to Q5 and Q7 are still open.

**Phase 1 progress (2026-11-19):** public catalogue endpoints (`GET /products`, `GET /products/:slug`) built and covered by e2e tests. The order tables (County, Order, OrderItem, OrderStatusHistory) and the 47 counties are in the schema. A seed script (`apps/api/prisma/seed.ts`) loads PROSTGUARD only (bundles 1/2/3 at 3,999 / 5,500 / 7,000 KES, from the client's sheet). Other products wait for Q2 and Q24. **2026-11-22:** `GET /counties` and `POST /orders` (Zod validation, prices from the database, idempotency key, status `PLACED`) are built. **2026-11-22:** rate limiting (`@nestjs/throttler`) and Cloudflare Turnstile verification (D22) are built; before the API is public, `TRUST_PROXY` must be set correctly on Render (UNVERIFIED, see `DEPLOYMENT.md`). **Step 6a:** `User` and `Session` models, agent self-registration (PENDING until approved), phone + password sign-in with cookie sessions (`@nestjs/authentication`, scrypt, D24-D30) and a `create-manager` script. **Step 6b:** manager-only `GET /agents/registrations`, `GET /agents`, `POST /agents/:userId/approve` (sets counties, D31), `PUT /agents/:userId/counties`, `POST /agents/:userId/disable`; `Agent` and `AgentCounty` models. **Re-enable (2026-11-25):** `POST /agents/:userId/enable` restores a disabled agent (D37). **Step 6c (2026-11-23):** the order state machine (`OrderStatusService`, rules in `order-transitions.ts`, D32 and D33) with manager-only `GET /manager/orders`, `GET /manager/orders/:id` and `POST /manager/orders/:id/status`; `Order.assignedAgentId` and history links. `DELIVERED`, stock checks, notifications, outbox and sheet sync come later. **Step 6d (2026-11-23):** agent endpoints `GET /agent/orders`, `GET /agent/orders/:id` and `POST /agent/orders/:id/status` (dispatch, unresponsive, reschedule). An agent sees only their own open orders (D27); delivered and cancelled orders are hidden from them until Q30 is answered. **Step 6e (2026-11-23):** `DELIVERED` with payment (D34): `Payment` model (cash or M-Pesa, amount), `deliveredAt`, a mismatch flag for the manager. **Step 7 (2026-11-24):** stock ledger (`StockMovement`, D35): manager issues stock to agents, records returns and adjustments, sees stock per agent and product and the movement history; agents see their own stock; assignment warns on insufficient stock with a manager override; delivery deducts stock. **Step 7b (2026-11-25):** `POST /manager/orders`: the manager creates an order for a customer (D36). Auto-assign, agent-to-manager settlement, notifications, outbox and sheet sync come later. **Portal P1 (2026-11-25):** `apps/portal` scaffold: sign-in, role-based redirect, read-only manager order list. **Portal P2 (2026-11-25):** manager Agents screen: approve or reject registrations with county selection, edit an agent's counties, disable and re-enable (D31, D37). **Portal P3 (2026-11-25):** manager order detail (customer, items, payment, history) with the allowed moves: confirm, assign or move to another agent (stock warning with override, D35), reschedule, retry an unresponsive order (D32), cancel with a reason. **Portal P4 (2026-11-25):** manager create-order form (D36) at `/manager/orders/new`. Dev server proxies `/api` to the API, so `CORS_ORIGINS` is only needed in production (portal origin).

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
