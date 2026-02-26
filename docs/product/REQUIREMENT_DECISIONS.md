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
