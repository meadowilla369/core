# API Mapping And UI State Matrix

Source API contract: [openapi.yaml](/Users/nguyentruong/Documents/proof-of-concept/vibe-coding/core/docs/api/openapi.yaml)

## Buyer/Seller Mapping

| UI Flow | Endpoints | UI States To Support |
|---|---|---|
| OTP auth | `POST /v1/auth/otp/request`, `POST /v1/auth/otp/verify` | requesting_otp, verifying, otp_invalid, otp_expired, signed_in |
| Event discovery | `GET /v1/events`, `GET /v1/events/{eventId}`, `GET /v1/events/{eventId}/availability` | loading, empty, api_error, stale_data |
| Reserve + checkout | `POST /v1/tickets/reserve`, `POST /v1/tickets/purchase`, `POST /v1/tickets/purchase/{reservationId}/confirm` | reserving, payment_pending, paid, failed, reservation_expired |
| Tickets + QR | `GET /v1/tickets/me`, `GET /v1/tickets/{tokenId}`, `POST /v1/tickets/{tokenId}/qr` | loading, qr_refreshing, qr_failed, unauthorized |
| Resale create | `POST /v1/marketplace/listings` | creating, markup_exceeded, cutoff_reached, kyc_required, resale_limit_reached |
| Resale buy | `POST /v1/marketplace/listings/{listingId}/purchase` | processing, listing_inactive, cutoff_reached, kyc_required, success |

## Staff Mapping

| UI Flow | Endpoints | UI States To Support |
|---|---|---|
| Scan verify | `POST /v1/checkin/verify` | scanning, valid, duplicate, expired, invalid_signature, network_error |
| Gate/event metrics | `GET /v1/checkin/events/{eventId}/stats`, `GET /v1/checkin/events/{eventId}/gates` | loading, empty, api_error, refreshing |

## BTC Organizer Mapping

| UI Flow | Endpoints | UI States To Support |
|---|---|---|
| Event CRUD | `GET /v1/events`, `POST /v1/events`, `PUT /v1/events/{eventId}` | loading, invalid_payload, save_success, save_error |
| Ticket type setup | `POST /v1/events/{eventId}/ticket-types`, `GET /v1/events/{eventId}/ticket-types` | loading, empty, save_success, save_error |
| Event cancellation | `POST /v1/events/{eventId}/cancel` | confirm, submitting, success, fail |

## Platform Mapping

| UI Flow | Endpoints | UI States To Support |
|---|---|---|
| Disputes | `GET /v1/disputes`, `GET /v1/disputes/{disputeId}`, `POST /v1/internal/disputes/{disputeId}/moderate` | loading, empty, sla_warning, moderation_success, moderation_error |
| Recovery | `POST /v1/recovery/initiate`, `POST /v1/recovery/verify`, `GET /v1/recovery/{recoveryId}/status` | loading, pending, verified, blocked, error |
| Refunds | `POST /v1/refunds/requests`, `GET /v1/refunds/me`, `GET /v1/refunds/{refundId}`, `POST /v1/refunds/sync` | loading, pending, processing, completed, failed |
| Contract ops | `GET /v1/internal/contracts/sync-status`, `POST /v1/internal/contracts/events` | loading, lagging, synced, error |

## Error Code Mapping (P0)

Must map these codes to stable UI copy/actions:

- `KYC_REQUIRED`
- `MARKUP_EXCEEDED`
- `LISTING_CUTOFF_REACHED`
- `LISTING_EXPIRY_INVALID`
- `RESALE_LIMIT_REACHED`
- `LISTING_NOT_ACTIVE`
- `RESERVATION_EXPIRED`
- `INVALID_QR_PAYLOAD`
