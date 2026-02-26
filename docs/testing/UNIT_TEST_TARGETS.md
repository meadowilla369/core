# Unit Test Targets

## Target Baseline

- Services (`services/*`): minimum 70% statement coverage for core modules.
- Shared packages (`packages/*`): minimum 80% statement coverage.
- Frontend modules (`apps/*`): minimum 65% statement coverage in MVP, increasing to 75% post-launch.

## Service-Level Priority Matrix

- `auth-service`: OTP lifecycle, refresh/session revoke, rate limit windows.
- `user-service`: profile update, freeze/unfreeze transitions, audit log emission.
- `kyc-service`: provider selection fallback and status transitions.
- `event-service`: organizer ownership checks, create/update/cancel validation.
- `ticketing-service`: reservation TTL, inventory lock/unlock, purchase confirmation paths.
- `payment-orchestrator`: signature verification, idempotency scopes, retry queue behavior.
- `worker-mint`: retry/backoff and support queue routing.
- `marketplace-service`: price cap split rules, listing lifecycle, settlement payload guardrails.
- `checkin-service`: first-scan-wins and signature verification failure paths.
- `refund-service`: policy gates and payout status transitions.
- `recovery-service`: hold timer state machine and guardian rotation eligibility.
- `dispute-service`: escalation tier progression and moderation actions.
- `notification-service`: template resolution and retry-to-failed behavior.
- `contract-sync-service`: duplicate event rejection and ownership/status projection.
- `api-gateway`: route proxy mapping and upstream error handling.

## Frontend Module Priorities

- `apps/mobile`: auth shell state, event discovery state, purchase state machine, ticket QR refresh behavior.
- `apps/staff-scanner`: scan result parser and duplicate/error reason rendering.
- `apps/organizer-portal`: event CRUD forms and cancellation guard flows.

## Enforcement

- Coverage gate is advisory in MVP and required in release-candidate branches.
- Any module below target must include documented risk acceptance in PR notes.
