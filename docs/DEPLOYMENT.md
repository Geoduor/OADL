# Deployment

Status: Draft v0.1, 2026-11-15. Platform details below are plans, not verified facts. Check each provider's current documentation and terms.

## Environments

| Environment | API | Storefront | Database |
|---|---|---|---|
| Local | `pnpm dev:api` | `pnpm --filter storefront dev` (not created yet) | Local PostgreSQL (Docker) or a separate dev database |
| Staging (recommended) | Render | Vercel preview | Separate Render Postgres (a cheaper plan; free Postgres expires after 30 days) |
| Production | Render (paid) | Vercel | Render Postgres (paid) |

## Before go-live (blocking items)

0. **Public order endpoint protection:** `POST /orders` exists but has **no rate limiting or bot protection yet**. Do not expose the API publicly until both are in place (AGENTS.md section 6).
1. **Plan terms (Q7):** the API must run on a **paid, always-on Render instance** (free instances sleep after 15 minutes, which would break real-time pop-ups and the outbox worker), and the database must be a **paid Postgres** (Render's free Postgres expires after 30 days and has no backups). Read Vercel's Terms of Service fair-use section to confirm the plan used for the storefront and portal is allowed for a commercial site.
2. **Backups:** confirm what backups the chosen database plan includes and test a restore.
3. **Prisma and Render Postgres:** read current documentation on connection strings (internal vs external URL), connection limits and migrations on Render before configuring `DATABASE_URL`. Region choice (closest to Kenya that Render offers) is to be checked (Q28). Production applies migrations with `prisma migrate deploy`, never `migrate dev` (this is Prisma's usual production command; confirm it in the current docs and decide where it runs on Render, for example a pre-deploy step).
4. **CORS and cookies:** allow only the storefront and portal origins.
5. **SMS provider** set up and sender name approved if required (Q6).
6. **Google service account** created and the sheet shared with it.
7. **Manager account** created with a strong unique password. No default credentials.
8. **Domains and HTTPS** for the storefront, portal and API.
9. **Node version and port on Render:** NestJS's docs say the app needs Node 20.19+ or 22.12+; the API is developed on Node 24. Check how Render selects the Node version and which `PORT` it provides (the API already reads `process.env.PORT`), and pin the version so production matches development.
10. **Build command:** the API's `build` script runs `prisma generate --no-hints` before `nest build`, because the generated client is not committed. `prisma generate` was verified to work without `DATABASE_URL`. Always keep `--no-hints`: without it the Prisma CLI shows an interactive prompt (about installing AI agent skills) that may stall a non-interactive build (not verified on Render).
11. **pnpm build-script approval:** pnpm 11 blocks dependency install scripts by default. `pnpm-workspace.yaml` (committed) sets `allowBuilds` to `true` for `prisma` and `@prisma/engines`. Confirm that Render's pnpm honours it (unverified) and that the Prisma engine download is not blocked by the build environment.
12. **PostgreSQL version:** local development is on 18.4; Render supports 18 (D18).

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
| `CAPTCHA_SECRET` | api | Bot-protection verification (Cloudflare Turnstile secret key, D22) |
| `NEXT_PUBLIC_API_URL` | storefront | API base URL |
| `NEXT_PUBLIC_CAPTCHA_SITE_KEY` | storefront | Public Turnstile site key |
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
