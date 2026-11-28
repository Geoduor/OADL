# Roadmap

Status: Draft v0.1, 2026-11-15. Phases follow what the developer confirmed. Dates are not set; agree them with the client after the open questions in `OPEN_QUESTIONS.md` are answered.

## Phase 0: Foundations

**Progress (2026-11-18):** repository, pnpm workspace, NestJS API scaffold, Prisma with PostgreSQL, first migration (products) and a database smoke test are done. Blocking questions Q1 to Q5 and Q7 are still open.

**Phase 1 progress (2026-11-19):** public catalogue endpoints (`GET /products`, `GET /products/:slug`) built and covered by e2e tests. The order tables (County, Order, OrderItem, OrderStatusHistory) and the 47 counties are in the schema. A seed script (`apps/api/prisma/seed.ts`) loads PROSTGUARD only (bundles 1/2/3 at 3,999 / 5,500 / 7,000 KES, from the client's sheet). Other products wait for Q2 and Q24. **2026-11-22:** `GET /counties` and `POST /orders` (Zod validation, prices from the database, idempotency key, status `PLACED`) are built. **2026-11-22:** rate limiting (`@nestjs/throttler`) and Cloudflare Turnstile verification (D22) are built; before the API is public, `TRUST_PROXY` must be set correctly on Render (UNVERIFIED, see `DEPLOYMENT.md`). **Step 6a:** `User` and `Session` models, agent self-registration (PENDING until approved), phone + password sign-in with cookie sessions (`@nestjs/authentication`, scrypt, D24-D30) and a `create-manager` script. **Step 6b:** manager-only `GET /agents/registrations`, `GET /agents`, `POST /agents/:userId/approve` (sets counties, D31), `PUT /agents/:userId/counties`, `POST /agents/:userId/disable`; `Agent` and `AgentCounty` models. **Re-enable (2026-11-25):** `POST /agents/:userId/enable` restores a disabled agent (D37). **Step 6c (2026-11-23):** the order state machine (`OrderStatusService`, rules in `order-transitions.ts`, D32 and D33) with manager-only `GET /manager/orders`, `GET /manager/orders/:id` and `POST /manager/orders/:id/status`; `Order.assignedAgentId` and history links. `DELIVERED`, stock checks, notifications, outbox and sheet sync come later. **Step 6d (2026-11-23):** agent endpoints `GET /agent/orders`, `GET /agent/orders/:id` and `POST /agent/orders/:id/status` (dispatch, unresponsive, reschedule). An agent sees only their own open orders (D27); delivered and cancelled orders are hidden from them until Q30 is answered. **Step 6e (2026-11-23):** `DELIVERED` with payment (D34): `Payment` model (cash or M-Pesa, amount), `deliveredAt`, a mismatch flag for the manager. **Step 7 (2026-11-24):** stock ledger (`StockMovement`, D35): manager issues stock to agents, records returns and adjustments, sees stock per agent and product and the movement history; agents see their own stock; assignment warns on insufficient stock with a manager override; delivery deducts stock. **Payments summary (2026-11-26):** `GET /manager/payments/summary` (D38). **Step 7b (2026-11-25):** `POST /manager/orders`: the manager creates an order for a customer (D36). Auto-assign, agent-to-manager settlement, notifications, outbox and sheet sync come later. **Portal P1 (2026-11-25):** `apps/portal` scaffold: sign-in, role-based redirect, read-only manager order list. **Portal P2 (2026-11-25):** manager Agents screen: approve or reject registrations with county selection, edit an agent's counties, disable and re-enable (D31, D37). **Portal P3 (2026-11-25):** manager order detail (customer, items, payment, history) with the allowed moves: confirm, assign or move to another agent (stock warning with override, D35), reschedule, retry an unresponsive order (D32), cancel with a reason. **Portal P4 (2026-11-25):** manager create-order form (D36) at `/manager/orders/new`. **Portal P5 (2026-11-25):** agent screens: my open orders, order page with Dispatched, Delivered (cash or M-Pesa and amount, D34), Unresponsive and Reschedule, and my stock. Agent self-registration page (needs the Turnstile widget) and Web Push are not built. **Portal P6 (2026-11-25):** manager Stock screen: who holds what, give stock to an agent, record a return, correct a count or damage, and the movement history (D35). **Portal P7 (2026-11-26):** manager Payments screen (collected per agent, cash and M-Pesa, by Nairobi date range, D38), using the payments summary endpoint. Dev server proxies `/api` to the API, so `CORS_ORIGINS` is only needed in production (portal origin).

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

**Storefront S1 (2026-11-26):** `apps/storefront` (Next.js): home page listing products, one landing page per product at `/products/<slug>` with the bundle choice, the order form (name, phone, county, location), Open Graph tags, UTM capture, Cloudflare Turnstile, a "Talk to us" WhatsApp button (hidden until Q9 is answered) and a confirmation page. English only (D39), neutral wording (D40). **Not done:** test inside Facebook's in-app browser on real phones (US-9, UNVERIFIED), real product copy and images (Q14), Turnstile site key, Content-Security-Policy, deployment.

**Portal P8 (2026-11-27):** agent self-registration page (`/register`, US-37, D26): name, phone, password (10 characters minimum, the API's technical default), Turnstile check, then "the manager must approve". Linked from the sign-in page. Development uses Cloudflare's dummy token; production needs `VITE_CAPTCHA_SITE_KEY` and the page refuses to send without it.

**Portal P9 (2026-11-27 and 28, from the manager's reference screens, Q32):** agent Home (`/agent`: completed today, cash collected today, open orders by status, stock; API `GET /agent/overview`), agent History (`/agent/history`, period chips; API `GET /agent/history`, no customer details, D27), My orders moved to `/agent/orders` with status chips and a scheduled-date filter, and a manager "Copy order details" button (WhatsApp-ready text, payment on delivery, D41). Money shown is cash collected as recorded by the agent (D38); no earnings, rating or duty status until Q34/Q36 are answered. Two guesses are marked `TODO(confirm)` in the API: week/month mean the last 7/30 days, and "completed today" counts delivered today out of delivered today plus open orders.

**Portal P10 (2026-11-28):** the portal re-checks the session when a tab becomes visible (at most every 30 seconds) and follows the cookie: signed out on a 401, switched if another window signed in someone else, unchanged on a network error.

**Assignment A1 (2026-11-28, API and portal, US-12/US-13, D8):** `POST /manager/orders/:id/auto-assign` and an "Auto-assign" button on a confirmed, unassigned order. Rule: active agent covering the county, enough free stock for every item (reserved stock counted), fewest open orders; tie goes to the earlier name (Q37, `TODO(confirm)`). If nobody qualifies the order stays confirmed and the manager sees why (no agent covers the county, or none has the stock). Distance-based assignment stays Phase 2.

**Notifications N1 (2026-11-27, API only, step 8 part 1):** stored in-app notifications (`Notification` table, migration `add_notifications`) written in the same transaction as the change that causes them: managers on a new storefront order (best effort) and when an agent moves an order on; an agent when an order is assigned to them, moved off them or cancelled, or rescheduled by the manager. Bodies carry the order number and county only. Endpoints for both roles: `GET /notifications` (`unread`, `limit`), `GET /notifications/unread-count`, `POST /notifications/:id/read`, `POST /notifications/read-all`. Not built: the live pop-up (WebSocket, N2), the portal bell and list (N3), Web Push (Phase 2), SMS and sheet sync.

**Notifications N3 (2026-11-27, portal):** an Alerts link with an unread count in the top bar for both roles (checks every 20 seconds, when the tab becomes visible, and right after reading), and a Notifications page (newest first, tap to mark read and open the order, mark all as read). An agent is not linked to an order taken off them. Still not built: the live pop-up (N2), Web Push (Phase 2).

**Notifications N4b (2026-11-28, portal, Web Push):** `public/sw.js` (shows the alert as plain text, opens the order on tap, only same-site paths), `public/manifest.webmanifest` (standalone, needed for iPhone Home Screen web apps; no icons yet because there is no logo), and a "Phone alerts" card on the Notifications page with a "Turn on phone alerts" button (permission is asked only after the tap). It re-sends the subscription each time the page opens, which heals a device the browser re-subscribed. iPhone shows "add to Home Screen first" instead. Not built: app icons (needs the logo), a `pushsubscriptionchange` handler in the service worker, real-device tests on the agents' phones (Q11).
**Notifications N4a (2026-11-28, API, Web Push):** `PushSubscription` table and `Notification.pushedAt/pushAttempts` (migration `add_web_push`); `GET /push/public-key`, `POST /push/subscribe`, `POST /push/unsubscribe` (own devices only). A sender in the API process polls every 5 seconds for fresh unsent alerts (under 10 minutes old) of users who have a device, claims each row, pushes title, body and a link (order number and county only), deletes devices the push service reports gone, and retries temporary failures up to 3 times. The stored notification is the outbox, so a push failure never touches an order. Off unless `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` are set. Portal service worker and the "Turn on alerts" button are N4b.

## Not planned
Native mobile apps, multi-country support, marketplace features, customer accounts (revisit if the client asks).
