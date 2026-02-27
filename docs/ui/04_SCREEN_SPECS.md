# Screen Specs

## Spec Format

Each screen must define:

- Goal
- Key components
- API dependencies
- State matrix (`loading`, `empty`, `error`, `success`, `blocked`)
- Platform notes (`iOS`, `Android`, `web`)

## P0 Screen Matrix

| Screen ID | Role | Platforms | Core Components | Key States | Figma Needed |
|---|---|---|---|---|---|
| `bs_auth_otp` | Buyer/Seller | iOS, Android, web | Phone input, OTP input, timer, retry | loading, invalid_otp, otp_expired, signed_in | No |
| `bs_explore` | Buyer/Seller | iOS, Android, web | Hero, event sections, cards, badges | loading, empty, api_error | Yes |
| `bs_event_detail` | Buyer/Seller | iOS, Android, web | Event hero, offer list, CTA state | loading, sold_out, resale_closed, error | Yes |
| `bs_checkout` | Buyer/Seller | iOS, Android, web | Order summary, payment selector, terms | loading, pending, success, failed | Yes |
| `bs_tickets` | Buyer/Seller | iOS, Android, web | Tabs (upcoming/past), ticket cards | loading, empty, error | No |
| `bs_ticket_detail` | Buyer/Seller | iOS, Android, web | Dynamic QR, ticket meta, resale CTA | loading, qr_refreshing, qr_error, resale_blocked | Yes |
| `bs_resale_create` | Buyer/Seller | iOS, Android, web | Price input, fee breakdown, policy hints | loading, cap_error, cutoff_block, limit_block | Yes |
| `bs_kyc_stepper` | Buyer/Seller | iOS, Android, web | Doc capture, selfie/liveness, status steps | loading, rejected, manual_review, verified | Yes |
| `stf_scan` | Staff | iOS, Android | Camera preview, scan frame, flash, manual input | camera_denied, offline, scanning, submit_error | Yes |
| `stf_result` | Staff | iOS, Android | Result banner, reason text, quick actions | valid, duplicate, expired, invalid | Yes |
| `btc_dashboard` | BTC | web | KPI cards, alerts, recent events | loading, empty, error | Yes |
| `btc_event_detail` | BTC | web | Event info, ticket type editor, actions | loading, draft, published, cancelled | Yes |
| `btc_event_cancel` | BTC | web | Risk summary, confirmation modal | loading, confirm, success, failure | No |
| `plt_disputes` | Platform | web | Queue table, filters, SLA chips | loading, empty, api_error | Yes |
| `plt_dispute_detail` | Platform | web | Timeline, evidence panel, moderation actions | loading, action_pending, action_success, action_error | Yes |

## Non-visual Acceptance Rules

- Every user action has disabled/loading state.
- Every async call has retry affordance.
- All destructive actions use confirmation.
- Error copy uses API error codes where possible.
