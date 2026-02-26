# Pause and Emergency Runbook (Contracts)

## Triggers

- Active exploit or suspected private key compromise.
- Unexpected replay or settlement mismatch signals.
- On-chain invariants violated (price cap, recovery delay).

## Immediate Actions

1. Pause `TicketNFT`, `Marketplace`, and `TicketPaymaster` using `PAUSER_ROLE`.
2. Disable external purchase/check-in endpoints at API gateway if needed.
3. Notify incident channel and on-call security lead.
4. Snapshot current state:
- latest blocks
- pending settlements
- queued mint/refund jobs

## Containment

1. Rotate compromised service keys.
2. Revoke elevated roles from compromised accounts.
3. Validate escrow hook signer and paymaster signer integrity.

## Recovery

1. Deploy patched contracts or update configuration.
2. Run smoke checks on staging fork.
3. Unpause in phased order:
- read-only APIs
- purchase flows
- settlement flows
4. Backfill pending jobs from queues.

## Post-Incident

- Publish incident report within 48h.
- Add regression tests for root cause.
- Update STRIDE and runbooks.
