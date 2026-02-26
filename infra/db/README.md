# Database Assets

## Migrations

- `migrations/0001_extensions.sql`: PostgreSQL extensions required by the platform.
- `migrations/0002_user_identity.sql`: User, device, KYC, and recovery tables.
- `migrations/0003_event_ticketing.sql`: Organizer, event, ticket, and reservation tables.
- `migrations/0004_marketplace_escrow.sql`: Listings, purchases, and escrow transfer ledger.
- `migrations/0005_payments_refunds_webhooks.sql`: Payments, webhook evidence, and refunds.
- `migrations/0006_checkin_disputes_support.sql`: Check-in, dispute, and support tables.
- `migrations/0007_hot_path_indexes.sql`: Throughput indexes and partial indexes.

## Seed Strategy

- `seeds/dev_seed.sql` provides deterministic fixtures for local/dev only.
- Avoid loading seed data in staging/prod.
- Keep IDs stable so integration tests can reference deterministic entities.
