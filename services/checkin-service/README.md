# Check-in Service

Runnable check-in service skeleton with QR signature verification, first-scan-wins behavior, and async markAsUsed queue simulation.

## Run (source mode)

```bash
PORT=3008 HOST=127.0.0.1 \
QR_SIGNATURE_SECRET=checkin_dev_secret MAX_QR_AGE_SEC=30 MAX_CLOCK_SKEW_SEC=10 \
MARK_AS_USED_POLL_MS=1000 MARK_AS_USED_MAX_RETRIES=3 \
node --experimental-strip-types src/index.ts
```

## Endpoints

- `GET /healthz`
- `POST /checkin/verify`
- `GET /checkin/events/:eventId/stats`
- `GET /checkin/events/:eventId/gates`
- `GET /checkin/mark-as-used/jobs`

## QR Signature

Expected signature format:
- `hex(HMAC_SHA256(QR_SIGNATURE_SECRET, "${tokenId}.${eventId}.${timestamp}.${nonce}.${walletAddress}"))`
