# ADR 0003 — Zod as the single validation layer

- Status: Accepted (M0)
- Blueprint: §8.2 ("choose one approach")

## Decision

All runtime validation uses Zod 4: environment (`apps/api/src/config/env.ts`), API request/response
contracts and, later, LLM structured output and project manifests. Schemas that cross the
web/api boundary live in `packages/shared`. `class-validator` is not used.

Request-body validation will be a Nest pipe that takes a Zod schema, added with the first
endpoint that accepts input (M1).

## Consequences

- One schema produces both the runtime check and the TypeScript type.
- OpenAPI docs for Zod-validated bodies need a bridge (to be chosen in M1).
