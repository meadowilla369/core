# Event Service

Runnable event catalog service skeleton with in-memory data.

## Run (source mode)

```bash
PORT=3004 HOST=127.0.0.1 node --experimental-strip-types src/index.ts
```

## Endpoints

- `GET /healthz`
- `GET /events`
- `GET /events/:id`
- `GET /events/:id/ticket-types`
- `GET /events/:id/availability`
