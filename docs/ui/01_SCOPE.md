# UI Scope

## Objective

Deliver production-ready frontend for 3 role groups across iPhone, Android, and web:

1. Buyer/Seller (consumer app)
2. BTC Organizer (organizer portal)
3. Platform (admin/support/ops)

## Product Decisions Locked

Baseline policy follows [POLICY_MATRIX.md](/Users/nguyentruong/Documents/proof-of-concept/vibe-coding/core/docs/product/POLICY_MATRIX.md):

- Resale price cap: max 120% of face value
- Fee split: 90/5/5 (seller/platform/organizer)
- Seller pays fees (buyer all-in price)
- Resale cutoff: T-30 minutes (create + purchase blocked)
- Active listings auto-cancel at cutoff
- Resale max count per ticket: 2
- KYC threshold for resale action: >= 5,000,000 VND
- Dynamic ticket QR refresh: 3 seconds
- Staff check-in verification: online

## Surfaces In Scope

- `apps/mobile`: Buyer/Seller journeys (mobile-first, web support)
- `apps/staff-scanner`: Staff check-in app
- `apps/organizer-portal`: BTC organizer workflows
- Platform web console (new surface to define in this plan)

## Out of Scope (for current sprint)

- Direct ticket gifting/transfer flow (outside resale)
- Full design language reinvention
- New backend business capabilities not in OpenAPI

## Done Criteria For UI Delivery

- Role-based route access and guard behavior implemented
- All P0 screens implemented with loading/empty/error states
- API integration for all P0 journeys
- Responsive behavior validated on iPhone, Android, web breakpoints
- Basic accessibility checks and keyboard navigation on web
