# Integrations

Status: Draft v0.1, 2026-11-15. **Rule:** before implementing any integration below, read the provider's current official documentation. Rates, limits, approval steps and API behaviour have not been verified here.

## 1. Google Sheets (Phase 1, one-way: database to sheet)

**Sheet:** "OADL-AGENTS SHEET ORDERS" (ID in the `GOOGLE_SHEET_ID` variable, not in code). Verified tabs on 2026-11-15:

| Tab title | `sheetId` |
|---|---|
| `JEOFREY -NAIROBI` | 0 |
| `ANDY COLE-COAST` | 237653016 |
| `BRAMUEL -KSM & OTHERS` | 1797378097 |

Tabs are linked to agents by **`sheetId`** (`Agent.sheetTabId`), never by title.

### Access
Use a Google **service account** and share the sheet with its email as Editor. The credentials live in an environment variable. Confirm the current setup steps in the official Google Sheets API docs.

### Current layout (from screenshots; there is no header row)

| Column | Content today | Notes |
|---|---|---|
| A | Date | Meaning unconfirmed (Q1). Formats are inconsistent (`13/112026` seen) |
| B | Client name | |
| C | Phone | Leading 0 is lost (9 digits); one value has 8 digits |
| D | Product with quantity as text, e.g. `1 PROSTGUARD` | Typos exist (`PROATGUARD`) |
| E | Amount (KES) | |
| F | Location (free text) | |
| G | Status text, green when `DELIVERED` | Legend in row 1: DELIVERED (green), UNRESPONSIVE (red), RESCHEDULED (cyan). The legend sits in B1:D1 on one tab and C1:E1 on the others |

### Proposed layout (pending the improved sheet, Q5)
Keep columns A to G exactly as above and **add column H = Order ID** (the `orderNo`). Add a header row and protect system-written columns so agents do not edit them (Q20). The sync never relies on row position, only on the Order ID, so sorting or inserting rows is safe.

### Sync rules
1. On assignment, upsert a row in the assigned agent's tab (find by Order ID in column H; if missing, append).
2. On every later status change, update the status cell (G) and any changed fields.
3. On reassignment, remove or mark the row in the old agent's tab and create it in the new one (exact behaviour to agree, Q5).
4. Value formats: phone as text in local display format (to agree), date as `DD/MM/YYYY`, product text as `{quantity} {PRODUCT NAME}` joined with ` + `, status text from the legend (`DELIVERED`, `UNRESPONSIVE`, `RESCHEDULED`); non-final statuses leave the cell blank, as today (Q17).
5. Row colours come from conditional formatting set once in the sheet, not per write (confirm at implementation).
6. Handlers are idempotent and retried by the outbox; failures are visible in the manager dashboard.
7. Respect the Sheets API quotas (check current limits); batch writes where possible.
8. The sync **never reads** sheet edits back into the database.

### Privacy
The sheet holds customer names and phones. Restrict who it is shared with and keep the service account the only automated writer.

## 2. SMS to customer on dispatch (Phase 1)

- Implement behind a `SmsProvider` interface (`send(to, template, params)`) so the provider can change without touching business code.
- Provider, pricing, sender name registration and delivery reports for Kenya: **UNVERIFIED** (Q6). Candidate named in discussion: Africa's Talking. Compare with at least one other provider before deciding.
- Template (draft wording for client approval): order number, agent first name, a short "your order is on the way" line, no health claims. Wording and language to be approved by the client.
- SMS failure never blocks dispatch; it is retried and logged (`SmsLog`).

## 3. WhatsApp (Phase 1: click-to-chat only)

The storefront "Talk to us" button opens `https://wa.me/<manager number without +>?text=<url-encoded message>` with a pre-filled message (product and page link). Number from `MANAGER_WHATSAPP_NUMBER` (Q9). Orders agreed over WhatsApp are entered by the manager with "create order on behalf of customer".
Automated WhatsApp notifications are Phase 3 and need the provider's business API approval, which is unverified.

## 4. In-app notifications (Phase 1)

WebSocket gateway for live pop-ups plus a stored `Notification` list. On reconnect, the client fetches unread notifications.

## 5. Web Push (Phase 2)

Service worker plus push subscriptions so agents are notified when the app is closed. Platform support, especially on iPhone, must be checked against current documentation (Q11).

## 6. Payments (Phase 3)

Phase 1 records on-delivery payments only. For online M-Pesa, the Safaricom Daraja API is the expected route, but how a paybill settling into Family Bank is onboarded is **UNVERIFIED**. The company's finance contact should confirm with Safaricom or the bank before design. Build the payment layer behind an interface. A possible reconciliation idea (use the order number as the paybill account number) depends on what the paybill setup allows.

## 7. Distance-based assignment (Phase 2)

Needs customer coordinates (map pin) or a geocoding service. Provider, cost and Kenya coverage are **UNVERIFIED**. Phase 1 assigns by county.
