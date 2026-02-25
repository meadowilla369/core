# Environment Strategy

## Environments

- `dev`: local development and integration with sandboxes.
- `staging`: pre-production validation with production-like topology.
- `prod`: production workloads.

## Rules

- No hard-coded secrets in repo.
- Each service reads environment variables through typed config module.
- Breaking env var changes require migration notes in PR.

## Required Baseline Variables

- Runtime: `NODE_ENV`, `API_BASE_URL`
- Service routing: `AUTH_SERVICE_BASE_URL`, `USER_SERVICE_BASE_URL`, `KYC_SERVICE_BASE_URL`, `EVENT_SERVICE_BASE_URL`, `TICKETING_SERVICE_BASE_URL`, `PAYMENT_ORCHESTRATOR_BASE_URL`, `MARKETPLACE_SERVICE_BASE_URL`
- Data: `DATABASE_URL`, `REDIS_URL`
- Blockchain: `BASE_RPC_URL`
- Integrations: payment and KYC provider settings

## Promotion

- `dev` -> `staging` requires integration tests pass.
- `staging` -> `prod` requires release checklist sign-off.
