# API Gateway Service

Runnable gateway skeleton for auth, user, KYC, event, ticket, marketplace, check-in, refund, recovery, dispute, payment, and webhook routes.

## Run (source mode)

```bash
PORT=3000 HOST=127.0.0.1 \
AUTH_SERVICE_BASE_URL=http://127.0.0.1:3001 \
USER_SERVICE_BASE_URL=http://127.0.0.1:3002 \
KYC_SERVICE_BASE_URL=http://127.0.0.1:3003 \
EVENT_SERVICE_BASE_URL=http://127.0.0.1:3004 \
TICKETING_SERVICE_BASE_URL=http://127.0.0.1:3005 \
PAYMENT_ORCHESTRATOR_BASE_URL=http://127.0.0.1:3006 \
MARKETPLACE_SERVICE_BASE_URL=http://127.0.0.1:3007 \
CHECKIN_SERVICE_BASE_URL=http://127.0.0.1:3008 \
REFUND_SERVICE_BASE_URL=http://127.0.0.1:3009 \
RECOVERY_SERVICE_BASE_URL=http://127.0.0.1:3011 \
DISPUTE_SERVICE_BASE_URL=http://127.0.0.1:3012 \
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
- `* /v1/payments/*` -> proxied to payment orchestrator `/payments/*`
- `* /v1/webhooks/*` -> proxied to payment orchestrator `/webhooks/*`
- `* /v1/marketplace/*` -> proxied to marketplace service `/marketplace/*`
- `* /v1/checkin/*` -> proxied to check-in service `/checkin/*`
- `* /v1/refunds/*` -> proxied to refund service `/refunds/*`
- `* /v1/recovery/*` -> proxied to recovery service `/recovery/*`
- `* /v1/disputes/*` -> proxied to dispute service `/disputes/*`

## Environment Variables

- `SERVICE_NAME` (default: `api-gateway`)
- `HOST` (default: `127.0.0.1`)
- `PORT` (default: `3000`)
- `AUTH_SERVICE_BASE_URL` (default: `http://127.0.0.1:3001`)
- `USER_SERVICE_BASE_URL` (default: `http://127.0.0.1:3002`)
- `KYC_SERVICE_BASE_URL` (default: `http://127.0.0.1:3003`)
- `EVENT_SERVICE_BASE_URL` (default: `http://127.0.0.1:3004`)
- `TICKETING_SERVICE_BASE_URL` (default: `http://127.0.0.1:3005`)
- `PAYMENT_ORCHESTRATOR_BASE_URL` (default: `http://127.0.0.1:3006`)
- `MARKETPLACE_SERVICE_BASE_URL` (default: `http://127.0.0.1:3007`)
- `CHECKIN_SERVICE_BASE_URL` (default: `http://127.0.0.1:3008`)
- `REFUND_SERVICE_BASE_URL` (default: `http://127.0.0.1:3009`)
- `RECOVERY_SERVICE_BASE_URL` (default: `http://127.0.0.1:3011`)
- `DISPUTE_SERVICE_BASE_URL` (default: `http://127.0.0.1:3012`)
- `REQUEST_TIMEOUT_MS` (default: `2000`)
