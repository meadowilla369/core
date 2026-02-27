# Policy Matrix

Single source of truth for policy values that must stay aligned across docs, config, API contracts, and runtime checks.

Effective baseline date: `2026-02-27`.

## Resale & Transfer Policies

| Policy Key | Value | Enforcement Layer | Notes |
|---|---|---|---|
| `resale.payout.platform_fee_bps` | `500` (5%) | Marketplace service + settlement validation | Seller pays fee |
| `resale.payout.organizer_royalty_bps` | `500` (5%) | Marketplace service + settlement validation | Seller pays fee |
| `resale.payout.seller_share_bps` | `9000` (90%) | Derived in settlement split | `seller = gross - fees` |
| `resale.fee_payer` | `seller_only` | Product policy + checkout copy | Buyer sees all-in ask price |
| `resale.price_cap.max_markup_bps` | `12000` (120%) | Contract + service validation | Guarded by governance bounds |
| `resale.cutoff.create_before_event_start_minutes` | `30` | Marketplace service + UI guardrails | Listing create blocked after `T-30m` |
| `resale.cutoff.purchase_before_event_start_minutes` | `30` | Marketplace service + UI guardrails | Purchase blocked after `T-30m` |
| `resale.cutoff.auto_cancel_active_listings` | `true` | Scheduled job + operator cancel flow | Active listings auto-cancel at cutoff |
| `resale.listing.expires_at_source` | `seller_input` | Listing create API | Seller may choose `expiresAt` |
| `resale.listing.expires_at_max` | `event_start - 30 minutes` | Listing create validation | `expiresAt` cannot exceed cutoff |
| `resale.timezone` | `Asia/Ho_Chi_Minh` | Service time comparisons | Convert event time before cutoff checks |
| `resale.transfer.max_resales_per_ticket` | `2` | Marketplace service + persistent counter | Applies to resale lifecycle count |
| `resale.kyc.threshold_vnd` | `5000000` | Marketplace service | KYC required for acting user when resale amount >= threshold |
| `resale.rollout.scope` | `new_listings_only` | Migration/release policy | Existing active listings unchanged by default |

## Mapping Notes

1. If code/config values conflict with this matrix, this file wins and code must be updated.
2. Any future policy change must update this file first, then docs/API, then implementation.
3. Policy keys are intentionally stable so tests and dashboards can reference them directly.
