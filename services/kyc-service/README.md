# KYC Service

Runnable KYC service skeleton with in-memory workflow state.

## Run (source mode)

```bash
PORT=3003 HOST=127.0.0.1 KYC_PROVIDER=fpt \
node --experimental-strip-types src/index.ts
```

## Endpoints

- `GET /healthz`
- `POST /kyc/initiate`
- `POST /kyc/upload`
- `POST /kyc/face-match`
- `GET /kyc/status`

## Auth Simulation

Use request header `x-user-id` to identify current user.
