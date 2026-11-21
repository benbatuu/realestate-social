# ADR 0004 — Credit ledger with reserve / capture / refund (draft)

- Status: Proposed — to be finalised before the credit milestone
- Blueprint: §4, §4.5, §10.2

## Direction

- `CreditLedger` and `FreeRegenerationLedger` are append-only; balances on `CreditAccount` /
  `FreeRegenerationAccount` are a cache that must reconcile with the ledger sum.
- Starting a generation reserves 1 credit **or** 1 free regeneration inside one DB transaction,
  guarded by row locks (`SELECT … FOR UPDATE`) and a unique `(tenantId, idempotencyKey)`.
- Success captures/consumes; system failure refunds/releases. User dislike never refunds.
- `VideoProject.freeRegenerationUsed` is set in the same transaction as the free-right
  reservation, with a conditional update so two parallel requests cannot both use it (§15.3 #11).
- Balances never go negative (DB check constraint).

Open points: exact lock strategy vs. serializable isolation; expiry job design.
