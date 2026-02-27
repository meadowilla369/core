# Requirement Decisions Log

## Decision 1: USDT Flow

- Status: Finalized for MVP.
- Decision: Disable USDT payment and settlement in MVP; VND-only (`momo`, `vnpay`) remains the sole transaction rail.
- Rationale: Reduce regulatory and operational risk while preserving core commerce flow.
- Effective date: 2026-02-26.

## Decision 2: Organizer Onboarding

- Status: Finalized for MVP.
- Decision: Organizer onboarding is manual/ops-assisted with verification flag managed internally.
- Rationale: Faster go-live with controlled pilot organizers and lower fraud surface.
- Effective date: 2026-02-26.

## Decision 3: Event Creation Details

- Status: Finalized for MVP.
- Decision: Organizer must provide `title`, `city`, `venue`, `startAt`, `endAt`; optional ticket type payload can be attached at create time.
- Ownership rule: only the organizer from `x-organizer-id` can update/cancel their event.
- Rationale: Clear minimum contract for organizer workflows and downstream ticketing consistency.
- Effective date: 2026-02-26.

## Decision 4: Resale Policy Matrix Alignment

- Status: Finalized for MVP.
- Decision: Adopt `docs/product/POLICY_MATRIX.md` as the canonical policy source for resale and transfer rules.
- Finalized values:
  - Payout split: seller/platform/organizer = `90/5/5` (seller pays all fees).
  - Cutoff: block listing create + resale purchase at `T-30 minutes` before event start.
  - Active listing handling: auto-cancel at cutoff.
  - Listing expiry: seller-provided `expiresAt`, capped to cutoff.
  - Timezone: `Asia/Ho_Chi_Minh`.
  - Resale count limit: max `2` resale cycles per ticket.
  - KYC threshold: require KYC for acting user when resale amount >= `5,000,000 VND`.
  - Rollout scope: apply to new listings only.
- Rationale: Eliminate doc/code drift and enforce one operationally auditable rule set.
- Effective date: 2026-02-27.
