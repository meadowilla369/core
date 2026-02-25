# Refund Service

Runnable refund service skeleton with cancellation policy checks, retryable payout queue, and payout status sync.

## Run (source mode)

```bash
PORT=3009 HOST=127.0.0.1 \
PAYOUT_SYNC_POLL_MS=2000 MAX_REFUND_RETRY_COUNT=3 REFUND_RETRY_BASE_DELAY_SEC=30 \
PAYOUT_FAILURE_RATE=0 \
node --experimental-strip-types src/index.ts
```

## Endpoints

- `GET /healthz`
- `POST /refunds/requests`
- `GET /refunds/me`
- `GET /refunds/:refundId`
- `POST /refunds/sync`

## Policy Notes

- Refund is allowed when event is `cancelled`.
- Refund is also allowed for `postponed` events only when `refundWindowOpen=true`.
- Resale premium is excluded; refund amount follows `originalPurchasePrice`.
