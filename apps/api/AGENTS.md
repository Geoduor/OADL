# AGENTS.md (apps/api)

The root `AGENTS.md` and `docs/` apply here and win on any conflict. Project-specific notes for this app:

- **Database:** Prisma 7.10.1 (pinned, D17) + PostgreSQL, not the TypeORM, Drizzle, Mongoose or Sequelize packages listed below. Import the generated client with a `.js` ending (`../generated/prisma/client.js`). Inject `PrismaService` through `PrismaModule`; do not create other `PrismaClient` instances.
- **Prisma CLI hints:** always pass `--no-hints` to `prisma generate` (the scripts do). Without it the CLI offers to install AI agent skills and can create `.agents/`, `.claude/`, `.windsurf/` and `skills-lock.json` here. These are not part of OADL; delete them and do not commit them.
- **Database tests** (`test/*.e2e-spec.ts`) write to the database in `DATABASE_URL` and refuse to run unless it is on localhost. Keep that guard (`test/support/local-database.ts`).
- **Writing database tests:** each test creates its own rows with a unique slug or name, asserts only on its own rows (test files run in parallel against one database), and deletes them in `afterAll`. Any test that imports `AppModule` now needs the local database running.
- **Seeding:** `pnpm exec prisma db seed` runs `prisma/seed.ts` through `tsx` (dev dependency, exact version pinned; approved by the developer 2026-11-19). `esbuild`, a dependency of `tsx`, is allowed to run its install script in `pnpm-workspace.yaml`. The seed uses `upsert` with an empty update, so it never overwrites edits. The config file is `prisma.config.ts`.
- **Not used on purpose:** NestJS Observe and Mau were skipped at scaffold time. Do not add them, and do not add any other third-party service, without approval (root `AGENTS.md` section 9).
- **Validation library:** undecided, see Q21 in `docs/OPEN_QUESTIONS.md`. Do not write DTOs until it is decided.
- Check Nest's first-party packages (list below) before adding another library, but still read the current docs and ask first for anything new.

## NestJS

This app's version of NestJS is likely newer than what you know. https://docs.nestjs.com/llms.txt indexes its documentation, with a markdown page per chapter.

Nest has first-party packages for these, so check them before adding another library or writing your own:

- Databases: [`@nestjs/typeorm`](https://docs.nestjs.com/data/typeorm.md), [`@nestjs/drizzle`](https://docs.nestjs.com/data/drizzle.md), [`@nestjs/mongoose`](https://docs.nestjs.com/data/mongodb.md), [`@nestjs/sequelize`](https://docs.nestjs.com/data/sequelize.md).
- OpenAPI: [`@nestjs/swagger`](https://docs.nestjs.com/openapi/introduction.md). GraphQL: [`@nestjs/graphql`](https://docs.nestjs.com/graphql/quick-start.md). WebSockets: [`@nestjs/websockets`](https://docs.nestjs.com/websockets/gateways.md). Microservices: [`@nestjs/microservices`](https://docs.nestjs.com/microservices/basics.md).
- Sign-in: [`@nestjs/authentication`](https://docs.nestjs.com/security/authentication.md). Permissions: [`@nestjs/authorization`](https://docs.nestjs.com/security/authorization.md). Rate limiting: [`@nestjs/throttler`](https://docs.nestjs.com/security/rate-limiting.md).
- Configuration: [`@nestjs/config`](https://docs.nestjs.com/application/configuration.md). Caching: [`@nestjs/cache-manager`](https://docs.nestjs.com/data/caching.md). Health checks: [`@nestjs/terminus`](https://docs.nestjs.com/reliability/terminus.md). Events inside the app: [`@nestjs/event-emitter`](https://docs.nestjs.com/application/events.md).
- Email: [`@nestjs/mail`](https://docs.nestjs.com/application/mail.md). Files, S3 included: [`@nestjs/storage`](https://docs.nestjs.com/application/file-storage.md). Translations: [`@nestjs/i18n`](https://docs.nestjs.com/application/i18n.md).
- Retries, timeouts and circuit breakers: [`@nestjs/resilience`](https://docs.nestjs.com/reliability/resilience.md).
- Idempotency keys: [`@nestjs/idempotency`](https://docs.nestjs.com/reliability/idempotency.md). Transactional outbox: [`@nestjs/outbox`](https://docs.nestjs.com/reliability/outbox.md). Sending and receiving webhooks: [`@nestjs/webhooks`](https://docs.nestjs.com/http/webhooks.md).
- Queues: [`@nestjs/bullmq`](https://docs.nestjs.com/application/queues.md). Scheduled jobs: [`@nestjs/schedule`](https://docs.nestjs.com/application/task-scheduling.md).
- Running a scheduled job on one instance, and locks: [`@nestjs/locks`](https://docs.nestjs.com/reliability/locks.md). Processes that take days: [`@nestjs/workflows`](https://docs.nestjs.com/reliability/workflows.md).
- Language models, tools and agents: [`@nestjs/ai`](https://docs.nestjs.com/ai/overview.md). MCP servers: [`@nestjs/mcp`](https://docs.nestjs.com/mcp/overview.md).

Validation works with Zod, Valibot, ArkType or any other Standard Schema library, with no classes or decorator metadata: `StandardSchemaValidationPipe` with `@Body({ schema })` or `@Param('id', { schema })` (https://docs.nestjs.com/application/validation.md). `class-validator` still works, through `ValidationPipe`.

`NodeAdapter` from `@nestjs/platform-node` is the fastest HTTP adapter, ahead of Fastify (https://docs.nestjs.com/http/performance.md).

Nest's packages are ESM only, and this project is ESM too: relative imports end in `.js`, `__dirname` doesn't exist (use `import.meta.dirname`), and tests run on Vitest, so mocks are `vi.fn()`, not `jest.fn()`.
