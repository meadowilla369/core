# Mint Worker Service

Runnable mint worker skeleton with paid-job queue, retry policy, and support queue fallback.

## Run (source mode)

```bash
PORT=3010 HOST=127.0.0.1 \
BASE_CHAIN_ID=31337 BASE_RPC_URL=http://127.0.0.1:8545 \
TICKET_NFT_ADDRESS=0x5fbdb2315678afecb367f032d93f642f64180aa3 \
MAX_MINT_ATTEMPTS=5 MAX_MINT_BATCH_SIZE=10 \
RETRY_BASE_DELAY_SEC=20 TOKEN_ID_SEED=100000 \
node --experimental-strip-types src/index.ts
```

## Endpoints

- `GET /healthz`
- `POST /mint/jobs`
- `GET /mint/jobs`
- `GET /mint/jobs/:jobId`
- `POST /mint/run`
- `GET /mint/support-queue`

## Notes

- `paymentId` is idempotent for queueing (`POST /mint/jobs`).
- Use `forceFailures` in request body to simulate mint failures and retry/support-queue behavior.
