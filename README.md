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

- `.env.example` contains the full local dev baseline.
- `docker-compose.yml` provides local infra services.
- `scripts/dev-stack.sh` boots the full host-side app stack.

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
