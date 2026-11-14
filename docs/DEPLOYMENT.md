# Deployment

Status: Draft v0.1, 2026-11-15. Platform details below are plans, not verified facts. Check each provider's current documentation and terms.

## Environments

| Environment | API | Storefront | Database |
|---|---|---|---|
| Local | `pnpm --filter api dev` | `pnpm --filter storefront dev` | Local PostgreSQL (Docker) or a separate dev database |
| Staging (recommended) | Render | Vercel preview | Separate Render Postgres (a cheaper plan; free Postgres expires after 30 days) |
| Production | Render (paid) | Vercel | Render Postgres (paid) |

## Before go-live (blocking items)

1. **Plan terms (Q7):** the API must run on a **paid, always-on Render instance** (free instances sleep after 15 minutes, which would break real-time pop-ups and the outbox worker), and the database must be a **paid Postgres** (Render's free Postgres expires after 30 days and has no backups). Read Vercel's Terms of Service fair-use section to confirm the plan used for the storefront and portal is allowed for a commercial site.
2. **Backups:** confirm what backups the chosen database plan includes and test a restore.
3. **Prisma and Render Postgres:** read current documentation on connection strings (internal vs external URL), connection limits and migrations on Render before configuring `DATABASE_URL`. Region choice (closest to Kenya that Render offers) is to be checked.
4. **CORS and cookies:** allow only the storefront and portal origins.
5. **SMS provider** set up and sender name approved if required (Q6).
6. **Google service account** created and the sheet shared with it.
7. **Manager account** created with a strong unique password. No default credentials.
8. **Domains and HTTPS** for the storefront, portal and API.

## Environment variables (names only; never commit values)

| Variable | Used by | Purpose |
|---|---|---|
| `DATABASE_URL` | api | PostgreSQL connection |
| `DIRECT_URL` | api | Direct connection for migrations, if required by the host (verify) |
| `JWT_SECRET` | api | Token signing |
| `JWT_EXPIRES_IN` | api | Access token lifetime |
| `CORS_ORIGINS` | api | Allowed front-end origins |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | api | Service account credentials (consider base64) |
| `GOOGLE_SHEET_ID` | api | Target spreadsheet |
| `SMS_PROVIDER` | api | Provider selector |
| `SMS_API_KEY`, `SMS_USERNAME`, `SMS_SENDER_ID` | api | Provider credentials (names depend on provider) |
| `CAPTCHA_SECRET` | api | Bot-protection verification |
| `NEXT_PUBLIC_API_URL` | storefront | API base URL |
| `NEXT_PUBLIC_CAPTCHA_SITE_KEY` | storefront | Public CAPTCHA key |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | storefront | Manager WhatsApp number (digits only) |
| `VITE_API_URL` | portal | API base URL |
| `NODE_ENV`, `PORT`, `TZ` | api | Runtime (`TZ` optional; the app stores UTC) |

Keep `.env.example` in sync with this table.

## Release checklist

- CI green: lint, typecheck, unit and e2e tests.
- Database migration reviewed; a backup taken before applying to production.
- Seed data (counties, products, prices) confirmed with the client (Q2, Q4).
- Smoke test: place an order, assign, dispatch, deliver, check the stock ledger, the SMS and the sheet row.
- Health endpoint returns OK; error tracking and log access in place.
- Rollback plan written down.

## Operations

- Monitor failed outbox items daily until the system is trusted.
- Review manager and agent accounts monthly; deactivate leavers immediately.
- Rotate secrets if a device or person with access changes.
