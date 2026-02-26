# Dispute Service

Runnable dispute management skeleton with tiered SLA, auto-resolution rules, evidence storage, and escalation flow.

## Run (source mode)

```bash
PORT=3012 HOST=127.0.0.1 \
SLA_TIER1_HOURS=24 SLA_TIER2_HOURS=48 SLA_TIER3_HOURS=72 \
node --experimental-strip-types src/index.ts
```

## Endpoints

- `GET /healthz`
- `POST /disputes`
- `GET /disputes/me`
- `GET /disputes/:id`
- `POST /disputes/:id/messages`
- `POST /disputes/:id/escalate`
- `POST /internal/disputes/:id/moderate`

## Notes

- Use `x-user-id` for customer-scoped calls.
- Support role can be simulated with `x-support-role` header.
- Internal moderation endpoint accepts `x-internal-api-key` (default via `INTERNAL_API_KEY`).
