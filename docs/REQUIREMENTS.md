# Requirements: Phase 1 (MVP)

Status: Draft v0.1, 2026-11-15. Items depending on open questions are tagged with their ID from `OPEN_QUESTIONS.md`.

## 1. Actors

| Actor | Description | Access |
|---|---|---|
| Customer | Anyone opening the shared product link. No account in Phase 1 | Public storefront |
| Manager | Company staff running operations | Manager area (all data) |
| Agent | Field delivery agent (about 7 to 10) | Agent area (own orders and own stock only) |

## 2. In scope (Phase 1)

### 2.1 Storefront (Next.js)
- US-1: As a customer I can see the product list and a product page with image, description and prices.
- US-2: As a customer I can choose a product and a bundle size and see the total in KES. (Only defined bundle sizes are offered, Q2.)
- US-3: As a customer I can place an order with: full name, phone, county (dropdown), free-text address and landmark. Payment is on delivery, and the page says so.
- US-4: As a customer I see a confirmation with my order number.
- US-5: As a customer I can tap "Talk to us" to open WhatsApp with the manager and a pre-filled message (Q9).
- US-6: Product pages carry Open Graph tags (title, image, description) so Facebook link previews are correct.
- US-7: The order form resists bots and double submits (rate limit, CAPTCHA, idempotency key).

### 2.2 Manager dashboard
- US-10: I see new orders in real time (pop-up plus list) and unassigned orders in a queue.
- US-11: I can create an order on behalf of a customer (for orders that came through WhatsApp).
- US-12: I can assign an order to an agent manually, reassign it, or press **Auto-assign**.
- US-13: Auto-assign picks an active agent covering the order's county, who has enough stock for every item, and who has the fewest open orders. If none qualifies, the order stays unassigned with a reason shown.
- US-14: I can filter orders by status, agent, county and date, and see an order's full history.
- US-15: I can cancel an order and reschedule one.
- US-16: I can manage agents (create, deactivate, set counties, link their sheet tab).
- US-17: I can manage the product catalogue and bundle prices.
- US-18: I can see stock per agent and per product, issue stock to an agent, record returns and adjustments, and see the movement history.
- US-19: I can see payments recorded by agents, grouped by agent and method, to reconcile cash.

### 2.3 Agent portal (PWA)
- US-30: I log in on my phone and can install the app to my home screen.
- US-31: I get an in-app pop-up when an order is assigned to me, and see unread assignments after logging in.
- US-32: I see only my orders, with customer name, phone (tap to call), county, address, products and amount.
- US-33: I can mark an order **Dispatched**. This sends the customer an SMS.
- US-34: I can mark an order **Delivered**, which requires choosing payment method (cash, M-Pesa or paybill) and confirming the amount collected.
- US-35: I can mark an order **Unresponsive** (customer did not answer) or **Rescheduled** (with a new date).
- US-36: I can see my current stock per product.

### 2.4 Notifications
- In-app real-time pop-ups for agent (assignment) and manager (new order, status changes).
- A stored notification list so nothing is lost if the user was offline.
- Customer SMS on dispatch (provider Q6).

### 2.5 Google Sheet sync
- Order creation or assignment writes a row to the assigned agent's tab; status changes update that row. One-way only. Details in `INTEGRATIONS.md` (Q1, Q5, Q17).
- Manager can see sync health (pending and failed items) and retry failures.

## 3. Out of scope (Phase 1)

Online payment (M-Pesa STK push or card), WhatsApp automated notifications, distance-based assignment, background Web Push when the app is closed, customer accounts, customer order tracking page, discounts, delivery fees (Q8), multi-language, native mobile apps, FastAPI services.

## 4. Non-functional requirements

- **Security**: server-side role checks; agents cannot see other agents' orders; hashed passwords; rate limiting; HTTPS only.
- **Reliability**: external failures (SMS, Sheets) must not break order handling; retries with visibility in the dashboard.
- **Performance**: storefront pages load fast on mobile data (the traffic comes from Facebook on phones). Lists are paginated.
- **Data integrity**: prices are copied into the order at purchase time; status changes are audited; stock is a ledger, never a single editable number.
- **Privacy**: customer personal data is minimised and not logged in plain text (Q19).
- **Observability**: structured logs, health endpoint, error tracking (tool to be chosen).
- **Time and money**: `Africa/Nairobi` display, UTC storage, integer KES.

## 5. Acceptance criteria (selected)

1. A double-tapped "Place order" creates exactly one order.
2. An agent calling the API for another agent's order receives a 403 or 404.
3. Marking **Delivered** without a payment method and amount is rejected.
4. After **Delivered**, the agent's stock for the ordered items decreases by the ordered quantities, and a stock movement row exists.
5. If the Google Sheets API is unavailable, the order still changes status, an outbox item is queued, and it is retried later.
6. An invalid transition (for example Delivered to Dispatched) is rejected and not saved.
7. Auto-assign never selects an inactive agent, an agent outside the county, or an agent without enough stock.
