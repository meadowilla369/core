# Recovery Service

Runnable account recovery service skeleton with dual verification, hold timer, cancellation, and guardian rotation workflow.

## Run (source mode)

```bash
PORT=3011 HOST=127.0.0.1 \
RECOVERY_HOLD_DURATION_SEC=172800 REQUIRED_VERIFICATION_CHANNELS=2 \
ELIGIBILITY_SCAN_INTERVAL_MS=1000 \
node --experimental-strip-types src/index.ts
```

## Endpoints

- `GET /healthz`
- `POST /recovery/initiate`
- `POST /recovery/verify`
- `GET /recovery/:recoveryId/status`
- `POST /recovery/:recoveryId/cancel`
- `POST /recovery/:recoveryId/rotate-guardian`

## Auth Simulation

Use header `x-user-id` for owner-scoped operations (`initiate`, `cancel`).
