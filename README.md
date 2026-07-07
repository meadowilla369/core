# Ticket Platform Monorepo Skeleton

This repository now contains:

- Smart contracts (`contracts/`) with Foundry.
- Application skeletons (`apps/`, `services/`).
- Shared packages (`packages/`).
- Infrastructure scaffolding (`infra/`).
- Delivery checklist (`IMPLEMENTATION_CHECKLIST.md`).

## End-to-End Runbook

Use this section when you want to boot the whole local system quickly: contracts on local chain, backend services, infra, and frontend.

### Prerequisites

Required tools:

- Node.js + npm
- Docker Desktop or a working Docker daemon
- Foundry tools: `anvil`, `forge`, `cast`

Quick checks:

```bash
node --version
npm --version
docker info
anvil --version
forge --version
cast --version
```

### One-Time Setup

Run these once after cloning or after dependency changes:

```bash
npm run bootstrap
PATH="$PWD/bin:$PATH" pnpm install
cp .env.example .env
npm run build
```

Notes:

- `npm run bootstrap` makes local helper scripts executable and creates `.env` from `.env.example` if missing.
- `PATH="$PWD/bin:$PATH" pnpm install` uses the repo-local `pnpm` shim in `./bin/pnpm`.
- `.env` is the default env for the normal local stack.
- `.env.localchain` is generated automatically when you start the local chain flow.

### Fastest Way To Run Everything

If you want the full local system with local contracts, local backend, and frontend wired together, use this flow:

#### Terminal 1: start local chain + backend + infra

```bash
npm run stack:localchain:up
```

What this does:

1. Starts Anvil at `http://127.0.0.1:8545`
2. Deploys local contracts
3. Generates `.env.localchain`
4. Starts Docker infra: Postgres, Redis, MinIO
5. Builds the workspace
6. Starts backend services and the API gateway using `.env.localchain`
7. Runs smoke checks, including an on-chain transaction and a frontend preview probe

#### Terminal 2: start the real web frontend against local chain backend

```bash
npm run web:localchain:dev
```

Open:

- Frontend: `http://127.0.0.1:8080`
- API gateway health: `http://127.0.0.1:3000/healthz`
- UI simulator: `http://127.0.0.1:4310`
- Anvil RPC: `http://127.0.0.1:8545`

### Split Flow For Debugging

Use this when you want to bring pieces up separately.

#### A. Start or redeploy only the local chain and contracts

```bash
npm run chain:up
```

This:

- starts Anvil if needed
- deploys `TicketLedger`, `MarketplaceV2`, `TicketPaymaster`, and `Handler`
- writes fresh addresses into `.env.localchain`

Useful checks:

```bash
npm run chain:status
npm run chain:deploy
```

#### B. Start backend + infra against `.env.localchain`

```bash
STACK_ENV_FILE=.env.localchain ./scripts/dev-stack.sh up
```

Useful checks:

```bash
STACK_ENV_FILE=.env.localchain ./scripts/dev-stack.sh status
STACK_ENV_FILE=.env.localchain ./scripts/dev-stack.sh logs
STACK_ENV_FILE=.env.localchain ./scripts/dev-stack.sh logs api-gateway
```

#### C. Run the local-chain smoke suite only

```bash
npm run stack:localchain:smoke
```

This validates:

- Anvil chain id
- deployed contract bytecode
- API gateway `healthz` and `readyz`
- `contract-sync-service` health and sync status
- a real on-chain purchase flow
- frontend production preview reachability

#### D. Start only the frontend against local chain backend

```bash
npm run web:localchain:dev
```

This uses values from `.env.localchain`, including:

- `VITE_API_BASE_URL=http://127.0.0.1:3000`
- `VITE_RPC_URL=http://127.0.0.1:8545`
- deployed `VITE_HANDLER_ADDRESS`

### Deploy Contracts To Base Sepolia

Use this when you want the platform contracts deployed on Base Sepolia instead of the local Anvil chain.

Minimum wallets:

- `PRIVATE_KEY` and `DEPLOY_ADMIN` can be the same wallet for a simple demo.

