# Integration and Verification Matrix

## Command Entry Points

- Full suite: `cd packages/integration-suite && npm run test`
- Critical journeys: `npm run test:critical`
- Backend sandbox suite: `npm run test:backend`
- E2E mobile/staff: `npm run test:e2e`
- Load checks: `npm run test:load`
- Chaos checks: `npm run test:chaos`
- Contracts quality gates: `npm run test:contracts`

## Critical Journey Coverage

1. Registration + wallet/session provisioning.
2. Purchase + payment webhook + mint.
3. Resale listing + purchase + escrow settlement.
4. Check-in success + duplicate/race rejection.
5. Event cancellation + refund.
6. Recovery + dispute escalation.

## Backend Sandbox Mocks

- Payment webhook signed callback simulation.
- KYC provider failover simulation.
- Wallet/session provisioning simulation via auth flow.

## Non-functional Validation

- Load scenario: event listing burst + check-in peak.
- Chaos scenario: RPC outage, delayed webhook, KYC provider outage.

Final status: **Phase 12-13 integration verification matrix completed.**
