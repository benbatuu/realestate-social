# AI content & real-estate marketing platform

Working name only; the brand is undecided. Product, business rules and architecture are defined in
[`product-architecture-blueprint.md`](product-architecture-blueprint.md). Milestone plans live in
[`docs/`](docs/) and decisions in [`docs/adr/`](docs/adr/).

**Current state: Milestone 0 — skeleton.** No business features yet: the API exposes a health
check, the worker processes a no-op job, and the web app shows system status.

## Stack

| Part           | Tech                                                                       |
| -------------- | -------------------------------------------------------------------------- |
| Web            | Next.js 16 (App Router), React 19, Tailwind CSS 4                          |
| API + worker   | NestJS 12, Prisma 7 (Postgres driver adapter), BullMQ 6, pino              |
| Shared         | Zod 4 schemas and types (`packages/shared`)                                |
| Local services | Postgres 16, Redis 7, SeaweedFS S3 gateway (Docker Compose)                |
| Tooling        | Node 24 LTS, pnpm 10, TypeScript 6 (strict), ESLint 10, Prettier, Vitest 5 |

```text
apps/web         Next.js UI
apps/api         NestJS API (src/main.ts) + worker (src/worker.ts)
packages/shared  Zod schemas + types shared by web and api
infra/           Local service config
docs/            Plans and ADRs
```

## Getting started

Requirements: Node 24 (`nvm use`), pnpm 10, Docker.

```bash
nvm use
```

```bash
pnpm install
```

```bash
cp .env.example .env
```

```bash
pnpm services:up
```

```bash
pnpm db:migrate
```

```bash
pnpm dev
```

- Web: http://localhost:3100
- API health: http://localhost:4100/api/v1/health
- API docs (OpenAPI): http://localhost:4100/api/v1/docs

Ports differ from the blueprint's 3000/4000 because those were in use on the dev machine; change
`WEB_PORT`, `API_PORT`, `APP_URL` and `API_URL` in `.env` if needed. Docker host ports
(Postgres 55432, Redis 56379, storage 58333) can be overridden with `POSTGRES_HOST_PORT`,
`REDIS_HOST_PORT` and `STORAGE_HOST_PORT`.

## Commands

| Command                              | What it does                                                      |
| ------------------------------------ | ----------------------------------------------------------------- |
| `pnpm dev`                           | Builds `shared`, then runs web, API and worker with watch mode    |
| `pnpm build`                         | Production build of all packages                                  |
| `pnpm lint`                          | ESLint, zero warnings allowed                                     |
| `pnpm format` / `pnpm format:check`  | Prettier                                                          |
| `pnpm typecheck`                     | `tsc --noEmit` in every package                                   |
| `pnpm test`                          | All tests, including integration tests (needs `pnpm services:up`) |
| `pnpm test:unit`                     | Unit tests only, no services needed                               |
| `pnpm services:up` / `services:down` | Start/stop Postgres, Redis, storage; creates the bucket           |
| `pnpm db:migrate`                    | `prisma migrate dev`                                              |
| `pnpm db:deploy`                     | `prisma migrate deploy` (CI/production)                           |
| `pnpm db:generate`                   | Regenerate the Prisma client (also runs on install)               |

## Conventions

- **Environment:** one `.env` at the repo root, validated at startup by
  `apps/api/src/config/env.ts`. The process exits on missing or invalid values; errors name the
  variable, never its value. `.env` is git-ignored; `.env.example` holds placeholders only.
- **Logging:** structured pino logs. Every request gets an `x-request-id` (caller-supplied if safe,
  otherwise generated) echoed in the response. Secrets and personal data keys are redacted
  (`apps/api/src/common/logging/redaction.ts`), and query strings are not logged.
- **API:** all routes under `/api/v1`. Validation with Zod only (ADR 0003).
- **Providers:** every external AI/CRM/payment service goes behind an adapter, with a mock
  implementation that is always labelled as mock (ADR 0005). None exist yet.
- **Database:** Prisma migrations in `apps/api/prisma/migrations`. Rollback approach: write a
  forward migration that reverses the change; never edit an applied migration.

## Mock vs. real integrations

| Integration                     | Status              |
| ------------------------------- | ------------------- |
| Postgres, Redis, object storage | Real (local Docker) |
| AI video, LLM, TTS, music       | Not started         |
| CRM (LeadPilot), CSV import     | Not started         |
| Payments                        | Not started         |

## Known gaps after M0

- No domain models or migrations yet (`schema.prisma` only has the generator and datasource), so
  `pnpm db:migrate` currently reports nothing to apply.
- shadcn/ui is not initialised yet; it will be added with the first real screens in M1.
- No CI pipeline yet (no remote repository). The commands above are what CI should run.
- The web app has no tests yet; UI and E2E (Playwright) tests start in M1.
- Local storage uses SeaweedFS instead of MinIO (ADR 0006); the production storage vendor is open.
