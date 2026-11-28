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

## 6. Notification research (2026-11-27)

Verified from the sources linked below unless marked.

- **Web Push needs an active service worker** and works whether or not the app is in the foreground or even loaded; the service worker is started to handle the push (MDN, Push API). A subscription is an endpoint plus encryption keys; the endpoint is a secret capability URL and subscription endpoints need CSRF protection (MDN). In Chrome there is no quota on push messages (MDN).
- **iPhone:** Web Push arrived in iOS and iPadOS 16.4 and works only for web apps **added to the Home Screen**; permission can only be requested in response to a direct user action such as tapping a button (WebKit blog). Agents on iPhone must install the PWA first. Android phones are the common case, but which phones the agents use is still open (Q11).
- **VAPID keys and the server library (verified 2026-11-28):** `web-push` 4.0.0 (npm, MPL-2.0, Node 16 or newer, ESM; modified 2026-11-06). Generate one key pair with `web-push generate-vapid-keys` and reuse it; `sendNotification` takes the subscription, a string payload and options (`TTL` in seconds, default four weeks; `urgency`; `topic`); the subject must be `https:` or `mailto:` and not localhost (Apple Push may reject it with 403 BadJwtToken); a failed send throws with `statusCode`. Sources: [web-push README](https://github.com/web-push-libs/web-push), `npm view web-push`.
- **Subscribing (MDN, PushManager.subscribe):** needs HTTPS and a service worker registration; `userVisibleOnly: true` is required by Chrome and Edge; `applicationServerKey` is the VAPID public key; call it from a user gesture (a button tap). Source: [MDN](https://developer.mozilla.org/docs/Web/API/PushManager/subscribe).
- **Expired devices:** a push service answers 410 Gone for an expired or unsubscribed subscription and the server should delete it ([Pushpad](https://pushpad.xyz/blog/web-push-error-410-the-push-subscription-has-expired-or-the-user-has-unsubscribed)). Treating 404 the same is UNVERIFIED. iOS delivery goes through Apple's push service; allow `*.push.apple.com` (WebKit). The allow-list of push-service hosts for other browsers is UNVERIFIED, so the API currently accepts only https, port 443, public host names (`push-endpoint.ts`).
- **Cost of Web Push:** no vendor fee was found in the sources above, but not checked against Google's and Apple's push services' terms (UNVERIFIED).
- **Limit of in-app notifications (Phase 1, D11):** the live pop-up only reaches an agent who has the portal open. An agent with the app closed gets nothing until Web Push exists (Phase 2 in the roadmap). The stored notification list is still the source of truth after reconnecting.
- **Customer SMS (Phase 1, Q6)** is a paid service and needs the owner's approval. One Kenyan vendor's own page lists KES 0.60 per SMS under 5,000 a month and a KES 6,500 one-time sender ID per network; another source (a help page that did not name its provider, so not confirmed to be Africa's Talking) lists a sender ID at KES 7,500 + 16% VAT = KES 8,700. Application takes days (5 to 14 working days quoted). Prices are vendor list prices, UNVERIFIED for OADL; compare providers before choosing.

Sources: [MDN Push API](https://developer.mozilla.org/en/docs/Web/API/Push_API), [WebKit: Web Push for Web Apps on iOS and iPadOS](https://webkit.org/?p=13878), [Celcom Africa bulk SMS pricing](https://celcomafrica.com/bulk-sms-pricing), [sender ID help page](https://help.africastalking.com/en/articles/407085-how-do-i-set-up-my-sender-id-in-kenya-or-uganda).
