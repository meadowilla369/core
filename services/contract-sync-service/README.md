# Contract Sync Service

Runnable consumer skeleton for contract events that synchronizes ticket ownership and status into local state.

## Run (source mode)

```bash
PORT=3014 HOST=127.0.0.1 INTERNAL_API_KEY=internal-dev-key \
node --experimental-strip-types src/index.ts
```

## Endpoints

- `GET /healthz`
- `POST /contract-events` (requires `x-internal-api-key`)
- `GET /tokens/:tokenId`
- `GET /sync/status`
