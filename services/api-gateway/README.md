# API Gateway Service

Runnable gateway skeleton for auth, user, KYC, event, and ticket routes.

## Run (source mode)

```bash
PORT=3000 HOST=127.0.0.1 \
AUTH_SERVICE_BASE_URL=http://127.0.0.1:3001 \
USER_SERVICE_BASE_URL=http://127.0.0.1:3002 \
KYC_SERVICE_BASE_URL=http://127.0.0.1:3003 \
EVENT_SERVICE_BASE_URL=http://127.0.0.1:3004 \
TICKETING_SERVICE_BASE_URL=http://127.0.0.1:3005 \
node --experimental-strip-types src/index.ts
```

## Endpoints

- `GET /healthz`
- `GET /readyz`
- `* /v1/auth/*` -> proxied to auth service `/auth/*`
- `* /v1/users/*` -> proxied to user service `/users/*`
- `* /v1/kyc/*` -> proxied to KYC service `/kyc/*`
- `* /v1/events/*` -> proxied to event service `/events/*`
- `* /v1/tickets/*` -> proxied to ticketing service `/tickets/*`

## Environment Variables

- `SERVICE_NAME` (default: `api-gateway`)
- `HOST` (default: `127.0.0.1`)
- `PORT` (default: `3000`)
- `AUTH_SERVICE_BASE_URL` (default: `http://127.0.0.1:3001`)
- `USER_SERVICE_BASE_URL` (default: `http://127.0.0.1:3002`)
- `KYC_SERVICE_BASE_URL` (default: `http://127.0.0.1:3003`)
- `EVENT_SERVICE_BASE_URL` (default: `http://127.0.0.1:3004`)
- `TICKETING_SERVICE_BASE_URL` (default: `http://127.0.0.1:3005`)
- `REQUEST_TIMEOUT_MS` (default: `2000`)
