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

### 3) Run in watch mode

```bash
npm run dev
```

`npm run dev` now brings up the required Docker infra first (Postgres, Redis, MinIO) and then starts the Turbo watch processes.

If you only want the containers without the watch processes:

```bash
npm run stack:infra:up
npm run stack:infra:status
```

Stop only the containers:

```bash
npm run stack:infra:down
```

### 4) Run the full local stack

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

### 4b) Run local chain + backend stack

Start Anvil, deploy local `TicketLedger` / `MarketplaceV2` / `TicketPaymaster` / `Handler`,
write `.env.localchain`, then boot Docker infra plus the backend/services stack against that env:

```bash
npm run stack:localchain:up
```

`stack:localchain:up` now runs a smoke pass automatically after boot:

- checks local RPC chain id and deployed contract bytecode
- checks backend `healthz` / `readyz`
- submits a real `TicketLedger.purchaseWithSignature` transaction on Anvil
- verifies `contract-sync-service` ingests that event through the RPC listener
- builds and serves a temporary `apps/web` preview, then curls it

Useful helpers:

```bash
npm run chain:status
npm run chain:deploy
npm run stack:localchain:smoke
npm run stack:localchain:down
```

`contract-sync-service` will enable its RPC listener in this mode because `.env.localchain`
includes `RPC_URL`, `TICKET_LEDGER_ADDRESS`, and `MARKETPLACE_ADDRESS`.

### 5) Run frontend against local chain backend

```bash
npm run web:localchain:dev
# open http://127.0.0.1:8080
```

This starts `apps/web` with `VITE_API_BASE_URL=http://127.0.0.1:3000` and the deployed
`HANDLER_ADDRESS` from `.env.localchain`.

### 6) Run only the browser UI simulator

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