Recommended wallets for smoother end-to-end testing:

- `deploy/admin` wallet
- `backend operator` wallet
- `seller/user` wallet

Setup:

1. Copy `contracts/deploy-config/base-sepolia.env.example` to `contracts/deploy-config/base-sepolia.env`
2. Fill in `PRIVATE_KEY`, `DEPLOY_ADMIN`, and optional paymaster settings
3. Fund the deploy wallet with Base Sepolia ETH
4. If you want the app/backend to target Base Sepolia, deploy once and let the helper generate `config/environments/base-sepolia.env`
5. If you prefer to prepare it manually, copy `config/environments/base-sepolia.env.example` first and then overwrite the generated contract addresses

Deploy:

```bash
npm run contracts:deploy:base-sepolia
```

Then start the app/backend stack against Base Sepolia:

```bash
npm run stack:base-sepolia:up
```

To build or run the Capacitor iPhone app against the same Base Sepolia backend:

```bash
npm run stack:base-sepolia:ios:build
npm run stack:base-sepolia:ios:sync
npm run stack:base-sepolia:ios:live
```

Output:

- Deployed addresses are written to `contracts/deployments/base-sepolia-addresses.json`
- Canonical registry is updated at `contracts/deployments/address-registry.json`
- A runnable runtime env is generated at `config/environments/base-sepolia.env`
- The deployed chain id is expected to be Base Sepolia `84532`

### Normal Local Stack Without Local Chain

Use this when you only want the backend stack and browser simulator, without live local RPC sync.

```bash
npm run stack:up
npm run stack:status
npm run stack:smoke
```

This flow uses `.env`, not `.env.localchain`.

### Watch Mode For Day-to-Day Development

```bash
npm run dev
```

This starts Docker infra first, then runs the Turbo watch processes across the workspace.

### Useful URLs And Ports

| Component                        | URL / Port              |
| -------------------------------- | ----------------------- |
| Frontend dev server (`apps/web`) | `http://127.0.0.1:8080` |
| API gateway                      | `http://127.0.0.1:3000` |
| Auth service                     | `http://127.0.0.1:3001` |
| User service                     | `http://127.0.0.1:3002` |
| KYC service                      | `http://127.0.0.1:3003` |
| Event service                    | `http://127.0.0.1:3004` |
| Ticketing service                | `http://127.0.0.1:3005` |
| Payment orchestrator             | `http://127.0.0.1:3006` |
| Marketplace service              | `http://127.0.0.1:3007` |
| Check-in service                 | `http://127.0.0.1:3008` |
| Refund service                   | `http://127.0.0.1:3009` |
| Worker mint                      | `http://127.0.0.1:3010` |
| Recovery service                 | `http://127.0.0.1:3011` |
| Dispute service                  | `http://127.0.0.1:3012` |
| Notification service             | `http://127.0.0.1:3013` |
| Contract sync service            | `http://127.0.0.1:3014` |
| UI simulator                     | `http://127.0.0.1:4310` |
| Anvil RPC                        | `http://127.0.0.1:8545` |
| Postgres                         | `127.0.0.1:5432`        |
| Redis                            | `127.0.0.1:6379`        |
| MinIO API                        | `http://127.0.0.1:9000` |
| MinIO Console                    | `http://127.0.0.1:9001` |

### Shutdown

Stop the local chain stack:

```bash
npm run stack:localchain:down
```

Stop the normal local stack:

```bash
npm run stack:down
```

If `npm run web:localchain:dev` is running in its own terminal, stop it with `Ctrl+C`.

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

### 5b) Use the Codex UI/UX skill for `apps/web`

After installing the local Codex skill `ui-ux-pro-max` and restarting Codex, use it for
frontend work in `apps/web` (React + Vite + Tailwind + shadcn/ui).

Typical prompts:

```text
Use ui-ux-pro-max to redesign the attendee dashboard in apps/web.
Use ui-ux-pro-max to review the mobile check-in flow in apps/web for accessibility and touch targets.
Use ui-ux-pro-max to propose a design system for the Ticket Platform marketplace screens.
```

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
