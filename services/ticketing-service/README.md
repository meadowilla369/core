# Ticketing Service

Runnable ticketing service skeleton with in-memory reservation and ticket issuance.

## Run (source mode)

```bash
PORT=3005 HOST=127.0.0.1 RESERVATION_TTL_SEC=900 \
node --experimental-strip-types src/index.ts
```

## Endpoints

- `GET /healthz`
- `POST /tickets/reserve`
- `POST /tickets/purchase`
- `GET /tickets/me`
- `GET /tickets/:tokenId`
- `POST /tickets/:tokenId/qr`

## Headers

- `x-user-id`: required for ticket endpoints.
- `idempotency-key`: optional for mutation endpoints.
