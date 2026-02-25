# API Gateway Service

Runnable gateway skeleton for auth and user routes.

## Run (source mode)

```bash
PORT=3000 HOST=127.0.0.1 \
AUTH_SERVICE_BASE_URL=http://127.0.0.1:3001 \
USER_SERVICE_BASE_URL=http://127.0.0.1:3002 \
node --experimental-strip-types src/index.ts
```

## Endpoints

- `GET /healthz`
- `GET /readyz`
- `* /v1/auth/*` -> proxied to auth service `/auth/*`
- `* /v1/users/*` -> proxied to user service `/users/*`

## Environment Variables

- `SERVICE_NAME` (default: `api-gateway`)
- `HOST` (default: `127.0.0.1`)
- `PORT` (default: `3000`)
- `AUTH_SERVICE_BASE_URL` (default: `http://127.0.0.1:3001`)
- `USER_SERVICE_BASE_URL` (default: `http://127.0.0.1:3002`)
- `REQUEST_TIMEOUT_MS` (default: `2000`)
