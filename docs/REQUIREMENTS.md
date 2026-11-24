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

**Context (2026-11-15):** the client wants customers to buy straight from Facebook: an ad or post with a "Shop now" button opens a mobile page inside Facebook's in-app browser, where the customer picks a bundle and submits a short order form, paying on delivery. The client shared three screenshots of other sellers' pages as examples of the style. Use them for **layout ideas only**; do not copy their text, images, branding or product claims. The details below are proposals pending Q23 to Q27.

- US-1: Each product has its own **mobile landing page** (one URL per product slug) that a Facebook ad can link to directly: product name and images, price, bundle selector, the order form, a short benefits section, and a clear "pay on delivery" note. Copy must be approved by the client (Q14).
- US-2: As a customer I can choose a bundle (for example 1, 2 or 3 units) and see the total in KES update. Only defined bundles are offered (Q2). A struck-through "was" price and a "Save %" badge are optional and depend on Q25.
- US-3: As a customer I can order from the **same page** with as few fields as possible: full name, phone, county (dropdown, needed for auto-assignment) and a free-text location (D20). The button states that payment is on delivery.
- US-4: As a customer I see a confirmation with my order number and what happens next (the company will call to confirm, Q16).
- US-5: As a customer I can tap "Talk to us" to open WhatsApp with the manager and a pre-filled message (Q9).
- US-6: Product pages carry Open Graph tags (for organic shares) and load fast on mobile data, because ad traffic arrives on phones.
- US-7: The order form resists bots and double submits (rate limit, idempotency key, bot protection that is as invisible as possible so it does not hurt conversion).
- US-8: The landing URL's UTM parameters (source, medium, campaign, content) and the product slug are saved on the order, so the client can see which ad produced which order. Meta Pixel or Conversions API tracking is **not** Phase 1 (Q27).
- US-9: The pages must work inside Facebook's in-app browser on real Android and iPhone devices. This is **UNVERIFIED** and must be tested early: form submit, `tel:` and `wa.me` links, and no reliance on browser storage.

### 2.2 Manager dashboard
- US-10: I see new orders in real time (pop-up plus list) and unassigned orders in a queue.
- US-11: I can create an order on behalf of a customer (for orders that came through WhatsApp).
- US-12: I can assign an order to an agent manually, reassign it, or press **Auto-assign**.
- US-13: Auto-assign picks an active agent covering the order's county, who has enough stock for every item, and who has the fewest open orders. If none qualifies, the order stays unassigned with a reason shown.
- US-14: I can filter orders by status, agent, county and date, and see an order's full history.
- US-15: I can cancel an order and reschedule one.
- US-16: I can approve or reject agent registrations (D26), and manage agents (deactivate, set counties, link their sheet tab).
- US-17: I can manage the product catalogue and bundle prices.
- US-18: I can see stock per agent and per product, issue stock to an agent, record returns and adjustments, and see the movement history.
- US-19: I can see payments recorded by agents, grouped by agent and method, to reconcile cash.

### 2.3 Agent portal (PWA)
- US-37: I can register with my name, phone number and a password. I cannot sign in until the manager approves my account (D26).
- US-30: I log in on my phone and can install the app to my home screen.
- US-31: I get an in-app pop-up when an order is assigned to me, and see unread assignments after logging in.
- US-32: I see only my orders, with customer name, phone (tap to call), county, location, products and amount. I never see other agents' details or orders, and I see a customer's details only while the order is assigned to me (D27).
- US-33: I can mark an order **Dispatched**. This sends the customer an SMS.
- US-34: I can mark an order **Delivered**, which requires choosing the payment method (cash or M-Pesa to my own account) and entering the amount collected (D34). If it differs from the order total it is accepted and flagged to the manager.
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
