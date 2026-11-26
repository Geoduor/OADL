# Deployment

Status: Draft v0.1, 2026-11-15. Platform details below are plans, not verified facts. Check each provider's current documentation and terms.

## Environments

| Environment | API | Storefront | Database |
|---|---|---|---|
| Local | `pnpm dev:api` | `pnpm dev:storefront` (http://localhost:3001) | Local PostgreSQL (Docker) or a separate dev database |
| Staging (recommended) | Render | Vercel preview | Separate Render Postgres (a cheaper plan; free Postgres expires after 30 days) |
| Production | Render (paid) | Vercel | Render Postgres (paid) |

## Go-live plan (researched 2026-11-26; costs need the owner's approval, AGENTS.md §9)

Verified from current official pages (links in "Sources" below):

- **Vercel Hobby is not for commercial use (so Vercel is not used, see decision below).** Terms, section 4: "You shall only use the Services under a Hobby plan for your personal or non-commercial use." OADL sells to customers, so the storefront and portal need **Vercel Pro**. Developer seats are $20 per user per month (Hobby plan page); whether Pro has a further base fee is UNVERIFIED (read the Pro plan page before approving). Free Hobby is fine only for throw-away staging.
- **Render web service:** `0.5c-512mb` is $7 a month (pricing page, 2026-11-26). Render's own Prisma guide says the pre-deploy command runs only on **paid** web services and uses `npx prisma migrate deploy` as the Pre-Deploy Command and the **internal** database URL for `DATABASE_URL`. Adapt to our pnpm commands and test on staging.
- **Render Postgres:** `0.1c-256mb` is $6 a month; the free database has no backups or recovery. Paid databases get point-in-time recovery: 3 days on the Hobby workspace, 7 days on Pro. Logical backups (dashboard download) are kept 7 days on every workspace plan. Backups stay in the database's region. A restore test is still required (item 2).
- **Region:** Render has no African region (Oregon, Ohio, Virginia, Frankfurt, Singapore). Frankfurt is probably closest to Kenya (inference, UNVERIFIED): measure from a Kenyan phone before choosing (Q28). API and database must share a region to use the private network.
- **Cloudflare Turnstile Free:** up to 20 widgets, 10 hostnames per widget, unlimited challenges, 7 days of analytics. One widget with the production hostnames is enough.
- **Domain:** `.ke` names can only be registered through KeNIC-accredited registrars; prices differ per registrar and KeNIC lists none, so compare registrars (price UNVERIFIED). Minimum one year.

Still UNVERIFIED: Render's client-IP header and the right `TRUST_PROXY` value (Render's docs did not say; a community thread was inconclusive, so test with two phones on staging); Vercel Pro base price; `.co.ke` price; Facebook-side steps (Sharing Debugger and in-app browser behaviour, US-9).

Decision (2026-11-26, owner): **everything runs on Render** (API, database, storefront, portal). Vercel Hobby is non-commercial, so Vercel is not used for the live site (a throw-away Hobby project is fine for staging tests with no real customers).

Render layout (verified from Render docs unless marked):

- **API:** Web Service, Node, paid, Pre-Deploy Command runs `prisma migrate deploy` (adapt to pnpm; UNVERIFIED on Render).
- **Storefront (Next.js, server rendered):** Web Service, Node, paid. Render's Next.js page shows Build `yarn; yarn build` and Start `yarn start`; our equivalents are pnpm commands (UNVERIFIED). Node version is set by `NODE_VERSION` or `.node-version`.
- **Portal (Vite SPA):** Static Site, free to deploy, custom domains free (2 on Hobby workspace); outbound bandwidth and build minutes count against the workspace's included amounts (amounts not stated on the page, UNVERIFIED). Add one **Rewrite** rule in the dashboard: Source `/*`, Destination `/index.html`, Action Rewrite (so refreshing `/orders/...` works). Render's page does not say whether this can live in `render.yaml`.
- **Monorepo:** commands run relative to the service's Root Directory. Native Node services can read files outside it (so the pnpm workspace root is reachable), but changes outside it do not trigger a deploy unless added to **Build Filters** (paths relative to the repo root). Set a Root Directory and build filters per service; pnpm behaviour itself is UNVERIFIED.
- Static sites and web services in the same workspace; all share one dashboard and bill.

