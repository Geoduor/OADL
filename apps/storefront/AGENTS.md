<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Storefront rules (OADL)

Read the root `AGENTS.md` and `docs/OPEN_QUESTIONS.md` first.

- English only (D39). All customer-facing wording is in `src/lib/copy.ts`. It is placeholder text the client must approve (Q14): **no benefits, no health claims, no invented product text** (D40).
- Never send prices or totals to the API: the server prices every order. Never trust or show data the API did not send.
- Render text as React text nodes. No `dangerouslySetInnerHTML`.
- Do not rely on browser storage (Facebook's in-app browser, US-9). The idempotency key lives in memory.
- Relative imports have no file extension here (unlike `apps/api`).
- The browser calls the API directly, so the storefront's origin must be in the API's `CORS_ORIGINS`.
