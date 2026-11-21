# ADR 0007 — Cookie sessions, same-origin API and tenant resolution

- Status: Accepted (M1)
- Blueprint: §10.1, §11, §13.1

## Decision

**Sessions.** Server-side sessions. A 256-bit random token is sent as an httpOnly,
`SameSite=Lax` (and `Secure` in production) cookie named `sid`; only its SHA-256 is stored in
`sessions`. Passwords use argon2id (`@node-rs/argon2`). Logout deletes the session row.

**Same origin.** The browser never calls the API host directly: Next.js rewrites `/api/v1/*` to
`API_URL`. The cookie is first-party and no CORS is needed. Server components call the API
directly and forward the incoming `Cookie` header.

**CSRF.** SameSite=Lax cookies, JSON-only bodies, and a global `OriginGuard` that rejects
state-changing requests whose `Origin` is not `APP_URL`.

**Default-deny.** A global `AuthGuard` requires a session on every route except those marked
`@Public()` (health, register, login, invitation preview).

**Tenant resolution.** Tenant-scoped routes use `@TenantScoped(minRole?)`. The tenant comes from
the `:tenantId` path param, otherwise from the `X-Tenant-Id` header. `TenantGuard` loads the
caller's membership on every request: non-members (and malformed or unknown IDs) get 404, members
below the required role get 403. Services must filter every query by the resolved tenant ID.
`apps/api/test/isolation.int.test.ts` lists every tenant-scoped route and checks cross-tenant
access; new tenant routes must be added there.

**Invitations.** Token in the URL fragment (`/invite#token=…`), so it never reaches a server log;
sent to the API in request bodies only. Hash stored, single use, 7-day expiry, email must match.
Seat checks run under a `SELECT … FOR UPDATE` lock on the tenant row.

## Consequences

- Horizontal scaling needs no sticky sessions (sessions are in Postgres).
- Login throttling is in Redis, keyed by hashed email and by client IP. The client IP comes from
  X-Forwarded-For, trusted per `TRUST_PROXY` (default `loopback`, which fits the local setup).
  Verified: the Next.js rewrite forwards the header and the API sees the client address.
  Next.js passes a client-supplied X-Forwarded-For through, so in production the edge load
  balancer must overwrite it and `TRUST_PROXY` must name the web tier; otherwise the per-IP limit
  can be bypassed (the per-email limit still applies).
- Mobile apps or third-party API clients will need a token scheme later (API access is a later
  plan feature).
