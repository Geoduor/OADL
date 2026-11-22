# Architecture

Status: Draft v0.1, 2026-11-15.

## 1. Overview

One NestJS API is the only thing that touches the database and external services. Three front ends talk to it over HTTPS. Real-time pop-ups use a WebSocket gateway. All external side effects go through an outbox processed by background workers.

```
 Facebook link ──> [ Storefront (Next.js, Vercel) ] ──┐
                                                       │ HTTPS (public order API)
 Manager / Agent ─> [ Portal (React+Vite, PWA) ] ──────┤ HTTPS + JWT, WebSocket
                                                       ▼
                                          [ API (NestJS, Render) ]
                                           │  modules: auth, orders, assignment,
                                           │  agents, products, stock, payments,
                                           │  notifications, realtime, sms, sheets-sync
                                           ▼
                     [ PostgreSQL (Render)   ] ◄── Prisma
                                           │
                       outbox worker (in the API process, Phase 1)
                          ├──> Google Sheets API (service account)  one-way
                          └──> SMS provider (provider-agnostic interface)
```

Customer WhatsApp is **not** an integration in Phase 1: the storefront only opens a `wa.me` click-to-chat link to the manager's number.

## 2. Key decisions and why

| Decision | Reason | Trade-off |
|---|---|---|
| Next.js for the storefront | Facebook reads Open Graph tags from server HTML, so each product link needs a server-rendered preview; faster first load on mobile | Two front-end frameworks in the repo |
| React + Vite for manager and agent | Behind login, no SEO needed; one app with role-based routes; PWA for the agent side | Splitting later is possible |
| One NestJS API for everything | One place for rules, auth and the state machine | Needs discipline to keep modules separate |
| Database is the source of truth, sheet is one-way | Two-way sync between a database and a spreadsheet causes conflicts and corruption | Manual edits in the sheet are not read back (Q20) |
| Outbox pattern for sheet and SMS | A failed external call must not lose or block an order | Slight delay; needs a retry worker and a dashboard for failures |
| Stock as a ledger | Gives the manager the flow of product and an audit trail | Slightly more code than one quantity column |
| Background jobs inside the API process in Phase 1 | Simplest for about 7 to 10 agents | Move to a separate worker or queue if load grows |
| No FastAPI in Phase 1 | A second backend adds deployment and auth work with no current need | Revisit for forecasting in a later phase |

## 3. Components

### 3.1 API modules (`apps/api/src/modules`)
`auth`, `users`, `agents`, `counties`, `products`, `orders`, `assignment`, `payments`, `stock`, `notifications`, `realtime`, `sms`, `sheets-sync`, `audit`, `health`. See `FILE_STRUCTURE.md`.

### 3.2 Public vs private endpoints
- **Public** (no login): list products, product detail, counties, create order. Rate limited, bot protected, idempotent.
- **Manager**: everything.
- **Agent**: own orders, own stock, status changes allowed by `ORDER_LIFECYCLE.md`.
Roles are enforced with NestJS guards and checked against the database record, not just the token.

## 4. Key flows

### 4.1 Customer places an order
1. Storefront submits name, phone, county, free-text location, items (product and bundle quantity) and an **idempotency key** (a UUID it generates). Landing slug and UTM values are optional.
2. API validates input with Zod, recomputes the price from the database (client prices are ignored), normalises the phone to E.164 (Kenyan mobiles only: `+254` then 9 digits starting with 7 or 1). Only defined, active bundles are accepted (Q2). A repeated idempotency key returns the first order **before** the bot check runs (Turnstile tokens are single use). Cheapest checks run first: rate limit, schema validation, repeat submit, Turnstile verification (server side, fails closed), then the database.
3. Creates `Order` (status `PLACED`) with `OrderItem` rows and copies prices into them. Writes `OrderStatusHistory`.
4. Emits a real-time event to online managers and stores a `Notification`.
5. Returns the order number.

### 4.2 Manager assigns (manual or auto)
1. Manager picks an agent, or calls auto-assign (rules in `REQUIREMENTS.md` US-13).
2. In one database transaction: set `assignedAgentId`, status `ASSIGNED`, write history.
3. Stock is considered **reserved** (derived from open orders, see `DATA_MODEL.md`).
4. Notification to the agent (WebSocket plus stored). Outbox item to create the sheet row.

### 4.3 Agent dispatches and delivers
1. **Dispatched**: status change, outbox items for the customer SMS and sheet update.
2. **Delivered**: requires payment method and amount. In one transaction: status `DELIVERED`, `Payment` row, `StockMovement` (delivery) rows, history. Outbox item for the sheet update.
3. **Unresponsive / Rescheduled**: status change, attempt counter, optional new date, sheet update.

### 4.4 Outbox processing
Worker polls pending outbox rows, calls the external service, marks done or increments attempts with backoff, and marks failed after a limit. The dashboard shows failed items with a retry button. Handlers must be **idempotent** (for the sheet, find the row by Order ID and update rather than append again).

## 5. Cross-cutting concerns

- **Auth**: phone number plus password for staff in Phase 1 (D24), email later; one manager (D23); login lifetime per D25, with the user's account status (`ACTIVE`) checked in the database on every request. Agents register themselves and wait for the manager's approval (D26). Agents never see other agents' data, and see a customer's details only for orders currently assigned to them (D27); the server enforces this in every query, not only in the app. Implemented with `@nestjs/authentication` (D28): HttpOnly session cookies (D30), sessions in PostgreSQL, passwords hashed with scrypt (D29). Customers do not log in.
- **Real-time**: Socket.IO or native WebSocket gateway in NestJS (pick one at implementation). Every pop-up is also a stored `Notification`, so reconnects and offline users lose nothing.
- **Validation and errors**: DTO validation on all inputs; consistent error format; no stack traces to clients.
- **Audit**: status history, stock movements and payments are append-only.
- **Config**: environment variables validated at start-up (`DEPLOYMENT.md`).
- **Logging**: structured, no personal data in plain text.
- **Time zone**: UTC in the database, `Africa/Nairobi` in the UI.
- **PWA**: web app manifest and service worker in `apps/portal`; Web Push is Phase 2.

## 6. Risks to track

| Risk | Mitigation |
|---|---|
| Free-tier limits (Render free Postgres expires after 30 days and has no backups; free web services sleep; Vercel commercial terms unverified, Q7) | Paid Render web service and Postgres for production; read Vercel's terms before launch |
| Fake or prank orders (payment on delivery) | CAPTCHA, rate limit, optional manager confirmation call (Q16) |
| Sheet drift if people edit system columns | Protected ranges, one-way sync, Order ID column (Q20) |
| Stock mismatch between ledger and physical count | Adjustment movements with reason, periodic counts (Q12) |
| Agents on phones that restrict background push (Q11) | Phase 1 relies on in-app pop-ups and stored notifications |
| Personal data exposure | Server-side authorization, minimal logging, access reviews (Q19) |
