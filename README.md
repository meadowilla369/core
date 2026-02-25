# Ticket Platform Monorepo Skeleton

This repository now contains:
- Smart contracts (`contracts/`) with Foundry.
- Application skeletons (`apps/`, `services/`).
- Shared packages (`packages/`).
- Infrastructure scaffolding (`infra/`).
- Delivery checklist (`IMPLEMENTATION_CHECKLIST.md`).

## Quick Start

```bash
pnpm install
pnpm build
pnpm dev
```

Quality checks:

```bash
pnpm lint
pnpm typecheck
pnpm format:write
```

Contracts test:

```bash
cd contracts
forge test --offline
```
