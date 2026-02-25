# User Service

Runnable user profile service skeleton with in-memory storage.

## Run (source mode)

```bash
PORT=3002 HOST=127.0.0.1 node --experimental-strip-types src/index.ts
```

## Endpoints

- `GET /healthz`
- `GET /users/me`
- `PUT /users/me`
- `POST /users/me/email`
- `GET /users/me/devices`
- `DELETE /users/me/devices/:id`

## Auth Simulation

Use request header `x-user-id` to identify current user.
