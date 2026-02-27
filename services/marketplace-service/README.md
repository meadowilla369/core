# Marketplace Service

Runnable resale marketplace skeleton with KYC-gated listing creation, listing purchase, escrow payload assembly, and complete-sale trigger simulation.

## Run (source mode)

```bash
PORT=3007 HOST=127.0.0.1 \
BASE_CHAIN_ID=31337 \
MARKETPLACE_CONTRACT_ADDRESS=0xe7f1725e7734ce288f8367e1bb143e90bb3f0512 \
TICKET_NFT_ADDRESS=0x5fbdb2315678afecb367f032d93f642f64180aa3 \
MAX_MARKUP_BPS=12000 PLATFORM_FEE_BPS=500 ORGANIZER_ROYALTY_BPS=500 \
RESALE_CUTOFF_MINUTES=30 RESALE_KYC_THRESHOLD_VND=5000000 MAX_RESALE_COUNT=2 \
POLICY_TIMEZONE=Asia/Ho_Chi_Minh \
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
- Listing create/purchase requires `x-kyc-status: approved` when resale amount >= `RESALE_KYC_THRESHOLD_VND`.
- Internal finalize endpoint requires header `x-internal-api-key` (default value from `INTERNAL_API_KEY`).
