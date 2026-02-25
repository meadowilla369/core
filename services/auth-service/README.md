# Auth Service

Runnable auth service skeleton with in-memory OTP and refresh token flow.

## Run (source mode)

```bash
PORT=3001 HOST=127.0.0.1 AUTH_EXPOSE_OTP_IN_RESPONSE=true \
node --experimental-strip-types src/index.ts
```

## Endpoints

- `GET /healthz`
- `POST /auth/otp/request`
- `POST /auth/otp/verify`
- `POST /auth/refresh`

## Environment Variables

- `SERVICE_NAME` (default: `auth-service`)
- `HOST` (default: `127.0.0.1`)
- `PORT` (default: `3001`)
- `OTP_LENGTH` (default: `6`)
- `OTP_TTL_SEC` (default: `300`)
- `OTP_MAX_REQUESTS_PER_WINDOW` (default: `5`)
- `OTP_RATE_WINDOW_SEC` (default: `900`)
- `ACCESS_TOKEN_TTL_SEC` (default: `900`)
- `REFRESH_TOKEN_TTL_SEC` (default: `2592000`)
- `AUTH_EXPOSE_OTP_IN_RESPONSE` (default: `true` for dev only)

## Notes

- Current implementation uses in-memory stores for OTP and refresh tokens.
- Not production-ready for persistence, device/session management, or secure OTP delivery.
