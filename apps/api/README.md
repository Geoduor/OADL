# OADL API

NestJS API for OADL: orders, assignment, stock, payments, notifications and the Google Sheet sync. See the root `README.md` and `docs/` for what the system does.

- NestJS 12, ESM, TypeScript strict, Vitest, oxlint (generated 2026-11-15).
- Database access will use Prisma + PostgreSQL (not added yet).

## Scripts

Run from the repo root with `pnpm --filter api <script>`, or from this folder with `pnpm <script>`.

| Script | What it does |
|---|---|
| `start:dev` | Start with auto-reload (http://localhost:3000, or the `PORT` environment variable) |
| `build` | Compile to `dist/` |
| `start:prod` | Run the compiled app (`node dist/main`) |
| `lint` | oxlint with type-aware rules |
| `typecheck` | `tsc --noEmit` |
| `format` | Prettier |
| `test` | Unit tests (Vitest) |
| `test:e2e` | End-to-end tests (`test/`) |

## ESM reminders

Relative imports end in `.js`; `__dirname` does not exist (use `import.meta.dirname`); mocks are `vi.fn()`.

## Rules

Read the root `AGENTS.md` and `apps/api/AGENTS.md` before changing code.
