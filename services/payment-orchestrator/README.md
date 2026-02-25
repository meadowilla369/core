# Payment Orchestrator Service

Runnable payment orchestration skeleton with webhook signature verification, idempotency, and retry reconciliation flow.

## Run (source mode)

```bash
PORT=3006 HOST=127.0.0.1 \
ALLOWED_PAYMENT_GATEWAYS=momo,vnpay \
MOMO_WEBHOOK_SECRET=momo_dev_secret \
VNPAY_WEBHOOK_SECRET=vnpay_dev_secret \
node --experimental-strip-types src/index.ts
```

## Endpoints

- `GET /healthz`
- `POST /payments/intents`
- `GET /payments/:paymentId`
- `GET /payments/reconciliation/jobs`
- `POST /payments/reconciliation/run`
- `POST /webhooks/momo`
- `POST /webhooks/vnpay`

## Auth and Webhook Headers

- Use `x-user-id` for `/payments/*` mutation simulation.
- Use webhook headers `x-webhook-signature`, `x-webhook-timestamp`, and `x-webhook-nonce`.
- Signature format: `hex(HMAC_SHA256(secret, "${timestamp}.${nonce}.${rawBody}"))`.
