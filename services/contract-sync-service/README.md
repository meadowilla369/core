# Contract Sync Service

Runnable consumer skeleton for contract events that synchronizes ticket ownership and status into local state.

## Run (source mode)

```bash
PORT=3014 HOST=127.0.0.1 BASE_CHAIN_ID=31337 INTERNAL_API_KEY=internal-dev-key \
TRACKED_CONTRACT_ADDRESSES=0x5fbdb2315678afecb367f032d93f642f64180aa3,0xe7f1725e7734ce288f8367e1bb143e90bb3f0512,0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0,0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9 \
node --experimental-strip-types src/index.ts
```

## Endpoints

- `GET /healthz`
- `POST /contract-events` (requires `x-internal-api-key`)
- `GET /tokens/:tokenId`
- `GET /sync/status`

## Event Requirements

- `contractAddress` is required and must belong to `TRACKED_CONTRACT_ADDRESSES`.
- If `chainId` is provided in each event, it must match `BASE_CHAIN_ID`.
