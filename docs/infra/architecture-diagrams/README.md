# Ticket Platform Architecture Diagrams

Snapshot date: 2026-04-08

This folder contains four PlantUML diagrams derived from the current monorepo source:

1. `entity-controller-boundary.puml`
2. `entity-relationship.puml`
3. `sequence-resale-buy-onchain.puml`
4. `activity-primary-purchase.puml`

Primary source files reviewed for these diagrams:

- `services/api-gateway/src/server.ts`
- `services/auth-service/src/server.ts`
- `services/user-service/src/server.ts`
- `services/kyc-service/src/server.ts`
- `services/event-service/src/server.ts`
- `services/ticketing-service/src/server.ts`
- `services/payment-orchestrator/src/server.ts`
- `services/marketplace-service/src/server.ts`
- `services/checkin-service/src/server.ts`
- `services/refund-service/src/server.ts`
- `services/recovery-service/src/server.ts`
- `services/dispute-service/src/server.ts`
- `services/notification-service/src/server.ts`
- `services/contract-sync-service/src/server.ts`
- `contracts/src/TicketLedger.sol`
- `contracts/src/TicketNFT.sol`
- `contracts/src/MarketplaceV2.sol`
- `contracts/src/GuardianAccount.sol`
- `contracts/src/Handler.sol`
- `packages/sdk-client/src/tx-builder/marketplace-buy.ts`
- `packages/sdk-client/src/tx-builder/encoder.ts`
- `infra/db/migrations/0002_user_identity.sql`
- `infra/db/migrations/0003_event_ticketing.sql`
- `infra/db/migrations/0004_marketplace_escrow.sql`
- `infra/db/migrations/0005_payments_refunds_webhooks.sql`
- `infra/db/migrations/0006_checkin_disputes_support.sql`
- `infra/db/migrations/0008_payment_hashes_wallet_prefunds.sql`

Interpretation notes:

- The ECB diagram is implementation-oriented. It uses current runtime services, external boundaries, and durable state.
- The ERD is domain-oriented. It follows the canonical migration model and folds some implementation-only helper tables out of the diagram for readability.
- The sequence diagram focuses on the resale on-chain authorization flow because that is the most repo-specific interaction across frontend, backend, SDK, wallet, and contracts.
- The activity diagram focuses on the primary purchase flow because it is the clearest off-chain orchestration path across `ticketing-service` and `payment-orchestrator`.

Implementation differences worth noting:

- Several services create their own local tables in `ensureSchema()` with names that differ from the canonical migration tables.
- `ticketing-service` owns operational inventory state in `ticket_inventory` and uses Redis for idempotency caching.
- `payment-orchestrator` and `marketplace-service` persist additional runtime tables such as idempotency caches, retry jobs, and signed hash ledgers.
- `contract-sync-service` currently stores synchronized token state in memory and can ingest events either by HTTP or by `viem` RPC subscriptions.
