# Order Lifecycle

Status: Draft v0.1, 2026-11-15. Statuses `DELIVERED`, `UNRESPONSIVE` and `RESCHEDULED` come from the company's current sheet legend. `PLACED`, `ASSIGNED`, `DISPATCHED` and `CANCELLED` follow the described flow and the agreed design. `CONFIRMED` was added 2026-11-19 (D21); its **name is a proposal** pending the developer's OK.

## Statuses

| Status | Meaning |
|---|---|
| `PLACED` | Order received, not yet phone-confirmed |
| `CONFIRMED` | Manager phoned the customer and confirmed the order; not yet assigned (D21, name proposed) |
| `ASSIGNED` | Manager or system assigned an agent |
| `DISPATCHED` | Agent is on the way to the customer (customer gets an SMS) |
| `DELIVERED` | Delivered and payment recorded. Final |
| `UNRESPONSIVE` | Agent could not reach the customer |
| `RESCHEDULED` | New delivery date agreed |
| `CANCELLED` | Order cancelled. Final |

## State diagram

```mermaid
stateDiagram-v2
    [*] --> PLACED
    PLACED --> CONFIRMED: manager confirms by phone
    PLACED --> UNRESPONSIVE: manager cannot reach customer
    CONFIRMED --> ASSIGNED: manager assigns / auto-assign
    CONFIRMED --> CANCELLED: manager cancels
    PLACED --> CANCELLED: manager cancels
    ASSIGNED --> DISPATCHED: agent
    ASSIGNED --> UNRESPONSIVE: agent
    ASSIGNED --> RESCHEDULED: agent or manager
    ASSIGNED --> ASSIGNED: manager reassigns
    ASSIGNED --> CANCELLED: manager
    DISPATCHED --> DELIVERED: agent (payment required)
    DISPATCHED --> UNRESPONSIVE: agent
    DISPATCHED --> RESCHEDULED: agent or manager
    DISPATCHED --> CANCELLED: manager
    UNRESPONSIVE --> RESCHEDULED: agent or manager
    UNRESPONSIVE --> DISPATCHED: agent retries
    UNRESPONSIVE --> CANCELLED: manager
    UNRESPONSIVE --> PLACED: manager retries (D32)
    UNRESPONSIVE --> CONFIRMED: manager retries (D32)
    RESCHEDULED --> DISPATCHED: agent
    RESCHEDULED --> ASSIGNED: manager reassigns
    RESCHEDULED --> CANCELLED: manager
    DELIVERED --> [*]
    CANCELLED --> [*]
```

## Transition rules

| From | To | Who | Requirements |
|---|---|---|---|
| PLACED | CONFIRMED | Manager | Manager has phoned the customer (D21) |
| PLACED | UNRESPONSIVE | Manager | Customer could not be reached at confirmation (D21). Increments `attemptCount` |
| CONFIRMED | ASSIGNED | Manager | Agent is active; stock available for all items. **Manual assign** (built): a shortfall returns 409 `INSUFFICIENT_STOCK` with the missing items, and the manager can repeat the request with `overrideStock: true` (the history notes the override). Auto-assign is not built |
| PLACED, CONFIRMED | CANCELLED | Manager | Reason |
| ASSIGNED | DISPATCHED | Assigned agent | Triggers customer SMS |
| ASSIGNED, DISPATCHED, UNRESPONSIVE | RESCHEDULED | Assigned agent or manager | New date required |
| DISPATCHED | DELIVERED | Assigned agent | Payment method (CASH or MPESA) and amount collected required (D34); a different amount is flagged, not blocked; sets `deliveredAt`; stock deducted from the delivering agent in the same transaction (D35); never blocked by missing stock |
| ASSIGNED, DISPATCHED | UNRESPONSIVE | Assigned agent | Increments `attemptCount` |
| UNRESPONSIVE | DISPATCHED | Assigned agent | Retry |
| UNRESPONSIVE | PLACED, CONFIRMED | Manager | Retry (D32). Releases the assigned agent, if any (the assistant's reading of D32, to confirm) |
| RESCHEDULED | DISPATCHED | Assigned agent | On or after the new date (not enforced strictly) |
| ASSIGNED, RESCHEDULED | ASSIGNED | Manager | Only before dispatch (D33). From ASSIGNED the agent must be a different one; from RESCHEDULED it may be the same agent. Releases the old agent's reservation, notifies both agents |
| Any non-final | CANCELLED | Manager | Reason required |

Anything not listed is rejected. `DELIVERED` and `CANCELLED` are final; corrections are made by the manager through an audited adjustment (design to be agreed, Q15).

## Side effects per transition

| Transition | Side effects |
|---|---|
| to PLACED | Manager notification; stored notification |
| to CONFIRMED | Stored history entry only (no SMS or sheet row yet; UNCONFIRMED) |
| to ASSIGNED | Agent notification; sheet row created or updated |
| to DISPATCHED | Customer SMS (outbox); sheet update |
| to DELIVERED | Payment row; stock movement; `deliveredAt`; sheet update (status DELIVERED) |
| to UNRESPONSIVE / RESCHEDULED | Manager notification; sheet update |
| to CANCELLED | Release reservation; sheet update (handling of cancelled rows, Q5) |

All of these run inside one service method; external effects are queued in the outbox (`ARCHITECTURE.md` 4.4).

## Open points

- Q16 is answered (D21): confirmation is required. Unreachable at confirmation ends in `UNRESPONSIVE` (developer, 2026-11-19). Retry from `UNRESPONSIVE` is answered by D32 and reassignment by D33 (developer, 2026-11-23). Still open: whether the client agrees, and the final status name of `CONFIRMED`.
- **Initial status by source (D36):** storefront orders start `PLACED`; orders the manager creates start `CONFIRMED` (creation writes the first history row, with who made it). From there the normal transitions apply.
- **Agent endpoints (2026-11-23):** an agent can send only `DISPATCHED`, `UNRESPONSIVE` or `RESCHEDULED`, only for orders currently assigned to them; any other order looks like a missing one (404). Delivery with payment (agent only, D34): the delivered order leaves the agent's view at once.
- **Implemented (2026-11-23) in `apps/api/src/orders/order-transitions.ts`:** every transition above. `DELIVERED` records the payment in the same transaction (D34); its stock deduction is built too (D35). Manager assignment checks stock (advisory under concurrency) but not county coverage (D8). Side effects (notifications, SMS, sheet, stock) are not built; the single service method `OrderStatusService.change` is where they will be queued. Manager assignment does not yet check county coverage or stock (D8, ROADMAP steps 5 and 7).
- Cancellation, refusal and return policy (Q15).
- Sheet text for `ASSIGNED` and `DISPATCHED` (Q17).
