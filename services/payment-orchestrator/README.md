# Payment Orchestrator Service

Runnable payment orchestration skeleton with webhook signature verification, wallet bootstrap prefund tracking, idempotent payment-hash issuance, and EIP-712 purchase signature generation.

## Run (source mode)

```bash
PORT=3006 HOST=127.0.0.1 \
ALLOWED_PAYMENT_GATEWAYS=momo,vnpay \
MOMO_WEBHOOK_SECRET=momo_dev_secret \
VNPAY_WEBHOOK_SECRET=vnpay_dev_secret \
BACKEND_SIGNER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
TICKET_LEDGER_CHAIN_ID=84532 \
TICKET_LEDGER_ADDRESS=0x1000000000000000000000000000000000000001 \
PAYMENT_HASH_TTL_SEC=86400 \
WALLET_PREFUND_AMOUNT_WEI=1000000000000000 \
node --experimental-strip-types src/index.ts
```

`cast` from Foundry must be available on `PATH` because the service uses it for `keccak256`, typed-data signing, and signer derivation.

## Endpoints

- `GET /healthz`
- `POST /wallet/register`
- `GET /wallet/prefund/:walletAddress`
- `POST /payments/intents`
- `POST /api/payment/initiate`
- `GET /payments/:paymentId`
- `GET /payments/hash/:orderId`
- `GET /api/payment/hash/:orderId`
- `GET /payments/reconciliation/jobs`
- `POST /payments/reconciliation/run`
- `POST /webhooks/momo`
- `POST /webhooks/vnpay`
- `POST /webhook/payment?gateway=momo|vnpay`

## Auth and Webhook Headers

- Use `x-user-id` for wallet registration and payment creation.
- Use webhook headers `x-webhook-signature`, `x-webhook-timestamp`, and `x-webhook-nonce`.
- Signature format: `hex(HMAC_SHA256(secret, "${timestamp}.${nonce}.${rawBody}"))`.

## Payment Hash Issuance

- Confirmed webhooks issue `paymentHash = keccak256(abi.encode(orderId, userId, ticketIds, amount, nonce))`.
- The service signs a `TicketLedger` `Purchase` EIP-712 payload with the configured backend signer.
- `GET /api/payment/hash/:orderId` returns `paymentHash`, `signature`, `nonce`, signer metadata, and expiry information once the order is ready.
- Issued hashes expire after `PAYMENT_HASH_TTL_SEC` and are not regenerated for duplicate webhook deliveries.
