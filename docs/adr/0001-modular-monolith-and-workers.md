# ADR 0001 — Modular monolith + separate worker processes

- Status: Accepted (M0)
- Blueprint: §0 rule 4, §8, §8.3

## Context

The MVP needs an HTTP API, long-running AI/provider calls, and CPU-heavy rendering. Microservices,
an event bus or Kubernetes would add operational load before there is a product (rule 4).

## Decision

One NestJS codebase (`apps/api`) with two entrypoints:

- `src/main.ts` — HTTP API.
- `src/worker.ts` — BullMQ worker process.

A separate render-worker entrypoint (Remotion/FFmpeg) will be added in the render milestone, from
the same codebase, so it can be scaled with a different resource profile.

PostgreSQL is the source of truth for job/generation state; BullMQ/Redis only schedules work
(§8.3, §8.5).

## Consequences

- Domain modules share types and the Prisma client without network hops.
- Module boundaries must be kept by convention (no cross-module imports of internals).
