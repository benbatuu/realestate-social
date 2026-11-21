# ADR 0005 — Provider adapter boundary

- Status: Accepted (M0, implemented from the video pipeline milestone)
- Blueprint: §0 rules 5, 10, 12; §8.8

## Decision

Every external AI/CRM/payment service sits behind an interface in `apps/api/src/ai-providers/*`
or `integrations/*`. Domain services depend on the interface only. Each adapter owns timeouts,
retries with backoff + jitter, idempotency (check existing external job ID before re-submitting),
error mapping to the §12.4 failure codes, and usage/cost metering into `ProviderUsage`.

Model IDs, endpoints, prices and limits come from configuration, never constants in code.

Every adapter ships with a **mock** implementation. Mock and real adapters are selected by
configuration and are always labelled as such in docs, tests and admin views (rule 12).
