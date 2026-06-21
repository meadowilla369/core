# Database Assets

## Local Canonical Schema

- `schema.sql` is the local development source of truth for PostgreSQL schema.
- Reset only PostgreSQL with `pnpm db:reset` or `./scripts/reset-db.sh`.
- The reset script drops and recreates the `public` schema, then applies `schema.sql`.
- Redis and MinIO are not touched by the reset script.
- Keep `ticket_types` aligned with the product schema here first: `id`, `event_id`, `onchain_ticket_type_id`, `name`, `unit_price`, `quantity`, `perks`.
- Verify the schema contract with `pnpm db:test:schema`.

## Migrations

- The migration files are retained as historical/release assets.
- For current local development, prefer editing `schema.sql` and resetting PostgreSQL.
- `migrations/0001_extensions.sql`: PostgreSQL extensions required by the platform.
- `migrations/0002_user_identity.sql`: User, device, KYC, and recovery tables.
- `migrations/0003_event_ticketing.sql`: Organizer, event, ticket, and reservation tables.
- `migrations/0004_marketplace_escrow.sql`: Listings, purchases, and escrow transfer ledger.
- `migrations/0005_payments_refunds_webhooks.sql`: Payments, webhook evidence, and refunds.
- `migrations/0006_checkin_disputes_support.sql`: Check-in, dispute, and support tables.
- `migrations/0007_hot_path_indexes.sql`: Throughput indexes and partial indexes.
- `migrations/0008_payment_hashes_wallet_prefunds.sql`: Wallet prefund ledger and backend-issued payment hash evidence.
- `migrations/0009_onchain_sync_inventory.sql`: On-chain event/ticket-type mappings, ticket inventory counters, raw chain event log persistence, and token ownership projection.

## Seed Strategy

- `seeds/dev_seed.sql` provides deterministic fixtures for local/dev only.
- Avoid loading seed data in staging/prod.
- Keep IDs stable so integration tests can reference deterministic entities.
