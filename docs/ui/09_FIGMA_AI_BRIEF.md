# Figma AI Brief - Event Ticketing Marketplace (VN)

Design a complete multi-platform UI system for an event ticketing marketplace in Vietnam.

## Product Context

Build for 3 role groups:

1. Buyer/Seller (consumer app)
2. BTC Organizer (organizer web portal)
3. Platform Admin/Support/Ops (internal web console)

Target platforms:

- iPhone
- Android
- Web

## Non-Negotiable Business Rules

- Primary + resale marketplace
- No direct gifting/transfer flow
- Buyer sees all-in price upfront
- Resale payout split: 90% seller, 5% platform, 5% organizer
- Seller pays fees (buyer does not pay extra)
- Resale price cap: max 120% of face value
- Resale ask price can be lower than face value
- Resale cutoff at T-30 minutes before event start:
  - block new listings
  - block resale purchase
  - auto-close active listings
- KYC required when resale amount >= 5,000,000 VND
- Ticket QR is dynamic and refreshes every 3 seconds
- Staff check-in verification is online

## IA And Priority Screens

Design P0 screens first:

- Buyer/Seller:
  - Explore
  - Event Detail
  - Checkout
  - Ticket Detail (QR)
  - Resale Create
  - KYC Stepper
- Staff:
  - Scan
  - Scan Result
- BTC:
  - Organizer Dashboard
- Platform:
  - Dispute Queue
  - Dispute Detail

## UX Requirements

- Include full state design for each screen:
  - loading
  - empty
  - success
  - error
  - blocked-by-policy
- Mobile-first, but web must be production-usable.
- Clear information hierarchy for transactional decisions.
- Destructive actions require confirmation modal.
- Show policy-driven reasons in UI (cutoff, KYC required, price cap, resale limit).

## Design System Requirements

- Define reusable components and variants:
  - buttons, inputs, cards, tabs, dialogs, tables, banners
- Provide token-ready styles:
  - color, typography, spacing, radius, elevation, motion
- Ensure accessibility:
  - contrast, touch target >= 44x44, visible focus states on web

## Output Structure In Figma

Create pages:

1. `00_Foundations`
2. `01_BuyerSeller_P0`
3. `02_Staff_P0`
4. `03_BTC_P0`
5. `04_Platform_P0`
6. `05_States_And_Errors`
7. `06_Components_And_Variants`

For each screen frame, include notes:

- intent
- API dependency
- state behavior
- platform-specific differences
