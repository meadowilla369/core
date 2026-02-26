# MVP Scope (MoSCoW)

## Must Have

- Phone OTP authentication and session management.
- Event browsing, details, and ticket availability.
- Ticket reservation with 15-minute TTL and inventory lock.
- Payment orchestration with signed webhooks and idempotency.
- Mint worker with retry and support queue.
- Ticket ownership, rotating QR, and atomic check-in.
- Marketplace listing/purchase with KYC gate and escrow payload tracking.
- Event cancellation and refund processing workflow.
- Recovery orchestration and dispute handling baseline.
- Internal/admin endpoints for moderation and settlement finalization.

## Should Have

- Notification templates and event-driven triggers.
- Contract event sync service for ownership/status reconciliation.
- Shared typed SDK for frontend integrations.
- Baseline runbooks and CI quality gates.

## Could Have

- Advanced organizer analytics dashboard.
- Extended anti-bot controls (queue/CAPTCHA tuning).
- Automated chaos game-day scenarios.

## Won't Have (MVP)

- USDT settlement in production flows.
- Multi-chain deployment in MVP.
- Full VNeID-native onboarding (planned for later phase).

## Phase 1+ Backlog Priority

1. Mobile app core journeys and staff scanner UX hardening.
2. End-to-end automated integration suites for critical journeys.
3. Production deployment drills and release gating automation.
4. Advanced security hardening and external penetration tests.
