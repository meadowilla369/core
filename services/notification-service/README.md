# Notification Service

Runnable notification service skeleton with template-based SMS/email/push notifications and event-driven triggers.

## Run (source mode)

```bash
PORT=3013 HOST=127.0.0.1 \
DELIVERY_POLL_MS=1000 MAX_NOTIFICATION_RETRIES=2 DELIVERY_FAILURE_RATE=0 \
node --experimental-strip-types src/index.ts
```

## Endpoints

- `GET /healthz`
- `GET /notifications/templates`
- `POST /notifications/send`
- `POST /notifications/events`
- `GET /notifications/me`

## Auth Simulation

Use header `x-user-id` for `GET /notifications/me`.
