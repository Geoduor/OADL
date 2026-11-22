# Customer Records and Reorders (proposal)

Status: Proposal v0.1, 2026-11-22. Nothing here is confirmed by the client. It answers the developer's suggestion of 2026-11-22: **keep customer records on the manager side, so the manager can send a new order to an agent when a past customer, including one who did not take an earlier order, orders again.** It also proposes an answer to Q30 (how long agents see customer details). This is **not legal advice**; the legal points must be checked with the client's lawyer (Q19).

## 1. Proposed design

1. **`Customer` record, manager only.** One row per phone number (E.164, unique). Fields: `id`, `phone`, `name` (latest), `countyId`, `location` (latest), `firstOrderAt`, `lastOrderAt`, `doNotContact` (boolean, for opt-outs), `createdAt`. Created or updated in the same transaction that creates an order. `Order` gets `customerId`, but **keeps its own copy** of name, phone and location, so history stays true if the customer later changes details.
2. **No leak to the public.** The public order endpoint answers the same way for new and returning customers, so nobody can use it to learn whether a phone number is a customer.
3. **Reorder = a new order, never a reopened one.** `DELIVERED` and `CANCELLED` are final (`ORDER_LIFECYCLE.md`). From a customer's page the manager chooses "New order from this one": items are copied, **prices are read again from the current price list**, the order is `MANAGER_CREATED` (status `PLACED`, then the normal confirm and assign steps), and an optional `reorderOfOrderId` links it to the earlier order. An order that is still `UNRESPONSIVE` or `RESCHEDULED` keeps using the existing lifecycle transitions instead.
4. **Agent view follows assignment (answers Q30, proposal).** An agent sees a customer's name, phone and location **only while the order is open and assigned to them** (`ASSIGNED`, `DISPATCHED`, `UNRESPONSIVE`, `RESCHEDULED`). After `DELIVERED`, `CANCELLED` or reassignment, the server stops returning those fields to the agent (order number, product, amount and payment stay, for cash reconciliation). The agent never sees the `Customer` record or the customer's other orders (D27). The manager handles any later contact.
5. **Retention and erasure.** Keep a customer record only while it serves the stated purposes (deliveries, repeat orders, accounting). Proposal: a retention period that the client sets (UNCONFIRMED); after it, or when the customer asks, the manager's "erase" action anonymises the `Customer` row and the personal fields on their orders (name, phone, location), keeps order totals and payments for accounting, and writes an audit entry.
6. **Privacy notice at collection.** The storefront form shows a short notice: who the company is, what the details are used for, how long they are kept, and how to ask for deletion. Whether repeat-order and marketing use needs a separate, unticked consent box is for the lawyer (see 2).
7. **No free-text health notes.** Manager notes on a customer are free text; the guidance is not to record medical details, because of 2.

## 2. What the law says (read 2026-11-22)

Sources: the [Data Protection Act, 2019 (ODPC copy)](https://www.odpc.go.ke/wp-content/uploads/2024/02/TheDataProtectionAct__No24of2019.pdf), the [ODPC handbook](https://www.odpc.go.ke/wp-content/uploads/2024/02/PERSONAL-DATA-PROTECTION-HANDBOOK.pdf) and the [ODPC FAQs](https://www.odpc.go.ke/faqs/). These pages were read through a summarising tool, so **quotes and section numbers must be checked against the Act itself** before anyone relies on them.

- **Keep only as long as needed.** Section 25 requires personal data to be collected for specified, legitimate purposes, limited to what is necessary, and kept in identifiable form no longer than necessary; section 39 repeats that retention is "only as long as may be reasonably necessary". The handbook gives **no fixed retention periods**. So "keep customers forever for possible reorders" is hard to defend; a stated purpose and a time limit are needed.
- **Erasure and correction.** Section 40: the person can have inaccurate data corrected and data erased "without undue delay" (conditions apply).
- **Lawful basis.** Section 30 lists consent, performance of a contract (delivering the order) and legitimate interests, among others. Delivering an order fits "contract". Keeping the record for later reorders or marketing is a separate purpose; which basis applies is a legal question.
- **Health status is sensitive personal data** (section 2). Sections 44 to 46 restrict processing of sensitive data, and section 46 says data relating to a person's health may only be processed under the responsibility of a health care provider or someone bound by professional secrecy. **A customer buying a product for a health condition may reveal their health.** Whether an order history of these products counts is a question for the lawyer. Until it is answered: collect the minimum, no medical notes, strict access control (D27), and no customer data in logs or tests (`AGENTS.md` section 6).
- **By design and default** (section 41) and **impact assessment** (section 31) for high-risk processing: ask the lawyer whether a data protection impact assessment is needed.
- **Breach notice** (section 43): the controller must tell the Data Commissioner within 72 hours of becoming aware of a breach. The company needs a written incident procedure before go-live.
- **Registration** (section 18): processing personal data requires registration with the ODPC. The ODPC FAQ says only entities with annual turnover **below KES 5 million and fewer than 10 employees** are exempt, and some sectors, including health provision, are never exempt. A commercial guide also lists pharmacies and wellness businesses; that guide is not authoritative. The company probably must register; the client should confirm. The FAQ gives indicative one-time fees by size band (confirm on odpc.go.ke before paying) and a certificate valid for 24 months, renewed at least 30 days before expiry. **UNVERIFIED**: the registration regulations themselves could not be read.
- **Not checked:** how long tax and accounting law requires sales records to be kept. This sets a floor on keeping order totals and payments and is UNVERIFIED.

## 3. Decisions needed from the client

| # | Question |
|---|---|
| 1 | Do they agree to this design: customer records on the manager side, reorders as new orders? |
| 2 | Retention period for a customer who stops ordering (for example anonymise after N months without an order)? Check the accounting-records requirement first |
| 3 | Is a separate, unticked box needed on the order form for keeping details for repeat orders or offers (adds a field, Q26)? |
| 4 | After delivery, may agents keep seeing the customer's name, phone and location, or only the manager (this proposal: only the manager)? |
| 5 | Lawyer: is an order history of these products health data under section 2 and section 46? Is a DPIA needed? Is the company registered with the ODPC? |

## 4. Where it fits

This is manager-side work in Phase 1 (`ROADMAP.md`, items 3 and 5): the `Customer` model comes with the manager's order list, and the agent masking rule comes with the agent portal. Neither is built yet. If the client agrees, this document is folded into `DATA_MODEL.md`, `ORDER_LIFECYCLE.md` and `OPEN_QUESTIONS.md` (Q19 and Q30), and the open items become entries there.
