# STRIDE Threat Model Sign-off

Date: 2026-02-26

## Covered Core Flows

1. Registration and wallet/session onboarding.
2. Primary purchase and payment confirmation.
3. Resale listing and escrow settlement.
4. Check-in verification and mark-as-used.
5. Recovery and dispute escalation.

## STRIDE Summary

| Flow | S | T | R | I | D | E | Residual Risk | Sign-off |
|------|---|---|---|---|---|---|---------------|----------|
| Registration | Mitigated | Mitigated | Mitigated | Mitigated | Mitigated | Mitigated | Low | Approved |
| Purchase | Mitigated | Mitigated | Mitigated | Mitigated | Mitigated | Mitigated | Low | Approved |
| Resale | Mitigated | Mitigated | Mitigated | Mitigated | Mitigated | Mitigated | Low-Med | Approved |
| Check-in | Mitigated | Mitigated | Mitigated | Mitigated | Mitigated | Mitigated | Low | Approved |
| Recovery/Dispute | Mitigated | Mitigated | Mitigated | Mitigated | Mitigated | Mitigated | Medium | Approved |

## Evidence

- Integration and chaos tests: `packages/integration-suite/tests/`.
- Security baselines: `config/security/*.json`.
- Runbooks and emergency flows: `docs/ops/` and `docs/contracts/`.

Final status: **STRIDE sign-off completed for all five core flows.**
