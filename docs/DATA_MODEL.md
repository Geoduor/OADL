# Data Model

Status: Draft v0.1, 2026-11-15. Conceptual model for Prisma. Field names are proposals; items marked `UNCONFIRMED` depend on `OPEN_QUESTIONS.md`.

Conventions: money is integer KES; phones are E.164; timestamps are UTC; IDs are UUIDs (or cuid, decide at scaffold).

## Implementation status

Implemented in Prisma (migration `add_products`, 2026-11-17): `Product` and `ProductPrice`, with the fields listed below. Every other entity is still design only; each is added with the feature that needs it. IDs are UUID strings (`@default(uuid())`, stored as `TEXT`). Not yet decided: whether all tables get `createdAt` / `updatedAt` columns (Order, history and ledger tables already list their own timestamps).

## Entities

### User
`id`, `name`, `email` (nullable), `phone` (nullable, E.164), `passwordHash`, `role` (`MANAGER` | `AGENT`), `active`, `createdAt`.
At least one of email or phone is required and unique.

### Agent
`id`, `userId` (1:1 with a User of role AGENT), `displayName`, `active`, `sheetTabId` (the numeric Google `sheetId` of the agent's tab, **not** the tab title, because titles contain irregular text such as `JEOFREY -NAIROBI`).
Verified sheet tab IDs on 2026-11-15: `0`, `237653016`, `1797378097` (assignment to agents to be confirmed, Q4).

### County
`id`, `name` (unique), `code`. Seeded with Kenya's counties. Exact list to be seeded from an authoritative source and checked at implementation.

### AgentCounty
`agentId`, `countyId` (unique pair). Which counties an agent covers (Q4).

### Product
`id`, `name` (for example PROSTGUARD), `slug` (unique), `description`, `imageUrl`, `active`, `sortOrder`.

### ProductPrice (bundle price)
`id`, `productId`, `quantity`, `priceKes`, `compareAtPriceKes` (nullable, display only: the struck-through "was" price, Q25), `active`. Unique on (`productId`, `quantity`). Bundle prices are per product: the example pages shared on 2026-11-15 show different bundle prices from the PROSTGUARD prices in the sheet (Q24).
Observed in the sheet and to be confirmed (Q2): PROSTGUARD quantity 1 = 3,999; 2 = 5,500; 3 = 7,000. MALACAP quantity 1 = 3,500. SEAMOSS quantity 1 = 3,999 (quantity not shown in the sheet).
Rule for quantities without a defined price: **not allowed** until Q2 is answered.

### Order
`id`, `orderNo` (unique, human readable; proposal `OADL-YYMMDD-####`), `idempotencyKey` (unique, nullable), `source` (`STOREFRONT` | `MANAGER_CREATED`), `customerName`, `customerPhone` (E.164), `countyId`, `town` (free text, required), `addressText` (free text, optional; Q26), `landingSlug` (nullable), `utmSource`, `utmMedium`, `utmCampaign`, `utmContent` (all nullable, from the ad link), `status`, `assignedAgentId` (nullable), `scheduledDate` (nullable date; meaning per Q1), `totalKes`, `attemptCount` (default 0), `notes`, `createdAt`, `updatedAt`, `deliveredAt`.

### OrderItem
`id`, `orderId`, `productId`, `quantity`, `lineTotalKes`. Price is **copied at purchase time** from `ProductPrice`, so later price edits never change old orders.

### OrderStatusHistory (append-only)
`id`, `orderId`, `fromStatus`, `toStatus`, `changedByUserId` (nullable for system), `reason`, `createdAt`.

### Payment (append-only)
`id`, `orderId`, `method` (`CASH` | `MPESA` | `PAYBILL`), `amountKes`, `reference` (nullable, for M-Pesa or paybill code; whether required is UNCONFIRMED), `recordedByUserId`, `createdAt`.

### StockMovement (append-only ledger)
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

Counties, the products listed above with their observed bundle prices (flagged as unconfirmed), one manager user, and test agents with fake names and numbers. **Never seed real customer data.**
