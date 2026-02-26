# Incident Rollback Criteria (App/Backend/Contracts)

## Trigger Conditions

1. p95 latency > 2x baseline for 15 minutes.
2. 5xx rate > 5% for critical endpoints for 10 minutes.
3. Payment confirmation mismatch above agreed threshold.
4. Check-in false rejection spike above threshold.
5. Contract-side critical defect with exploitable path.

## Rollback Actions

- Application/backend: execute blue/green rollback.
- Contracts: stop rollout, invoke pause/governance emergency controls.

## Exit from Rollback

- Incident owner approval.
- Verified remediation in staging.
- Re-run release candidate gates.

Final status: **Rollback criteria defined for all runtime layers.**
