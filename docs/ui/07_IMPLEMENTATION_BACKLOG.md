# Implementation Backlog (Hybrid)

## Delivery Strategy

- Work by vertical slices.
- Each slice must ship UI + API integration + error states.
- Commit per slice, not per file type.

## Phase 0 - Foundation (2-3 days)

| Task ID | Scope | Output | Priority |
|---|---|---|---|
| `UI-000` | Route shells by role | Role-based app shells and guards | P0 |
| `UI-001` | Shared token pipeline | Token loader + theme provider | P0 |
| `UI-002` | Core components | Button/Input/Card/Dialog base set | P0 |
| `UI-003` | Network layer | Typed API client wrappers + error translator | P0 |

## Phase 1 - Buyer/Seller Core (4-6 days)

| Task ID | Scope | Output | Priority |
|---|---|---|---|
| `UI-101` | Auth + session | OTP screens and session restore | P0 |
| `UI-102` | Explore + event detail | Discovery and detail screens | P0 |
| `UI-103` | Reserve + checkout | Reservation and payment flow | P0 |
| `UI-104` | Ticket list/detail + QR | Dynamic QR and status handling | P0 |
| `UI-105` | Resale create flow | Price validation, fee breakdown, KYC gate | P0 |
| `UI-106` | Resale purchase flow | Listing detail and purchase state machine | P0 |

## Phase 2 - Staff + BTC (3-4 days)

| Task ID | Scope | Output | Priority |
|---|---|---|---|
| `UI-201` | Staff scan flow | Scan/result/history + gate metrics | P0 |
| `UI-202` | Organizer dashboard | Event list and KPI summary | P0 |
| `UI-203` | Organizer event detail | Ticket type config + cancel action | P0 |

## Phase 3 - Platform Console (4-5 days)

| Task ID | Scope | Output | Priority |
|---|---|---|---|
| `UI-301` | Dispute queue/detail | Moderation-ready case workflow | P0 |
| `UI-302` | Recovery monitor | Recovery state and operator tools | P1 |
| `UI-303` | Refund monitor | Refund queue and status timeline | P1 |
| `UI-304` | Contract sync monitor | Internal sync health and token diagnostics | P1 |

## Definition Of Done For Every Task

1. All target states implemented (`loading`, `empty`, `error`, `success`, `blocked`).
2. API integration wired and typed.
3. Role guard verified.
4. Responsive checks passed on iOS, Android, web.
5. Basic accessibility checks passed.
6. Commit message references task ID.