Estimated monthly cost (list prices on 2026-11-26): API $7 + storefront $7 + database $6 = **$20**, plus the domain. Static site $0 plus any workspace overage. Needs the owner's approval before creating services.

Recommended order:

1. Choose and buy a domain (owner decides name; Q31). Use subdomains of one parent so the `__Host-sid` cookie rules and D30 hold, for example `shop.` (storefront), `app.` (portal), `api.` (API), or the bare domain for the shop.
2. Staging first on Render: Postgres + API web service (paid, so pre-deploy works), storefront web service, portal static site, each with its Root Directory and build filters.
3. Set the environment variables below; `CORS_ORIGINS` lists the storefront and portal origins; set `TRUST_PROXY` after testing.
4. Create the Turnstile widget with the production hostnames; set the secret and site key.
5. Create the manager (`create-manager`), run the release smoke test on a real phone.
6. Production: same steps with the production database; take a backup before the first migration.
7. Only then post the storefront link on Facebook and test it in the Facebook in-app browser on real phones (no Facebook integration exists in code, D4).

Sources: [Render static sites](https://render.com/docs/static-sites), [Render Next.js](https://render.com/docs/deploy-nextjs-app), [Render redirects and rewrites](https://render.com/docs/redirects-rewrites), [Render monorepos](https://render.com/docs/monorepo-support), [Vercel Terms](https://vercel.com/terms), [Vercel Hobby plan](https://vercel.com/docs/plans/hobby), [Render pricing](https://render.com/pricing), [Render Postgres backups](https://render.com/docs/postgresql-backups), [Prisma on Render](https://www.prisma.io/docs/orm/v7/prisma-client/deployment/traditional/deploy-to-render), [Turnstile plans](https://developers.cloudflare.com/turnstile/plans), [KeNIC registration](https://kenic.or.ke/ke-domain-registration-process/).

## Before go-live (blocking items)

0a. **Manager account and sessions:** there is no default account. Create the one manager (D23) once per environment with `MANAGER_NAME`, `MANAGER_PHONE` and `MANAGER_PASSWORD` set for that command only, then `pnpm --filter api create-manager`; it refuses to run if a manager exists. Set `CORS_ORIGINS` to the portal origin(s). Sessions live in PostgreSQL (the package refuses in-memory sessions in production). The `__Host-sid` cookie needs HTTPS and the API and portal on the same parent domain (D30, Q31 open).
0. **Public order endpoint protection:** `POST /orders` is rate limited (10 a minute per IP, 120 a minute for other routes, in memory, so correct for **one** API instance only) and verified with Cloudflare Turnstile. Before go-live: (a) **set `TRUST_PROXY` correctly.** Behind Render's proxy every visitor otherwise looks like the same IP and shares one limit, so real customers get blocked together. Read Render's current documentation and test with two phones; the right value is UNVERIFIED. (b) Create the Turnstile widget with the production hostnames and set `CAPTCHA_SECRET` and the site key. (c) Check Turnstile's current pricing and limits (UNVERIFIED). (d) Tune the limits with real ad traffic: many Kenyan mobile users can share one public IP. (e) If the API ever runs on more than one instance, move the rate-limit store out of memory.
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
| `NEXT_PUBLIC_API_URL` | storefront | API base URL, no trailing slash. Required in production (the build fails loudly if it is missing). The browser calls the API directly, not through Vercel, so the rate limit sees each customer's own IP |
| `NEXT_PUBLIC_SITE_URL` | storefront | The storefront's public address, used for link-preview (Open Graph) URLs |
| `NEXT_PUBLIC_CAPTCHA_SITE_KEY` | storefront | Public Turnstile site key |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | storefront | Manager WhatsApp number (digits only) |
| `VITE_API_URL` | portal | API base URL |
| `CORS_ORIGINS` | api | Browser origins allowed to call the API, comma separated, no paths: the portal (session cookie, D30) **and the storefront** (the public order form posts to the API from the browser, so its origin must be listed or the API refuses it). Empty means none. Also used as the CSRF trusted origins |
| `TRUST_PROXY` | api | How many proxies, or which addresses, to trust for the client IP (Express `trust proxy`). **UNVERIFIED value for Render**; see go-live item 0 |
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
