# Marketplace Service

Runnable resale marketplace skeleton with KYC-gated listing creation, listing purchase, escrow payload assembly, and complete-sale trigger simulation.

## Run (source mode)

```bash
PORT=3007 HOST=127.0.0.1 \
MAX_MARKUP_BPS=12000 PLATFORM_FEE_BPS=500 ORGANIZER_ROYALTY_BPS=200 \
node --experimental-strip-types src/index.ts
```

## Endpoints

- `GET /healthz`
- `GET /marketplace/listings`
- `POST /marketplace/listings`
- `DELETE /marketplace/listings/:listingId`
- `POST /marketplace/listings/:listingId/purchase`
- `GET /marketplace/me/sales`
- `POST /internal/marketplace/settlements/finalize`

## Auth Simulation

- Use header `x-user-id` as user context.
- Listing creation also requires `x-kyc-status: approved`.
- Internal finalize endpoint requires header `x-internal-api-key` (default value from `INTERNAL_API_KEY`).
