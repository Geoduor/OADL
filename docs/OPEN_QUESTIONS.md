# Decisions and Open Questions

Last updated: 2026-11-15. This file is the register of what is confirmed and what is not. Move an item from "Open" to "Confirmed" only when the client or developer has said so, and record the date.

## Confirmed decisions

| ID | Decision | Source |
|---|---|---|
| D1 | Stack: NestJS + PostgreSQL + Prisma API; Next.js storefront; React (Vite) manager and agent app; agent side is a mobile-first PWA | Developer, 2026-11-15 |
| D2 | FastAPI is not used in Phase 1 | Agreed in discussion |
| D3 | Hosting: **Render** (paid web service and paid Render Postgres) for the API and database, **Vercel** for the storefront and portal. Supabase is **not** used | Developer, 2026-11-15; tiers see Q7 |
| D4 | Customers reach the shop through a link shared on the company's Facebook page | Developer |
| D5 | Payment is **on delivery** in Phase 1 (cash, M-Pesa, paybill, recorded by the agent) | Developer |
| D6 | Kenya only, currency KES | Developer |
| D7 | About 7 to 10 agents nationwide; each agent carries **their own stock** | Developer |
| D8 | Assignment: manager can assign manually, or the system auto-assigns by **county** in Phase 1 (distance is Phase 2) | Developer and agreed adjustment |
| D9 | Proof of delivery is the agent tapping **Delivered** (plus payment method and amount) | Developer |
| D10 | Prices are fixed. The 3,500 discounted PROSTGUARD row seen in the sheet is rare and is **not** modelled | Developer |
| D11 | Notifications in Phase 1: in-app pop-up for agents and manager; **SMS to the customer on dispatch** | Developer |
| D12 | Google Sheets sync is in **Phase 1**, one-way (database to sheet) | Developer |
| D13 | The company is certified to sell these products (regulation is not a blocker) | Developer |
| D14 | Customers enter their location as free text; a county selection is added for assignment | Developer's free-text, county proposed (see Q4) |
| D16 | API scaffold: NestJS 12, ESM module system, Vitest, oxlint, TypeScript strict. NestJS Observe and Mau were deliberately **not** adopted | Developer, 2026-11-15 |
| D15 | Sheet "OADL-AGENTS SHEET ORDERS" has 3 tabs: `JEOFREY -NAIROBI`, `ANDY COLE-COAST`, `BRAMUEL -KSM & OTHERS` (verified via the Sheets connector) | Verified 2026-11-15 |

## Open questions

Mark each as answered with a date when resolved.

| ID | Question | Blocks |
|---|---|---|
| Q1 | Is sheet column A the **delivery date** (scheduled) or the order date? Rows with future dates and blank status exist. Working assumption: scheduled delivery date | Sheet mapping |
| Q2 | Full product list (5 to 10) with prices. Observed only: PROSTGUARD 3,999 / 2 for 5,500 / 3 for 7,000; MALACAP 3,500; SEAMOSS 3,999. What is the rule for **quantities above the listed bundles** (for example 4 PROSTGUARD)? Until answered, the storefront offers only defined bundle sizes | Pricing, storefront |
| Q3 | Is "PROATGUARD" in the sheet a typo of PROSTGUARD? | Product seed data |
| Q4 | Which counties does each agent cover? Are there agents beyond the 3 tabs? What happens to a county with no agent (working assumption: manager queue as "unassigned")? | Auto-assignment |
| Q5 | The improved Google Sheet (header row, Order ID column, status values). Until it arrives, `docs/INTEGRATIONS.md` describes a **proposed** layout | Sheet sync |
| Q6 | SMS provider, current pricing, and sender name registration for Kenya. Not verified | SMS |
| Q7 | Hosting plan decision. **Verified 2026-11-15 from Render's docs:** free web services sleep after 15 minutes idle; free Postgres expires after 30 days (14-day grace, then deleted), is capped at 1 GB, has no backups, and Render says free instances are not for production. **Not verified:** whether Vercel's Hobby plan permits a commercial site (the fair-use page points to the Terms of Service; read it), Supabase free-plan terms, and paid Render prices. Decision D3 adopts Render paid web service + Render paid Postgres, Vercel for the front ends, no Supabase. Still open: paid Render prices and the Vercel plan question | Deployment |
| Q8 | Delivery fee: does the sheet amount ever include a delivery fee? None seen | Pricing |
| Q9 | Manager WhatsApp number and hours for the "Talk to us" button | Storefront |
| Q10 | How many manager or admin users, and do they need different permissions? | Auth |
| Q11 | What phones do agents use (Android or iPhone)? Affects background push in Phase 2 (unverified) | Phase 2 |
| Q12 | Stock workflow: who issues stock to agents, how are returns, damages and stock counts recorded? | Stock module |
| Q13 | Does the storefront block or warn when the covering agent is out of stock? | Storefront |
| Q14 | Product copy for the storefront (descriptions, images, any allowed claims). The client should approve all wording | Storefront |
| Q15 | Policy for cancellations, returns and refused deliveries | Order lifecycle |
| Q16 | Does the manager phone-confirm each order before assigning? (recommended to limit fake orders, not confirmed) | Order flow |
| Q17 | In the sheet, what should non-final statuses (Assigned, Dispatched) look like? Working assumption: leave the status cell blank, as today | Sheet sync |
| Q18 | What does "OADL" stand for? Branding, logo and domain name | README, storefront |
| Q19 | Data retention period for customer data and registration obligations under Kenya's Data Protection Act (company to confirm) | Compliance |
| Q20 | Should agents keep editing the sheet by hand after go-live? Recommended no (protected columns), because two writers cause drift | Sheet sync |
| Q21 | DTO validation approach: `class-validator` or a Standard Schema library such as Zod (Nest's own guidance says both work; Zod could be shared by the storefront, portal and API). Decide before the first DTO | API |
| Q22 | Does Prisma work with this ESM NestJS 12 scaffold? Not verified. Check Prisma's current docs at the start of the database step; if it does not, regenerate the empty scaffold as CommonJS | Database |
| Q23 | Storefront language: English, Swahili, or both? (The example pages are in Swahili and English.) | Storefront copy |
| Q24 | Are any of the example pages the client's own? The example Black Seed / Sea Moss page shows 3,999 / 5,499 / 7,999 for 1 / 2 / 3 units, while the sheet shows PROSTGUARD at 3,999 / 5,500 / 7,000 and SEAMOSS at 3,999. Which bundle prices are correct for each product? | Pricing |
| Q25 | Does the client want struck-through "was" prices and "Save %" badges? They should show a genuine regular price (advertising and consumer-protection rules in Kenya are not verified here; the client should confirm) | Storefront |
| Q26 | Minimum order form fields. The examples require name, town and phone, with address optional. We also propose a county dropdown (one tap) so auto-assignment works. Is that acceptable, or must the form be shorter? | Storefront, assignment |
| Q27 | Who runs the Facebook ads, and what tracking is wanted (Meta Pixel, Conversions API)? Meta's ad rules for health products are not verified here. Tracking needs a privacy review (Q19) and is outside Phase 1 | Marketing, Phase 2 |
