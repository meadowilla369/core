# Information Architecture

## App Surfaces

1. Buyer/Seller App (`mobile + web shell`)
2. Staff Scanner App (`mobile scanner flow`)
3. BTC Organizer Portal (`web`)
4. Platform Console (`web`)

## Buyer/Seller Routes

| Route ID | Path | Purpose | Priority |
|---|---|---|---|
| `bs_auth_otp` | `/auth/otp` | Login and session bootstrap | P0 |
| `bs_explore` | `/explore` | Event discovery | P0 |
| `bs_search` | `/search` | Search and filter events | P1 |
| `bs_event_detail` | `/events/:eventId` | Event detail and offer selection | P0 |
| `bs_checkout` | `/checkout/:reservationId` | Payment confirmation flow | P0 |
| `bs_tickets` | `/tickets` | Ticket list and status | P0 |
| `bs_ticket_detail` | `/tickets/:tokenId` | QR and ticket actions | P0 |
| `bs_resale_create` | `/tickets/:tokenId/resale/new` | Create resale listing | P0 |
| `bs_resale_detail` | `/resale/:listingId` | Listing detail and actions | P1 |
| `bs_profile` | `/profile` | Account and settings | P1 |

## Staff Scanner Routes

| Route ID | Path | Purpose | Priority |
|---|---|---|---|
| `stf_scan` | `/scan` | Camera scan + manual input | P0 |
| `stf_result` | `/scan/result` | Validate result and reason | P0 |
| `stf_gate_metrics` | `/gates/:gateId` | Gate-level metrics | P1 |
| `stf_history` | `/scan/history` | Local scan history | P1 |

## BTC Organizer Routes

| Route ID | Path | Purpose | Priority |
|---|---|---|---|
| `btc_dashboard` | `/organizer/dashboard` | KPI snapshot | P0 |
| `btc_events` | `/organizer/events` | Event list/manage | P0 |
| `btc_event_create` | `/organizer/events/new` | Create event | P0 |
| `btc_event_detail` | `/organizer/events/:eventId` | Event detail + ticket types | P0 |
| `btc_event_cancel` | `/organizer/events/:eventId/cancel` | Cancellation action | P0 |
| `btc_checkin_ops` | `/organizer/events/:eventId/checkin` | Gate stats and attendance | P1 |
| `btc_sales` | `/organizer/sales` | Sales and settlement view | P1 |

## Platform Console Routes

| Route ID | Path | Purpose | Priority |
|---|---|---|---|
| `plt_dashboard` | `/platform/dashboard` | Ops overview and alerts | P0 |
| `plt_disputes` | `/platform/disputes` | Triage and moderation queue | P0 |
| `plt_dispute_detail` | `/platform/disputes/:disputeId` | Case review and action | P0 |
| `plt_recovery` | `/platform/recovery` | Recovery requests and actions | P1 |
| `plt_refunds` | `/platform/refunds` | Refund processing monitor | P1 |
| `plt_contract_sync` | `/platform/contracts` | Sync and token diagnostics | P1 |
| `plt_notifications` | `/platform/notifications` | Templates and sends | P2 |

## Access Matrix

| Route Prefix | Buyer/Seller | Staff | BTC Organizer | Platform |
|---|---|---|---|---|
| `/explore`, `/search`, `/events`, `/tickets`, `/checkout`, `/resale` | Yes | No | No | No |
| `/scan`, `/gates` | No | Yes | No | No |
| `/organizer/*` | No | No | Yes | No |
| `/platform/*`, `/v1/internal/*` actions | No | No | No | Yes |
