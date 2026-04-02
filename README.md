# Ticket Platform Monorepo Skeleton

This repository now contains:

- Smart contracts (`contracts/`) with Foundry.
- Application skeletons (`apps/`, `services/`).
- Shared packages (`packages/`).
- Infrastructure scaffolding (`infra/`).
- Delivery checklist (`IMPLEMENTATION_CHECKLIST.md`).

## Quick Start

### 1) Bootstrap local development

```bash
npm run bootstrap
PATH="$PWD/bin:$PATH" pnpm install
```

This repo ships with a local `pnpm` shim at `./bin/pnpm` so the workspace still works on machines where `pnpm` is not installed globally.

### 2) Build / verify the workspace

```bash
npm run build
npm run typecheck
npm test
```

### 3) Run the local stack

Start infra dependencies (Postgres, Redis, MinIO) plus all runnable services and the browser UI simulator:

- `auth-service` persists OTP requests, sessions, and refresh tokens in Postgres.
- `user-service` persists user profiles, devices, and audit logs in Postgres.
- `event-service` persists events/ticket types in Postgres (source of truth for inventory).
- `ticketing-service` persists reservations/tickets/inventory in Postgres and uses Redis for idempotency caching. Inventory is synced from `event-service` on startup; use `POST /tickets/inventory/sync` to re-sync. Local operational state (locked_count) is owned by ticketing-service.
- `payment-orchestrator` persists payment intents, webhook/reconciliation state, wallet bootstrap records, and payment hashes in Postgres.
- `marketplace-service` persists listings, sales/settlements, idempotency state, and buy-hash issuance state in Postgres.
- `kyc-service` persists workflow state in Postgres and archives KYC payload snapshots to MinIO.

```bash
npm run stack:up
npm run stack:status
npm run stack:smoke
```

Stop everything:

```bash
npm run stack:down
```

Tail logs:

```bash
npm run stack:logs
./scripts/dev-stack.sh logs api-gateway
```

### 4) Run only the browser UI simulator

```bash
npm run ui:dev
# open http://127.0.0.1:4310
```

## Environment

```bash
cp .env.example .env
```

- `.env.example` contains the full local dev baseline, including `DATABASE_URL`, `REDIS_URL`, and MinIO settings.
- `docker-compose.yml` provides local Postgres, Redis, and MinIO services.
- `scripts/dev-stack.sh` boots the full host-side app stack.
- Persistence is wired for `auth-service`, `user-service`, `event-service`, `ticketing-service`, `payment-orchestrator`, `marketplace-service`, and `kyc-service`; the remaining services still run with in-memory/mock state.
- `ticketing-service` syncs its inventory from `event-service` on startup. To manually re-sync: `curl -X POST http://127.0.0.1:3005/tickets/inventory/sync`. View current inventory: `curl http://127.0.0.1:3005/tickets/inventory`.

## Quality checks

```bash
npm run lint
npm run typecheck
npm run format:write
```

## Contracts test

```bash
cd contracts
forge test --offline
```
