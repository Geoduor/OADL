# Data Model

Status: Draft v0.1, 2026-11-15. Conceptual model for Prisma. Field names are proposals; items marked `UNCONFIRMED` depend on `OPEN_QUESTIONS.md`.

Conventions: money is integer KES; phones are E.164; timestamps are UTC; IDs are UUIDs (or cuid, decide at scaffold).

## Implementation status

Implemented in Prisma: `Product` and `ProductPrice` (migration `add_products`, 2026-11-17) and `County`, `Order`, `OrderItem` and `OrderStatusHistory` (migration `add_orders`, 2026-11-22). `User` and `Session` (auth sessions, no foreign key to `users` so users are never hard-deleted with their sessions; migration `add_users_sessions`) are implemented as of Step 6a. Every other entity is still design only; each is added with the feature that needs it. `Order.assignedAgentId`, `OrderStatusHistory.agentId` (the agent assigned after the change) and `OrderStatusHistory.changedByUserId` (null for the customer's own placement) were added with the status service (migration `add_order_status_links`). `OrderStatus` has the eight values in `ORDER_LIFECYCLE.md`, including the proposed `CONFIRMED`. IDs are UUID strings (`@default(uuid())`, stored as `TEXT`). Not yet decided: whether all tables get `createdAt` / `updatedAt` columns (Order, history and ledger tables already list their own timestamps).

## Entities

### User
`id`, `name`, `email` (nullable), `phone` (required and unique in Phase 1, E.164), `passwordHash`, `role` (`MANAGER` | `AGENT`), `status` (`PENDING` | `ACTIVE` | `DISABLED`; a self-registered agent starts `PENDING` until the manager approves, D26; only `ACTIVE` users can sign in), `createdAt`.
`email` is nullable and unique when present; it is not used to sign in yet. In Phase 1 staff sign in with the phone number (D24).

### Agent
Implemented (migration `add_agents`) except `sheetTabId`, which comes with the Sheets sync. `id`, `userId` (1:1 with a User of role AGENT), `displayName`, `active` (whether the agent receives assignments; separate from the account `status`), `sheetTabId` (the numeric Google `sheetId` of the agent's tab, **not** the tab title, because titles contain irregular text such as `JEOFREY -NAIROBI`).
Verified sheet tab IDs on 2026-11-15: `0`, `237653016`, `1797378097` (assignment to agents to be confirmed, Q4).

### County
`id`, `name` (unique), `code` (unique integer). Seeded with the 47 counties from the First Schedule of the Constitution of Kenya (source linked in `apps/api/prisma/data/counties.ts`); `code` is the number in the Schedule. Names are as written there (for example `Nairobi City`, `Taita/Taveta`); storefront display names are to be confirmed.

### AgentCounty
Implemented. `agentId`, `countyId` (composite key). Which counties an agent covers (Q4). The manager sets them when approving the agent (D31); several agents may cover one county.

### Product
`id`, `name` (for example PROSTGUARD), `slug` (unique), `description`, `imageUrl`, `active`, `sortOrder`.

### ProductPrice (bundle price)
`id`, `productId`, `quantity`, `priceKes`, `compareAtPriceKes` (nullable, display only: the struck-through "was" price, Q25), `active`. Unique on (`productId`, `quantity`). Bundle prices are per product: the example pages shared on 2026-11-15 show different bundle prices from the PROSTGUARD prices in the sheet (Q24).
Observed in the sheet and to be confirmed (Q2): PROSTGUARD quantity 1 = 3,999; 2 = 5,500; 3 = 7,000. MALACAP quantity 1 = 3,500. SEAMOSS quantity 1 = 3,999 (quantity not shown in the sheet).
Rule for quantities without a defined price: **not allowed** until Q2 is answered.

### Order
`id`, `orderNo` (unique, human readable; proposal `OADL-YYMMDD-####`), `idempotencyKey` (unique, nullable), `source` (`STOREFRONT` | `MANAGER_CREATED`; manager-created orders start `CONFIRMED` and may carry a manager-set `totalKes`, with the reason in the first history row, D36), `customerName`, `customerPhone` (E.164), `countyId`, `location` (free text, required; D20 replaced the earlier `town` + optional `addressText` split), `landingSlug` (nullable), `utmSource`, `utmMedium`, `utmCampaign`, `utmContent` (all nullable, from the ad link), `status`, `assignedAgentId` (nullable), `scheduledDate` (nullable date; meaning per Q1), `totalKes`, `attemptCount` (default 0), `notes`, `createdAt`, `updatedAt`, `deliveredAt`.

### OrderItem
`id`, `orderId`, `productId`, `quantity`, `lineTotalKes`. Price is **copied at purchase time** from `ProductPrice`, so later price edits never change old orders.

### OrderStatusHistory (append-only)
`id`, `orderId`, `fromStatus`, `toStatus`, `changedByUserId` (nullable for system), `reason`, `createdAt`.

### Payment (append-only)
Implemented (migration `add_payments`), per D34. `id`, `orderId`, `agentId` (the agent who collected and holds the money), `method` (`CASH` | `MPESA`; `PAYBILL` was dropped because customers pay the agent, and can be added by a migration if a company paybill takes customer payments), `amountKes`, `recordedByUserId`, `createdAt`. No `reference` column: no M-Pesa code is required for now (D34). The manager's order views compute `paidKes` and `paymentMismatch` (not stored).

### StockMovement (append-only ledger)
Implemented (migration `add_stock_movements`), per D35. Quantities are in units (`OrderItem.quantity`). One `DELIVERY` row per order and product (unique key). Delivery rows are written in the same transaction as the status change. A negative on-hand is allowed after a delivery and shown as `needsAttention` to the manager.

`id`, `agentId`, `productId`, `type`, `quantity` (signed integer), `orderId` (nullable), `note`, `createdByUserId`, `createdAt`.

| Type | Sign | When |
|---|---|---|
| `ISSUE` | + | Manager gives stock to an agent |
| `DELIVERY` | - | Order marked Delivered |
| `RETURN_TO_STORE` | - | Agent returns stock to the company |
| `ADJUSTMENT` | +/- | Count correction or damage, **reason required** |

**On hand** = sum of an agent's movements per product.
**Reserved** = sum of item quantities on that agent's open orders (`ASSIGNED`, `DISPATCHED`, `RESCHEDULED`, `UNRESPONSIVE`). Derived, not stored.
**Available** = on hand − reserved. Assignment requires available ≥ requested quantity for every item.
Stock is deducted only when an order becomes `DELIVERED`.

### Notification
`id`, `userId`, `type`, `title`, `body`, `orderId` (nullable), `readAt` (nullable), `createdAt`.

### OutboxItem
`id`, `type` (`SHEET_UPSERT_ORDER` | `SMS_DISPATCH`; Phase 2 adds push), `payload` (JSON), `status` (`PENDING` | `DONE` | `FAILED`), `attempts`, `nextAttemptAt`, `lastError`, `orderId`, `createdAt`.

### SmsLog
`id`, `orderId`, `toPhone`, `template`, `providerMessageId` (nullable), `status`, `createdAt`. Stores no message content beyond the template name.

## Relationships (summary)

- User 1:1 Agent; Agent many:many County via AgentCounty.
- Product 1:many ProductPrice; Order 1:many OrderItem; OrderItem many:1 Product.
- Order 1:many OrderStatusHistory, Payment, StockMovement (via `orderId`), OutboxItem.
- Order many:1 Agent (nullable) and many:1 County.

## Constraints and indexes

- Unique: `Order.orderNo`, `Order.idempotencyKey`, (`ProductPrice.productId`, `quantity`), (`AgentCounty.agentId`, `countyId`).
- Indexes: `Order(status)`, `Order(assignedAgentId, status)`, `Order(countyId)`, `Order(createdAt)`, `StockMovement(agentId, productId)`, `OutboxItem(status, nextAttemptAt)`.
- A check that a `DELIVERED` order has at least one `Payment` row is enforced in the service layer inside the same transaction.
- Append-only tables have no update or delete endpoints.

## Seed data (development)

**Implemented so far:** `apps/api/prisma/seed.ts` seeds only PROSTGUARD and its three bundles (1, 2 and 3 units at 3,999, 5,500 and 7,000 KES). It uses `upsert` with an empty update, so re-running it never overwrites later edits. Description, image and compare-at price are left empty until the client approves them (Q14, Q25). The rest of this section is still planned.

Counties (implemented: all 47), the products listed above with their observed bundle prices (flagged as unconfirmed), one manager user, and test agents with fake names and numbers. **Never seed real customer data.**
