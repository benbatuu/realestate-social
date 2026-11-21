# ADR 0002 — pnpm workspace with three packages

- Status: Accepted (M0)
- Blueprint: §18.2

## Decision

```text
apps/web         Next.js App Router UI
apps/api         NestJS API + worker (ADR 0001)
packages/shared  Zod schemas and TS types shared by web and api
```

No further package split until a concrete need appears (e.g. Remotion compositions may move to
their own package if the render worker needs a separate bundle).

`packages/shared` compiles to CommonJS in `dist/`; root scripts build it before `dev`, `typecheck`
and `test`.

Package names use a neutral `@app/*` scope because the brand is undecided. The UI display name
lives in one constant: `PRODUCT_DISPLAY_NAME` in `packages/shared/src/index.ts`.

## Runtime

Node **24 LTS** (`.nvmrc`, `engines`, `engine-strict`). Node 23 (found on the dev machine) is not
LTS and is rejected by Prisma 7. TypeScript is pinned to **6.0.x** because `typescript-eslint`
does not yet support TypeScript 7.
